import { MASTERED_START_LEVEL } from "@/models/StudyMode";
import { advanceTime, freezeTime, makeTempDir, rawDb, startApp, stopApp, T0, unfreezeTime, MINUTE } from "./helpers/testDb";

beforeEach(() => freezeTime(T0));
afterEach(() => {
    stopApp();
    unfreezeTime();
});

async function oneCard() {
    const db = startApp();
    const deckId = await db.addDeck("Deck", "fr");
    const id = await db.addCard("pomme", "apple", "", "", deckId);
    return { db, deckId, id };
}

describe("levels in the database", () => {
    test("a new card starts at level 0", async () => {
        const { db, id } = await oneCard();
        expect((await db.getCardProgress(id))!.level).toBe(0);
    });

    test("Good raises the level by one, Again lowers it by one, never below 0", async () => {
        const { db, id } = await oneCard();
        expect(await db.markCardCorrect(id)).toBe(1);
        expect(await db.markCardCorrect(id)).toBe(2);
        expect(await db.markCardIncorrect(id)).toBe(1);
        expect(await db.markCardIncorrect(id)).toBe(0);
        expect(await db.markCardIncorrect(id)).toBe(0);
        expect((await db.getCardProgress(id))!.level).toBe(0);
    });

    test("the level never changes the FSRS schedule", async () => {
        const a = await oneCard();
        await a.db.markCardCorrect(a.id);
        const withLevel = await a.db.getCardProgress(a.id);
        rawDb().prepare("UPDATE card_progress SET level = 7 WHERE card_id = ?").run(a.id);
        const other = await a.db.getCardProgress(a.id);
        expect(other!.fsrsCard).toBe(withLevel!.fsrsCard);
        expect(other!.nextReviewAt).toBe(withLevel!.nextReviewAt);
    });

    test("undo restores the level along with the schedule", async () => {
        const { db, id } = await oneCard();
        await db.markCardCorrect(id);
        const before = (await db.getCardProgress(id))!;
        await db.markCardCorrect(id);
        expect((await db.getCardProgress(id))!.level).toBe(2);
        await db.restoreCardProgress(before);
        expect(await db.getCardProgress(id)).toEqual(before);
    });

    test("due cards come with their level (so the learn screen can choose the side)", async () => {
        const { db, deckId, id } = await oneCard();
        rawDb().prepare("UPDATE card_progress SET level = 5 WHERE card_id = ?").run(id);
        expect((await db.getDueCards(deckId))[0].level).toBe(5);
        expect((await db.getCardsByIds([id]))[0].level).toBe(5);
    });

    test("a level that is out of range in the file is read safely", async () => {
        const { db, id } = await oneCard();
        rawDb().prepare("UPDATE card_progress SET level = 99 WHERE card_id = ?").run(id);
        expect((await db.getCardProgress(id))!.level).toBe(8);
    });

    test("a card answered Again comes back at a lower level once it is due", async () => {
        const { db, deckId, id } = await oneCard();
        await db.markCardCorrect(id);
        await db.markCardCorrect(id);
        advanceTime(30 * MINUTE);
        await db.markCardIncorrect(id);
        advanceTime(30 * MINUTE);
        expect((await db.getDueCards(deckId))[0].level).toBe(1);
    });
});

describe("upgrading an existing database", () => {
    test("mastered cards start mixed, others at 0, and no data is lost", async () => {
        const tmp = makeTempDir();
        try {
            const file = tmp.path("old.db");
            const db = startApp(file);
            const deckId = await db.addDeck("Deck", "fr");
            const known = await db.addCard("a", "a", "", "", deckId);
            const fresh = await db.addCard("b", "b", "", "", deckId);
            rawDb().prepare("UPDATE card_progress SET mastered = 1, review_count = 12 WHERE card_id = ?").run(known);
            // Make it look like a database from before levels and local image copies existed.
            rawDb().exec("ALTER TABLE card_progress DROP COLUMN level; ALTER TABLE images DROP COLUMN local_path;");
            stopApp();

            const upgraded = startApp(file);
            expect((await upgraded.getCardProgress(known))!.level).toBe(MASTERED_START_LEVEL);
            expect((await upgraded.getCardProgress(fresh))!.level).toBe(0);
            expect((await upgraded.getCardProgress(known))!.reviewCount).toBe(12);
            expect(await upgraded.getCard(known)).toBeDefined();
            const imageColumns = rawDb().prepare("PRAGMA table_info(images)").all() as { name: string }[];
            expect(imageColumns.map((c) => c.name)).toContain("local_path");

            // Upgrading again must not reset levels that have changed since.
            await upgraded.markCardIncorrect(known);
            const level = (await upgraded.getCardProgress(known))!.level;
            stopApp();
            const again = startApp(file);
            expect((await again.getCardProgress(known))!.level).toBe(level);
        } finally {
            stopApp();
            tmp.cleanup();
        }
    });
});
