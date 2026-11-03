import { DAY, freezeTime, rawDb, seedCard, startApp, stopApp, T0, unfreezeTime } from "./helpers/testDb";

const TOTAL = 5000;

beforeEach(() => freezeTime(T0));
afterEach(() => {
    stopApp();
    unfreezeTime();
});

/** Deterministic mix: 40% new, 30% overdue, 20% scheduled later, 10% mastered (half of them due). */
async function seedLargeDeck() {
    const db = startApp();
    const deckId = await db.addDeck("Big deck", "zh");
    const raw = rawDb();
    let expectedDue = 0;
    let expectedMastered = 0;
    raw.exec("BEGIN");
    for (let id = 1; id <= TOTAL; id++) {
        const bucket = id % 10;
        if (bucket < 4) {
            seedCard(raw, deckId, id); // new
            expectedDue++;
        } else if (bucket < 7) {
            seedCard(raw, deckId, id, { review_count: 3, next_review_at: T0 - (id % 5 + 1) * DAY }); // overdue
            expectedDue++;
        } else if (bucket < 9) {
            seedCard(raw, deckId, id, { review_count: 3, next_review_at: T0 + (id % 5 + 1) * DAY }); // later
        } else {
            const due = id % 20 === 9; // half of the mastered cards are due
            seedCard(raw, deckId, id, { review_count: 9, mastered: 1, next_review_at: T0 + (due ? -DAY : 10 * DAY) });
            expectedMastered++;
            if (due) expectedDue++;
        }
    }
    raw.exec("COMMIT");
    return { db, deckId, expectedDue, expectedMastered };
}

describe(`a deck of ${TOTAL} cards`, () => {
    test("the learn queue contains every due card exactly once", async () => {
        const { db, deckId, expectedDue } = await seedLargeDeck();
        const queue = await db.getDueCards(deckId);
        expect(queue).toHaveLength(expectedDue);
        expect(new Set(queue.map((c) => c.id)).size).toBe(expectedDue);
    });

    test("pagination visits every card exactly once", async () => {
        const { db, deckId } = await seedLargeDeck();
        const seen = new Set<number>();
        for (let offset = 0; ; offset += 100) {
            const page = await db.getCardsPage(deckId, 100, offset);
            if (page.length === 0) break;
            for (const card of page) seen.add(card.id as number);
        }
        expect(seen.size).toBe(TOTAL);
    });

    test("search narrows the list without losing matches", async () => {
        const { db, deckId } = await seedLargeDeck();
        const matches = await db.getCardsPage(deckId, 1000, 0, "front 49");
        // "front 49", "front 490".."front 499", "front 4900".."front 4999" -> 1 + 10 + 100 = 111
        expect(matches).toHaveLength(111);
    });

    test("queries stay fast (generous ceiling to catch accidental N+1 or full-table scans per card)", async () => {
        const { db, deckId } = await seedLargeDeck();
        const started = performance.now();
        await db.getDueCards(deckId);
        await db.getProgressCounts(deckId);
        await db.getCardsPage(deckId, 100, 0);
        expect(performance.now() - started).toBeLessThan(1500);
    });

    test("reviewing many cards in a row keeps every other card untouched", async () => {
        const { db, deckId } = await seedLargeDeck();
        const queue = await db.getDueCards(deckId);
        const answered = queue.slice(0, 200);
        for (const card of answered) await db.markCardCorrect(card.id as number);
        const stillDue = await db.getDueCards(deckId);
        expect(stillDue).toHaveLength(queue.length - answered.length);
    });
});
