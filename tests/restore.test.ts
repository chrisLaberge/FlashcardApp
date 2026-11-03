import { DatabaseSync } from "node:sqlite";
import { freezeTime, makeTempDir, MINUTE, startApp, stopApp, T0, unfreezeTime } from "./helpers/testDb";

beforeEach(() => freezeTime(T0));
afterEach(() => {
    stopApp();
    unfreezeTime();
});

/** A backup file opened the way restoreFromBackup reads it. */
function asSource(raw: DatabaseSync) {
    return {
        getAllAsync: async <T>(sql: string, ...params: never[]) => raw.prepare(sql).all(...params) as T[],
    };
}

/** Builds a backup with the CURRENT app (decks, cards, progress, review history) and returns its file. */
async function makeBackup(path: string) {
    const db = startApp(path);
    const deckId = await db.addDeck("Russian", "ru");
    const a = await db.addCard("яблоко", "apple", "Я ем яблоко.", "yabloko", deckId);
    const b = await db.addCard("вода", "water", "", "voda", deckId);
    const imageId = await db.addImage("pixabay", "99", "https://x.test/99.webp", null, null, null, null);
    await db.setCardImage(a, imageId);
    await db.markCardCorrect(a, { prompt: "learning", durationMs: 3000 });
    await db.markCardCorrect(a, { prompt: "localized", durationMs: 4000 });
    await db.markCardIncorrect(b, { prompt: "audio", durationMs: 5000 });
    const snapshot = {
        deckId, a, b,
        cardA: await db.getCard(a),
        progressA: await db.getCardProgress(a),
        progressB: await db.getCardProgress(b),
        log: await db.getReviewLog(),
    };
    stopApp();
    return snapshot;
}

describe("restoreFromBackup", () => {
    test("restores decks, cards, images, progress and history exactly, keeping ids", async () => {
        const tmp = makeTempDir();
        try {
            const file = tmp.path("backup.db");
            const before = await makeBackup(file);

            const db = startApp(); // a new, empty app
            const result = await db.restoreFromBackup(asSource(new DatabaseSync(file, { readOnly: true })));

            expect(result).toEqual({ decks: 1, cards: 2, images: 1, reviews: 3 });
            expect((await db.getDecks())[0]).toMatchObject({ id: before.deckId, name: "Russian", language: "ru" });
            expect(await db.getCard(before.a)).toEqual(before.cardA);
            expect(await db.getCardProgress(before.a)).toEqual(before.progressA);
            expect(await db.getCardProgress(before.b)).toEqual(before.progressB);
            expect(await db.getReviewLog()).toEqual(before.log);
            expect((await db.getCardImage(before.a))?.provider_id).toBe("99");
        } finally {
            stopApp();
            tmp.cleanup();
        }
    });

    test("new cards added afterwards do not reuse restored ids", async () => {
        const tmp = makeTempDir();
        try {
            const file = tmp.path("backup.db");
            const before = await makeBackup(file);
            const db = startApp();
            await db.restoreFromBackup(asSource(new DatabaseSync(file, { readOnly: true })));
            const fresh = await db.addCard("новая", "new", "", "", before.deckId);
            expect(fresh).toBeGreaterThan(Math.max(before.a, before.b));
        } finally {
            stopApp();
            tmp.cleanup();
        }
    });

    test("forgets the old copy of picture files (they lived in another app's storage)", async () => {
        const tmp = makeTempDir();
        try {
            const file = tmp.path("backup.db");
            const before = await makeBackup(file);
            const raw = new DatabaseSync(file);
            raw.exec("UPDATE images SET local_path = 'file:///old-app/images/1.webp'");
            const db = startApp();
            await db.restoreFromBackup(asSource(raw));
            expect((await db.getCardImage(before.a))?.local_path).toBeNull();
        } finally {
            stopApp();
            tmp.cleanup();
        }
    });

    test("refuses to restore into an app that already has data, and changes nothing", async () => {
        const tmp = makeTempDir();
        try {
            const file = tmp.path("backup.db");
            await makeBackup(file);

            const db = startApp();
            const deckId = await db.addDeck("Mine", "zh");
            await db.addCard("好", "good", "", "", deckId);

            await expect(db.restoreFromBackup(asSource(new DatabaseSync(file, { readOnly: true })))).rejects.toBeInstanceOf(
                db.RestoreError,
            );
            expect(await db.getDecks()).toHaveLength(1);
            expect((await db.getCards(deckId)).map((c) => c.learningText)).toEqual(["好"]);
        } finally {
            stopApp();
            tmp.cleanup();
        }
    });

    test("a file that is not a backup is rejected", async () => {
        const db = startApp();
        const notABackup = new DatabaseSync(":memory:");
        notABackup.exec("CREATE TABLE something_else (id INTEGER)");
        await expect(db.restoreFromBackup(asSource(notABackup))).rejects.toBeInstanceOf(db.RestoreError);
    });

    test("a backup from before FSRS, levels, images and the review log is accepted", async () => {
        const old = new DatabaseSync(":memory:");
        old.exec(`
            CREATE TABLE decks (id INTEGER PRIMARY KEY, name TEXT, language TEXT);
            CREATE TABLE cards (id INTEGER PRIMARY KEY, deck_id INTEGER, learning_text TEXT, localized_text TEXT,
                                example_sentence TEXT, romanization TEXT);
            CREATE TABLE card_progress (id INTEGER PRIMARY KEY, card_id INTEGER, review_count INTEGER,
                                        next_review_at INTEGER, mastered INTEGER);
            INSERT INTO decks VALUES (4, 'Chinese', 'zh');
            INSERT INTO cards VALUES (1, 4, '你好', 'hello', NULL, 'nǐ hǎo'), (2, 4, '谢谢', 'thanks', NULL, NULL);
            INSERT INTO card_progress VALUES (1, 1, 12, ${T0 + 1000 * MINUTE}, 1), (2, 2, 1, ${T0}, 0);
        `);
        const db = startApp();
        const result = await db.restoreFromBackup(asSource(old));

        expect(result).toEqual({ decks: 1, cards: 2, images: 0, reviews: 0 });
        const known = (await db.getCardProgress(1))!;
        expect(known).toMatchObject({ reviewCount: 12, mastered: true, level: 4 });
        expect(known.fsrsCard).toBeUndefined(); // converted on its first review, like any old card
        expect((await db.getCardProgress(2))).toMatchObject({ reviewCount: 1, mastered: false, level: 0 });
        expect((await db.getCard(1))?.romanization).toBe("nǐ hǎo");
    });

    test("all or nothing: a failure part-way through restores nothing", async () => {
        const broken = new DatabaseSync(":memory:");
        broken.exec(`
            CREATE TABLE decks (id INTEGER PRIMARY KEY, name TEXT, language TEXT);
            CREATE TABLE cards (id INTEGER PRIMARY KEY, deck_id INTEGER, learning_text TEXT, localized_text TEXT);
            CREATE TABLE card_progress (card_id INTEGER, review_count INTEGER);
            INSERT INTO decks VALUES (1, 'D', 'ru');
            INSERT INTO cards VALUES (1, 1, 'a', 'b');
            INSERT INTO card_progress VALUES (1, 3), (1, 4);
        `); // two progress rows for one card break the app's one-per-card rule
        const db = startApp();
        await expect(db.restoreFromBackup(asSource(broken))).rejects.toThrow();
        expect(await db.getDecks()).toEqual([]);
        // and the app is still usable
        const deckId = await db.addDeck("After", "ru");
        expect(deckId).toBeGreaterThan(0);
    });

    test("cards of a missing deck and progress of a missing card are dropped, not restored half-broken", async () => {
        const messy = new DatabaseSync(":memory:");
        messy.exec(`
            CREATE TABLE decks (id INTEGER PRIMARY KEY, name TEXT, language TEXT);
            CREATE TABLE cards (id INTEGER PRIMARY KEY, deck_id INTEGER, learning_text TEXT, localized_text TEXT, image_id INTEGER);
            CREATE TABLE card_progress (id INTEGER PRIMARY KEY, card_id INTEGER, review_count INTEGER);
            INSERT INTO decks VALUES (1, 'D', 'ru');
            INSERT INTO cards VALUES (1, 1, 'ok', 'ok', 77), (2, 9, 'lost', 'lost', NULL);
            INSERT INTO card_progress VALUES (1, 1, 2), (2, 2, 5), (3, 55, 1);
        `);
        const db = startApp();
        const result = await db.restoreFromBackup(asSource(messy));
        expect(result.cards).toBe(1);
        expect((await db.getCards(1)).map((c) => c.learningText)).toEqual(["ok"]);
        expect(await db.getCardProgress(2)).toBeUndefined();
    });
});
