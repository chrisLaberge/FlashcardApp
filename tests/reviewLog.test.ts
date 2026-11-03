import { advanceTime, freezeTime, makeTempDir, MINUTE, rawDb, startApp, stopApp, T0, unfreezeTime } from "./helpers/testDb";

beforeEach(() => freezeTime(T0));
afterEach(() => {
    stopApp();
    unfreezeTime();
});

async function oneCard() {
    const db = startApp();
    const deckId = await db.addDeck("Deck", "ru");
    const id = await db.addCard("яблоко", "apple", "", "", deckId);
    return { db, deckId, id };
}

describe("review log", () => {
    test("every answer is logged with its prompt, time on card, levels and deck", async () => {
        const { db, deckId, id } = await oneCard();
        await db.markCardCorrect(id, { prompt: "learning", durationMs: 4200 });
        advanceTime(MINUTE);
        await db.markCardIncorrect(id, { prompt: "audio", durationMs: 9000 });

        const log = await db.getReviewLog();
        expect(log).toEqual([
            { cardId: id, deckId, reviewedAt: T0, correct: true, durationMs: 4200, prompt: "learning" },
            { cardId: id, deckId, reviewedAt: T0 + MINUTE, correct: false, durationMs: 9000, prompt: "audio" },
        ]);
        const rows = rawDb().prepare("SELECT level_before, level_after FROM review_log ORDER BY id").all();
        expect(rows).toEqual([
            { level_before: 0, level_after: 1 },
            { level_before: 1, level_after: 0 },
        ]);
    });

    test("an answer without timing info is still logged", async () => {
        const { db, id } = await oneCard();
        await db.markCardCorrect(id);
        const [entry] = await db.getReviewLog();
        expect(entry.durationMs).toBeNull();
        expect(entry.prompt).toBeNull();
    });

    test("one very long answer (app left open) is capped, a negative one is not negative", async () => {
        const { db, id } = await oneCard();
        await db.markCardCorrect(id, { durationMs: 3 * 60 * 60 * 1000 });
        await db.markCardCorrect(id, { durationMs: -50 });
        const log = await db.getReviewLog();
        expect(log[0].durationMs).toBe(db.MAX_REVIEW_DURATION_MS);
        expect(log[1].durationMs).toBe(0);
    });

    test("the answer and its log entry are saved together: if logging fails nothing changes", async () => {
        const { db, id } = await oneCard();
        const before = await db.getCardProgress(id);
        rawDb().exec("DROP TABLE review_log");
        await expect(db.markCardCorrect(id)).rejects.toThrow();
        expect(await db.getCardProgress(id)).toEqual(before);
    });

    test("undo restores the card and removes only that answer from the log", async () => {
        const { db, id } = await oneCard();
        await db.markCardCorrect(id, { durationMs: 1000 });
        const afterFirst = (await db.getCardProgress(id))!;
        advanceTime(MINUTE);
        await db.markCardCorrect(id, { durationMs: 2000 });

        await db.undoCardReview(afterFirst);

        expect(await db.getCardProgress(id)).toEqual(afterFirst);
        const log = await db.getReviewLog();
        expect(log).toHaveLength(1);
        expect(log[0].durationMs).toBe(1000);
    });

    test("history survives deleting the card and the deck", async () => {
        const { db, deckId, id } = await oneCard();
        await db.markCardCorrect(id, { durationMs: 1000 });
        await db.deleteCard(id);
        expect(await db.getReviewLog()).toHaveLength(1);
        await db.deleteDeck(deckId);
        expect(await db.getReviewLog()).toHaveLength(1);
    });

    test("can be read from a point in time and for one deck", async () => {
        const { db, deckId, id } = await oneCard();
        const other = await db.addDeck("Other", "zh");
        const otherCard = await db.addCard("好", "good", "", "", other);
        await db.markCardCorrect(id);
        advanceTime(60 * MINUTE);
        await db.markCardCorrect(otherCard);

        expect(await db.getReviewLog(T0 + 30 * MINUTE)).toHaveLength(1);
        expect((await db.getReviewLog(0, deckId)).map((e) => e.cardId)).toEqual([id]);
        expect((await db.getReviewLog(0, other)).map((e) => e.cardId)).toEqual([otherCard]);
    });

    test("an existing database gets the log table without losing anything", async () => {
        const tmp = makeTempDir();
        try {
            const file = tmp.path("old.db");
            const first = startApp(file);
            const deckId = await first.addDeck("Deck", "ru");
            const id = await first.addCard("a", "b", "", "", deckId);
            rawDb().exec("DROP TABLE review_log");
            stopApp();

            const upgraded = startApp(file);
            expect(await upgraded.getReviewLog()).toEqual([]);
            await upgraded.markCardCorrect(id);
            expect(await upgraded.getReviewLog()).toHaveLength(1);
        } finally {
            stopApp();
            tmp.cleanup();
        }
    });
});
