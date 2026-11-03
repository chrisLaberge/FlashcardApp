/**
 * The ReviewQueue driven by the REAL database layer, the way the learn screen uses it:
 * answers are saved with markCardCorrect/markCardIncorrect, time passes, and the 10-second poll
 * brings newly due cards back.
 */
import { loadQueue, pollDueCards, refreshQueuedCards, ReviewQueue } from "@/models/ReviewQueue";
import {
    advanceTime,
    DatabaseModule,
    DAY,
    freezeTime,
    makeTempDir,
    MINUTE,
    rawDb,
    seedCard,
    startApp,
    stopApp,
    T0,
    unfreezeTime,
} from "./helpers/testDb";

beforeEach(() => freezeTime(T0));
afterEach(() => {
    stopApp();
    unfreezeTime();
});

async function setup(cardCount: number) {
    const db = startApp();
    const deckId = await db.addDeck("Deck", "zh");
    for (let i = 1; i <= cardCount; i++) await db.addCard(`front ${i}`, `back ${i}`, "", "", deckId);
    const source = { getDueCardIds: db.getDueCardIds, getCardsByIds: db.getCardsByIds };
    const queue = new ReviewQueue();
    await loadQueue(queue, deckId, source);
    return { db, deckId, source, queue };
}

/** Answers the card on screen the way learn.tsx does: save first, then update the queue. */
async function answer(queue: ReviewQueue, db: DatabaseModule, direction: "left" | "right") {
    const card = queue.current!;
    queue.beginWrite();
    try {
        await (direction === "right" ? db.markCardCorrect(card.id!) : db.markCardIncorrect(card.id!));
        queue.answer(direction);
    } finally {
        queue.endWrite();
    }
}

describe("cards becoming due during a session", () => {
    test("a card answered Good returns once its learning step has elapsed, exactly once", async () => {
        const { db, source, queue } = await setup(3);
        await answer(queue, db, "right"); // card 1 -> due in 10 minutes
        expect(queue.queuedIds()).toEqual([2, 3]);

        advanceTime(9 * MINUTE);
        expect(await pollDueCards(queue, source)).toBe(0);

        advanceTime(1 * MINUTE);
        expect(await pollDueCards(queue, source)).toBe(1);
        expect(await pollDueCards(queue, source)).toBe(0); // polling again adds nothing
        expect(queue.queuedIds()).toEqual([2, 3, 1]);
    });

    test("a finished session leaves 'complete' by itself when a card comes due", async () => {
        const { db, source, queue } = await setup(2);
        await answer(queue, db, "right");
        await answer(queue, db, "right");
        expect(queue.current).toBeUndefined(); // "Session complete"

        advanceTime(10 * MINUTE);
        expect(await pollDueCards(queue, source)).toBe(2);
        expect(queue.ensureCurrent()).toBe(true);
        expect(queue.queuedIds()).toEqual([1, 2]);
    });

    test("a card answered Again stays in the session and is never added a second time by the poll", async () => {
        const { db, source, queue } = await setup(3);
        await answer(queue, db, "left"); // due in 1 minute, but kept in this session
        expect(queue.queuedIds()).toEqual([2, 3, 1]);

        advanceTime(5 * MINUTE);
        expect(await pollDueCards(queue, source)).toBe(0);
        expect(queue.queuedIds()).toEqual([2, 3, 1]);
    });

    test("a brand-new card added while studying is picked up", async () => {
        const { db, deckId, source, queue } = await setup(2);
        const added = await db.addCard("new", "new", "", "", deckId);
        expect(await pollDueCards(queue, source)).toBe(1);
        expect(queue.queuedIds()).toEqual([1, 2, added]);
    });

    test("the poll agrees with the home screen's count", async () => {
        const { db, deckId, source, queue } = await setup(5);
        await answer(queue, db, "right");
        await answer(queue, db, "right");
        advanceTime(10 * MINUTE);
        await pollDueCards(queue, source);
        const { due } = await db.getProgressCounts(deckId);
        expect(queue.knownCount).toBe(due);
    });

    test("undo restores the card and the database row, and the poll does not duplicate it", async () => {
        const { db, source, queue } = await setup(3);
        const first = queue.current!;
        const before = await db.getCardProgress(first.id!);
        await answer(queue, db, "right");

        queue.beginWrite();
        await db.restoreCardProgress(before!);
        queue.undo(first);
        queue.endWrite();

        expect(queue.queuedIds()).toEqual([1, 2, 3]);
        expect(await pollDueCards(queue, source)).toBe(0);
        expect(await db.getCardProgress(first.id!)).toEqual(before);
    });
});

describe("ordering and batching", () => {
    test("overdue reviews come before never-studied cards", async () => {
        const db = startApp();
        const deckId = await db.addDeck("Deck", "zh");
        await db.getDecks();
        const raw = rawDb();
        seedCard(raw, deckId, 1); // new
        seedCard(raw, deckId, 2); // new
        seedCard(raw, deckId, 3, { review_count: 5, next_review_at: T0 - 2 * DAY });
        seedCard(raw, deckId, 4, { review_count: 5, next_review_at: T0 - 5 * DAY });
        expect(await db.getDueCardIds(deckId, 10)).toEqual([4, 3, 1, 2]);
        expect((await db.getDueCards(deckId)).map((c) => c.id)).toEqual([4, 3, 1, 2]);
    });

    test("a large backlog of new cards does not hide overdue reviews from the first batch", async () => {
        const db = startApp();
        const deckId = await db.addDeck("Deck", "zh");
        await db.getDecks();
        const raw = rawDb();
        raw.exec("BEGIN");
        for (let id = 1; id <= 500; id++) seedCard(raw, deckId, id); // 500 new cards
        seedCard(raw, deckId, 501, { review_count: 8, next_review_at: T0 - DAY });
        raw.exec("COMMIT");
        const ids = await db.getDueCardIds(deckId, 100);
        expect(ids[0]).toBe(501);
        expect(ids).toHaveLength(100);
    });

    test("getDueCards with a limit returns only that many", async () => {
        const { db, deckId } = await setup(10);
        expect(await db.getDueCards(deckId, 4)).toHaveLength(4);
    });

    test("getCardsByIds keeps the requested order and skips missing ids", async () => {
        const { db } = await setup(5);
        expect((await db.getCardsByIds([4, 99, 2, 5])).map((c) => c.id)).toEqual([4, 2, 5]);
        expect(await db.getCardsByIds([])).toEqual([]);
    });

    test("getCardsByIds copes with more ids than one SQL statement may bind", async () => {
        const { db, deckId } = await setup(0);
        const raw = rawDb();
        raw.exec("BEGIN");
        for (let id = 1; id <= 1000; id++) seedCard(raw, deckId, id);
        raw.exec("COMMIT");
        const ids = Array.from({ length: 1000 }, (_, i) => i + 1);
        expect(await db.getCardsByIds(ids)).toHaveLength(1000);
    });
});

describe("edits made while the learn screen is in the background", () => {
    test("an edited card shows its new text and keeps its place in the queue", async () => {
        const { db, source, queue } = await setup(4);
        const before = queue.queuedIds();
        await db.updateCard(1, "edited front", "edited back", "", "");
        await db.updateCard(3, "also edited", "also edited", "", "");

        await refreshQueuedCards(queue, source);

        expect(queue.queuedIds()).toEqual(before); // the top of the stack does NOT change
        expect(queue.current?.learningText).toBe("edited front");
        expect(queue.current?.id).toBe(1);
    });

    test("a card deleted on the edit screen is dropped and the next card shown", async () => {
        const { db, source, queue } = await setup(3);
        await db.deleteCard(1);
        expect(await refreshQueuedCards(queue, source)).toBe(true);
        expect(queue.queuedIds()).toEqual([2, 3]);
        expect(queue.current?.id).toBe(2);
    });

    test("resetting a card's progress makes it due again without duplicating it", async () => {
        const { db, source, queue } = await setup(2);
        await answer(queue, db, "right"); // card 1 gone from queue, due in 10 minutes
        await db.resetCardProgress(1); // from the edit screen: due now
        expect(await pollDueCards(queue, source)).toBe(1);
        expect(queue.queuedIds()).toEqual([2, 1]);
    });
});

describe("indexes", () => {
    test("new and upgraded databases get the lookup indexes without losing data", async () => {
        const tmp = makeTempDir();
        try {
            const file = tmp.path("indexes.db");
            const db = startApp(file);
            const deckId = await db.addDeck("Deck", "zh");
            const id = await db.addCard("a", "b", "", "", deckId);
            const names = (table: string) =>
                (rawDb().prepare(`PRAGMA index_list(${table})`).all() as { name: string }[]).map((r) => r.name);
            expect(names("cards")).toContain("idx_cards_deck");
            expect(names("card_progress")).toContain("idx_progress_due");

            // Simulate a database created before the indexes existed.
            rawDb().exec("DROP INDEX idx_cards_deck; DROP INDEX idx_progress_due;");
            stopApp();
            const reopened = startApp(file);
            await reopened.getDecks();
            expect(names("cards")).toContain("idx_cards_deck");
            expect(await reopened.getCard(id)).toBeDefined();
        } finally {
            stopApp();
            tmp.cleanup();
        }
    });
});
