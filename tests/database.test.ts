import { DatabaseSync } from "node:sqlite";
import { State } from "ts-fsrs";
import { deserializeFsrsCard } from "@/models/FsrsScheduler";
import {
    advanceTime,
    DAY,
    DatabaseModule,
    failNextOpen,
    freezeTime,
    HOUR,
    makeTempDir,
    MINUTE,
    openCalls,
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

async function newDeckWithCards(count: number) {
    const db = startApp();
    const deckId = await db.addDeck("Test deck", "zh");
    const ids: number[] = [];
    for (let i = 0; i < count; i++) ids.push(await db.addCard(`front ${i}`, `back ${i}`, "", "", deckId));
    return { db, deckId, ids };
}

const dueIds = async (db: DatabaseModule, deckId: number) => (await db.getDueCards(deckId)).map((c) => c.id);

describe("startup and schema", () => {
    test("creates the schema on first use", async () => {
        const db = startApp();
        await db.getDecks();
        const tables = rawDb()
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            .all()
            .map((r) => (r as { name: string }).name);
        expect(tables).toEqual(["achievement_unlocks", "card_add_log", "card_explanations", "card_progress", "cards", "decks", "images", "review_log"]);
    });

    test("upgrades a pre-FSRS database without losing progress", async () => {
        const tmp = makeTempDir();
        try {
            const file = tmp.path("old.db");
            const old = new DatabaseSync(file);
            old.exec(`
                CREATE TABLE decks (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, language TEXT NOT NULL);
                CREATE TABLE cards (id INTEGER PRIMARY KEY AUTOINCREMENT, deck_id INTEGER NOT NULL, learning_text TEXT NOT NULL,
                    localized_text TEXT NOT NULL, example_sentence TEXT, romanization TEXT, image_id INTEGER);
                CREATE TABLE card_progress (id INTEGER PRIMARY KEY AUTOINCREMENT, card_id INTEGER NOT NULL UNIQUE,
                    review_count INTEGER NOT NULL DEFAULT 0, next_review_at INTEGER, mastered INTEGER NOT NULL DEFAULT 0);
                INSERT INTO decks (name, language) VALUES ('Old', 'zh');
                INSERT INTO cards (deck_id, learning_text, localized_text) VALUES (1, 'a', 'A'), (1, 'b', 'B');
                INSERT INTO card_progress (card_id, review_count, next_review_at, mastered) VALUES (1, 9, ${T0 + 3 * DAY}, 1);
            `);
            old.close();

            const db = startApp(file);
            const progress = await db.getCardProgress(1);
            expect(progress).toMatchObject({ reviewCount: 9, nextReviewAt: T0 + 3 * DAY, mastered: true });
            expect(progress?.fsrsCard).toBeUndefined();
            expect(progress?.lastReviewAt).toBeUndefined();
            // A card from an older version that never had a progress row gets one.
            expect(await db.getCardProgress(2)).toMatchObject({ reviewCount: 0, mastered: false });
        } finally {
            stopApp();
            tmp.cleanup();
        }
    });

    test("a failed start is not cached: the next call retries and works", async () => {
        const db = startApp();
        failNextOpen();
        await expect(db.getDecks()).rejects.toThrow("simulated open failure");
        await expect(db.getDecks()).resolves.toEqual([]);
        expect(openCalls()).toBe(2);
    });

    test("two screens asking at once open the database only once", async () => {
        const db = startApp();
        await Promise.all([db.getDecks(), db.getDecks()]);
        expect(openCalls()).toBe(1);
    });
});

describe("card lifecycle", () => {
    test("a new card gets a progress row and is due immediately", async () => {
        const { db, deckId, ids } = await newDeckWithCards(1);
        expect(await db.getCardProgress(ids[0])).toMatchObject({ reviewCount: 0, mastered: false });
        expect(await dueIds(db, deckId)).toEqual(ids);
        expect(await db.getProgressCounts(deckId)).toEqual({ due: 1, practiced: 0, mastered: 0 });
    });

    test("deleting a card also deletes its progress", async () => {
        const { db, ids } = await newDeckWithCards(2);
        await db.deleteCard(ids[0]);
        expect(await db.getCardProgress(ids[0])).toBeUndefined();
        expect(await db.getCardProgress(ids[1])).toBeDefined();
    });

    test("deleting a deck deletes its cards and progress", async () => {
        const { db, deckId } = await newDeckWithCards(3);
        await db.deleteDeck(deckId);
        const counts = rawDb()
            .prepare("SELECT (SELECT COUNT(*) FROM cards) AS c, (SELECT COUNT(*) FROM card_progress) AS p")
            .get() as { c: number; p: number };
        expect(counts).toEqual({ c: 0, p: 0 });
    });

    test("editing a card does not touch its progress", async () => {
        const { db, deckId, ids } = await newDeckWithCards(1);
        await db.markCardCorrect(ids[0]);
        const before = await db.getCardProgress(ids[0]);
        await db.updateCard(ids[0], "new front", "new back", "ex", "rom");
        expect(await db.getCardProgress(ids[0])).toEqual(before);
        expect((await db.getCardsPage(deckId, 10, 0))[0].learningText).toBe("new front");
    });

    test("resetCardProgress makes a reviewed card brand new again", async () => {
        const { db, deckId, ids } = await newDeckWithCards(1);
        await db.markCardCorrect(ids[0]);
        await db.resetCardProgress(ids[0]);
        expect(await db.getCardProgress(ids[0])).toMatchObject({
            reviewCount: 0,
            mastered: false,
            nextReviewAt: undefined,
            fsrsCard: undefined,
            lastReviewAt: undefined,
        });
        expect(await dueIds(db, deckId)).toEqual(ids);
    });
});

describe("reviewing cards", () => {
    test("Good on a new card persists FSRS state and hides the card for 10 minutes", async () => {
        const { db, deckId, ids } = await newDeckWithCards(1);
        await db.markCardCorrect(ids[0]);

        const progress = await db.getCardProgress(ids[0]);
        expect(progress?.reviewCount).toBe(1);
        expect(progress?.lastReviewAt).toBe(T0);
        expect(progress?.nextReviewAt).toBe(T0 + 10 * MINUTE);
        const fsrs = deserializeFsrsCard(progress!.fsrsCard!);
        expect(fsrs.state).toBe(State.Learning);
        expect(fsrs.due.getTime()).toBe(progress!.nextReviewAt);

        expect(await dueIds(db, deckId)).toEqual([]);
        advanceTime(10 * MINUTE - 1);
        expect(await dueIds(db, deckId)).toEqual([]);
        advanceTime(1);
        expect(await dueIds(db, deckId)).toEqual(ids);
    });

    test("Again on a new card brings it back in 1 minute", async () => {
        const { db, deckId, ids } = await newDeckWithCards(1);
        await db.markCardIncorrect(ids[0]);
        expect((await db.getCardProgress(ids[0]))?.nextReviewAt).toBe(T0 + MINUTE);
        expect(await dueIds(db, deckId)).toEqual([]);
        advanceTime(MINUTE);
        expect(await dueIds(db, deckId)).toEqual(ids);
    });

    test("two Goods graduate a card to Review, scheduled at least a day out", async () => {
        const { db, ids } = await newDeckWithCards(1);
        await db.markCardCorrect(ids[0]);
        advanceTime(10 * MINUTE);
        await db.markCardCorrect(ids[0]);

        const progress = await db.getCardProgress(ids[0]);
        expect(deserializeFsrsCard(progress!.fsrsCard!).state).toBe(State.Review);
        expect(progress!.nextReviewAt! - Date.now()).toBeGreaterThanOrEqual(DAY);
    });

    test("a lapsed Review card goes to Relearning and returns in 10 minutes", async () => {
        const { db, ids } = await newDeckWithCards(1);
        await db.markCardCorrect(ids[0]);
        advanceTime(10 * MINUTE);
        await db.markCardCorrect(ids[0]);
        advanceTime(3 * DAY);
        await db.markCardIncorrect(ids[0]);

        const progress = await db.getCardProgress(ids[0]);
        const fsrs = deserializeFsrsCard(progress!.fsrsCard!);
        expect(fsrs.state).toBe(State.Relearning);
        expect(fsrs.lapses).toBe(1);
        expect(progress!.nextReviewAt).toBe(Date.now() + 10 * MINUTE);
    });

    test("the stored due date always matches the FSRS due date", async () => {
        const { db, ids } = await newDeckWithCards(1);
        for (const answer of ["right", "left", "right", "right"] as const) {
            advanceTime(2 * DAY);
            await (answer === "right" ? db.markCardCorrect(ids[0]) : db.markCardIncorrect(ids[0]));
            const progress = await db.getCardProgress(ids[0]);
            expect(deserializeFsrsCard(progress!.fsrsCard!).due.getTime()).toBe(progress!.nextReviewAt);
        }
    });

    test("only the answered card changes", async () => {
        const { db, ids } = await newDeckWithCards(3);
        const before = await db.getCardProgress(ids[1]);
        await db.markCardCorrect(ids[0]);
        await db.markCardIncorrect(ids[2]);
        expect(await db.getCardProgress(ids[1])).toEqual(before);
    });

    test("reviewing a card that no longer exists is a no-op", async () => {
        const { db } = await newDeckWithCards(1);
        await expect(db.markCardCorrect(99999)).resolves.toBeUndefined();
    });

    test("Undo (restoreCardProgress) restores the exact previous row", async () => {
        const { db, deckId, ids } = await newDeckWithCards(1);
        const before = (await db.getCardProgress(ids[0]))!;
        await db.markCardCorrect(ids[0]);
        await db.restoreCardProgress(before);
        expect(await db.getCardProgress(ids[0])).toEqual(before);
        expect(await dueIds(db, deckId)).toEqual(ids);
    });

    test("updateCardProgress keeps FSRS data when the caller omits it (CSV import path)", async () => {
        const { db, ids } = await newDeckWithCards(1);
        await db.markCardCorrect(ids[0]);
        const before = (await db.getCardProgress(ids[0]))!;
        await db.updateCardProgress(ids[0], 4, T0 + DAY, false);
        const after = (await db.getCardProgress(ids[0]))!;
        expect(after.fsrsCard).toBe(before.fsrsCard);
        expect(after.lastReviewAt).toBe(before.lastReviewAt);
        expect(after).toMatchObject({ reviewCount: 4, nextReviewAt: T0 + DAY });
    });
});

describe("due cards and counts", () => {
    test("getDueCards returns each due card exactly once, oldest due first", async () => {
        const { db, deckId } = await newDeckWithCards(0);
        const raw = rawDb();
        seedCard(raw, deckId, 1, { review_count: 3, next_review_at: T0 - 1 * DAY });
        seedCard(raw, deckId, 2, { review_count: 3, next_review_at: T0 - 3 * DAY });
        seedCard(raw, deckId, 3, { review_count: 3, next_review_at: T0 + 1 * DAY }); // not due
        seedCard(raw, deckId, 4, { review_count: 3, next_review_at: T0 }); // due exactly now
        expect(await dueIds(db, deckId)).toEqual([2, 1, 4]);
    });

    test("only the requested deck's cards are returned", async () => {
        const db = startApp();
        const a = await db.addDeck("A", "zh");
        const b = await db.addDeck("B", "ja");
        const cardA = await db.addCard("a", "a", "", "", a);
        await db.addCard("b", "b", "", "", b);
        expect(await dueIds(db, a)).toEqual([cardA]);
    });

    test("progress counts split cards into due / practiced / mastered", async () => {
        const { db, deckId } = await newDeckWithCards(0);
        const raw = rawDb();
        seedCard(raw, deckId, 1); // new
        seedCard(raw, deckId, 2, { review_count: 2, next_review_at: T0 - DAY }); // due
        seedCard(raw, deckId, 3, { review_count: 2, next_review_at: T0 + DAY }); // practiced
        seedCard(raw, deckId, 4, { review_count: 9, next_review_at: T0 + 20 * DAY, mastered: 1 }); // mastered
        expect(await db.getProgressCounts(deckId)).toEqual({ due: 2, practiced: 1, mastered: 1 });
    });

    test("due + practiced + mastered always add up to the deck size", async () => {
        const { db, deckId } = await newDeckWithCards(0);
        const raw = rawDb();
        seedCard(raw, deckId, 1); // new
        seedCard(raw, deckId, 2, { review_count: 4, next_review_at: T0 - DAY }); // overdue
        seedCard(raw, deckId, 3, { review_count: 4, next_review_at: T0 + DAY }); // practiced
        seedCard(raw, deckId, 4, { review_count: 9, next_review_at: T0 + 30 * DAY, mastered: 1 }); // mastered
        seedCard(raw, deckId, 5, { review_count: 9, next_review_at: T0 - DAY, mastered: 1 }); // mastered but due
        const counts = await db.getProgressCounts(deckId);
        expect(counts).toEqual({ due: 3, practiced: 1, mastered: 1 });
        expect(counts.due + counts.practiced + counts.mastered).toBe(5);
    });

    test("a mastered card that comes due moves from Mastered to To learn on its due date", async () => {
        const { db, deckId } = await newDeckWithCards(0);
        seedCard(rawDb(), deckId, 1, { review_count: 9, next_review_at: T0 + 1 * HOUR, mastered: 1 });
        expect(await db.getProgressCounts(deckId)).toEqual({ due: 0, practiced: 0, mastered: 1 });
        advanceTime(1 * HOUR);
        expect(await db.getProgressCounts(deckId)).toEqual({ due: 1, practiced: 0, mastered: 0 });
        expect(await dueIds(db, deckId)).toEqual([1]);
    });

    test("a deck with no cards reports zeros", async () => {
        const db = startApp();
        const deckId = await db.addDeck("Empty", "zh");
        expect(await db.getProgressCounts(deckId)).toEqual({ due: 0, practiced: 0, mastered: 0 });
        expect(await dueIds(db, deckId)).toEqual([]);
    });

    test("the home count and the learn queue agree about a due mastered card", async () => {
        const { db, deckId } = await newDeckWithCards(0);
        seedCard(rawDb(), deckId, 1, { review_count: 9, next_review_at: T0 - DAY, mastered: 1 });
        const queue = await dueIds(db, deckId);
        expect(queue).toEqual([1]); // the learn screen will show it...
        expect((await db.getProgressCounts(deckId)).due).toBe(queue.length); // ...so home must count it
    });

    test("failing a card repeatedly does not make it mastered", async () => {
        const { db, ids } = await newDeckWithCards(1);
        for (let i = 0; i < 8; i++) {
            await db.markCardIncorrect(ids[0]);
            advanceTime(5 * MINUTE);
        }
        expect((await db.getCardProgress(ids[0]))?.mastered).toBe(false);
    });

    test("failing a mastered card clears its mastered flag", async () => {
        const { db, deckId } = await newDeckWithCards(0);
        seedCard(rawDb(), deckId, 1, { review_count: 9, next_review_at: T0 - DAY, mastered: 1 });
        await db.markCardIncorrect(1);
        expect((await db.getCardProgress(1))?.mastered).toBe(false);
    });
});

describe("persistence across an app restart", () => {
    test("progress and due times survive closing and reopening the database file", async () => {
        const tmp = makeTempDir();
        try {
            const file = tmp.path("restart.db");
            let db = startApp(file);
            const deckId = await db.addDeck("Persist", "zh");
            const id = await db.addCard("front", "back", "", "", deckId);
            await db.markCardCorrect(id);
            const before = await db.getCardProgress(id);

            stopApp(); // app killed
            advanceTime(10 * MINUTE);
            db = startApp(file); // app relaunched

            expect(await db.getCardProgress(id)).toEqual(before);
            expect(await dueIds(db, deckId)).toEqual([id]); // the 10-minute step has now elapsed
            expect(await db.getDecks()).toHaveLength(1);
        } finally {
            stopApp();
            tmp.cleanup();
        }
    });

    test("opening an existing database twice does not duplicate progress rows", async () => {
        const tmp = makeTempDir();
        try {
            const file = tmp.path("twice.db");
            let db = startApp(file);
            const deckId = await db.addDeck("Twice", "zh");
            await db.addCard("a", "a", "", "", deckId);
            stopApp();
            db = startApp(file);
            await db.getDecks();
            const rows = rawDb().prepare("SELECT COUNT(*) AS n FROM card_progress").get() as { n: number };
            expect(rows.n).toBe(1);
        } finally {
            stopApp();
            tmp.cleanup();
        }
    });
});

describe("cards added log", () => {
    test("adding a card records when it was added, and deleting the card keeps that record", async () => {
        const { db, ids } = await newDeckWithCards(2);
        expect((await db.getCardsAdded()).addedAt).toEqual([T0, T0]);
        await db.deleteCard(ids[0]);
        const after = await db.getCardsAdded();
        expect(after.addedAt).toEqual([T0, T0]); // still counts: achievements never go backwards
        expect(after.undated).toBe(0);
    });

    test("cards from before dates were recorded are counted but have no date", async () => {
        const tmp = makeTempDir();
        try {
            const file = `${tmp.dir}/old.db`;
            const old = new DatabaseSync(file);
            old.exec(`
                CREATE TABLE decks (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, language TEXT NOT NULL);
                CREATE TABLE cards (id INTEGER PRIMARY KEY AUTOINCREMENT, deck_id INTEGER NOT NULL, learning_text TEXT NOT NULL,
                    localized_text TEXT NOT NULL, example_sentence TEXT, romanization TEXT, image_id INTEGER);
                INSERT INTO decks (name, language) VALUES ('Old', 'zh');
                INSERT INTO cards (deck_id, learning_text, localized_text) VALUES (1, 'a', 'A'), (1, 'b', 'B');
            `);
            old.close();

            const db = startApp(file);
            expect(await db.getCardsAdded()).toEqual({ addedAt: [], undated: 2 });
            await db.addCard("c", "C", "", "", 1);
            expect(await db.getCardsAdded()).toEqual({ addedAt: [T0], undated: 2 });
        } finally {
            stopApp();
            tmp.cleanup();
        }
    });
});

describe("achievement unlocks", () => {
    test("recording is permanent and repeating it changes nothing", async () => {
        const db = startApp();
        await db.recordAchievementUnlocks([{ track: "reviews", tier: 1 }, { track: "streak", tier: 1 }], T0);
        await db.recordAchievementUnlocks([{ track: "reviews", tier: 1 }, { track: "reviews", tier: 2 }], T0 + 5000);
        const all = await db.getAchievementUnlocks();
        expect(all.map((u) => `${u.track}:${u.tier}`).sort()).toEqual(["reviews:1", "reviews:2", "streak:1"]);
        expect(all.find((u) => u.track === "reviews" && u.tier === 1)?.unlockedAt).toBe(T0); // first time kept
    });
});

describe("card list shows when each card is next due", () => {
    test("new cards have no date, reviewed cards show theirs, and search still works", async () => {
        const { db, deckId, ids } = await newDeckWithCards(3);
        await db.markCardCorrect(ids[0], { prompt: "learning", durationMs: 1000 });
        const progress = await db.getCardProgress(ids[0]);
        expect(progress?.nextReviewAt).toBeGreaterThan(T0);

        const page = await db.getCardsPage(deckId, 10, 0);
        expect(page.map((c) => c.id)).toEqual(ids);
        expect(page[0].nextReviewAt).toBe(progress?.nextReviewAt);
        expect(page[1].nextReviewAt).toBeUndefined();

        const found = await db.getCardsPage(deckId, 10, 0, "front 2");
        expect(found.map((c) => c.id)).toEqual([ids[2]]);
        expect((await db.getCardsPage(deckId, 1, 1)).map((c) => c.id)).toEqual([ids[1]]);
    });
});

describe("saved card explanations", () => {
    const explanation = { definition: "A fruit.", grammar: ["Feminine."], examples: [{ text: "a", translation: "b" }] };

    test("saved once, found again, and ignored when the card's words changed", async () => {
        const { db, ids } = await newDeckWithCards(1);
        expect(await db.getCardExplanation(ids[0], "sig-1")).toBeNull();
        await db.saveCardExplanation(ids[0], "sig-1", explanation);
        expect(await db.getCardExplanation(ids[0], "sig-1")).toEqual(explanation);
        expect(await db.getCardExplanation(ids[0], "sig-2")).toBeNull(); // the card was edited

        await db.saveCardExplanation(ids[0], "sig-2", { ...explanation, definition: "New." });
        expect((await db.getCardExplanation(ids[0], "sig-2"))?.definition).toBe("New.");
        expect(await db.getCardExplanation(ids[0], "sig-1")).toBeNull(); // replaced, not kept alongside
    });

    test("deleting the card deletes its explanation", async () => {
        const { db, ids } = await newDeckWithCards(1);
        await db.saveCardExplanation(ids[0], "s", explanation);
        await db.deleteCard(ids[0]);
        const left = rawDb().prepare("SELECT COUNT(*) AS n FROM card_explanations").get() as { n: number };
        expect(left.n).toBe(0);
    });
});
