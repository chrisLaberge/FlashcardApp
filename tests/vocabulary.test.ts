import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { analyzeText } from "@/models/BookAnalysis";
import { createRussianAnalyzer, type AzMorph } from "@/models/language/russian";
import type { Analyzer } from "@/models/language/types";
import { coveragePercent, isLearned, KNOWN_MIN_LEVEL, knownFromCards, lemmaKey } from "@/models/Vocabulary";
import { freezeTime, makeTempDir, rawDb, startApp, stopApp, T0, unfreezeTime } from "./helpers/testDb";

// startApp() loads a fresh copy of the database module, so the service must be loaded after it to share that copy.
const service = () => require("@/services/vocabulary") as typeof import("@/services/vocabulary"); // eslint-disable-line @typescript-eslint/no-require-imports

// The real Russian dictionary, run in Node. (The phone loads the same files another way.)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Az = require("az") as { Morph: AzMorph & { init(dir: string, done: (err?: Error) => void): void } };
let russian: Analyzer;
beforeAll(async () => {
    await new Promise<void>((resolve, reject) => Az.Morph.init(path.join(__dirname, "../node_modules/az/dicts"), (err) => (err ? reject(err) : resolve())));
    russian = createRussianAnalyzer(Az.Morph);
});

beforeEach(() => freezeTime(T0));
afterEach(() => {
    stopApp();
    unfreezeTime();
});

describe("lemmas", () => {
    test("different forms of a word map to the same lemma", () => {
        for (const form of ["книга", "книги", "книгу", "книгой", "Книге"]) expect(russian.lemma(form)).toEqual({ lemma: "книга", confident: true });
        expect(russian.lemma("иду").lemma).toBe("идти");
        expect(russian.lemma("шёл").lemma).toBe("идти");
    });

    test("a word that is not in the dictionary stays as itself and is marked unsure", () => {
        expect(russian.lemma("Блаблабла")).toEqual({ lemma: "блаблабла", confident: false });
    });

    test("a word with two likely lemmas is not guessed", () => {
        expect(russian.lemma("замок").confident).toBe(false);
    });

    test("е and ё are the same letter for matching", () => {
        expect(lemmaKey("Зелёный")).toBe(lemmaKey("зеленый"));
    });
});

describe("counting a book", () => {
    test("every occurrence counts, forms share a lemma, numbers and punctuation are not words", async () => {
        const stats = await analyzeText("Книга! Я читаю книгу, 2024 книги... книгой 12.", russian);
        expect(stats.total).toBe(6); // книга, я, читаю, книгу, книги, книгой
        expect(stats.lemmas.get("книга")?.count).toBe(5 - 1); // книга, книгу, книги, книгой
        expect(stats.lemmas.get("читать")?.count).toBe(1);
        expect(stats.lemmas.has("2024")).toBe(false);
    });

    test("the sample is the form seen most often", async () => {
        const stats = await analyzeText("книги книги книгу", russian);
        expect(stats.lemmas.get("книга")).toEqual({ count: 3, sample: "книги", ignored: false });
    });

    test("text with no words gives a total of zero", async () => {
        expect((await analyzeText("12 34 ... !!", russian)).total).toBe(0);
        expect((await analyzeText("", russian)).total).toBe(0);
    });

    test("a long text is counted in pieces and reports progress", async () => {
        const seen: number[] = [];
        const stats = await analyzeText("кот ".repeat(5000), russian, (done) => seen.push(done));
        expect(stats.total).toBe(5000);
        expect(seen.length).toBeGreaterThan(1);
        expect(seen[seen.length - 1]).toBe(5000);
    });
});

describe("the rules", () => {
    test("coverage is known occurrences over all occurrences, to one decimal", () => {
        expect(coveragePercent(7500, 10000)).toBe(75);
        expect(coveragePercent(1, 3)).toBe(33.3);
        expect(coveragePercent(2, 3)).toBe(66.7);
        expect(coveragePercent(0, 0)).toBe(0);
        expect(coveragePercent(5, 0)).toBe(0);
        expect(coveragePercent(12, 10)).toBe(100);
    });

    test("a card is learned from the set level, or when mastered; one good review is not enough", () => {
        expect(isLearned({ level: 1, mastered: false })).toBe(false);
        expect(isLearned({ level: KNOWN_MIN_LEVEL, mastered: false })).toBe(true);
        expect(isLearned({ level: 0, mastered: true })).toBe(true);
    });

    test("the same word in several decks counts once; phrases are ignored", () => {
        const known = knownFromCards([
            { lemma: "книга", level: 6, mastered: false },
            { lemma: "книга", level: 0, mastered: false },
            { lemma: "кот", level: 2, mastered: false },
            { lemma: null, level: 8, mastered: true },
        ]);
        expect([...known]).toEqual(["книга"]);
    });
});

describe("the known-word bank and book coverage", () => {
    async function setup() {
        const db = startApp();
        const a = await db.addMyText("Один", "ru", "Книга и кот. Книги и кот. Я иду.");
        const b = await db.addMyText("Два", "ru", "Кот читает книгу.");
        const other = await db.addMyText("Fr", "fr", "livre livre");
        await service().analyzeBook(a, russian);
        await service().analyzeBook(b, russian);
        const coverage = async (id: number) => (await db.getBookSummaries("ru")).find((s) => s.id === id)!;
        return { db, a, b, other, coverage };
    }

    test("a new book is stored with its total and every lemma, known or not", async () => {
        const { db, a, coverage } = await setup();
        expect((await coverage(a)).totalTokens).toBe(8); // книга и кот книги и кот я иду
        expect((await coverage(a)).knownTokens).toBe(0);
        expect((await db.getTopUnknown(a))[0]).toMatchObject({ count: 2 });
    });

    test("marking a word known raises coverage in every book that has it, counting each occurrence", async () => {
        const { db, a, b, coverage } = await setup();
        await db.setWordKnown("ru", "книга", true);
        expect((await coverage(a)).knownTokens).toBe(2); // книга + книги
        expect((await coverage(b)).knownTokens).toBe(1);
        await db.setWordKnown("ru", "кот", true);
        expect((await coverage(a)).knownTokens).toBe(4);
        expect((await coverage(b)).knownTokens).toBe(2);
        expect((await db.getTopUnknown(a)).map((w) => w.lemma)).not.toContain("кот");
    });

    test("marking it not known again lowers coverage", async () => {
        const { db, a, coverage } = await setup();
        await db.setWordKnown("ru", "книга", true);
        await db.setWordKnown("ru", "книга", false);
        expect((await coverage(a)).knownTokens).toBe(0);
        await db.setWordKnown("ru", "книга", null); // forget the choice
        expect((await coverage(a)).knownTokens).toBe(0);
    });

    test("a word is known by cards in any deck, once, and stops when the cards no longer say so", async () => {
        const { db, a, coverage } = await setup();
        const d1 = await db.addDeck("One", "ru");
        const d2 = await db.addDeck("Two", "ru");
        const c1 = await db.addCard("книги", "books", "", "", d1);
        await db.addCard("книга", "book", "", "", d2);
        await db.addCard("я иду", "I go", "", "", d1); // a phrase: not a word
        const raw = rawDb();
        raw.prepare("UPDATE card_progress SET level = 6 WHERE card_id = ?").run(c1);

        await service().syncKnownWords("ru", russian);
        expect((await coverage(a)).knownTokens).toBe(2); // книга + книги, nothing from the phrase
        expect(raw.prepare("SELECT COUNT(*) AS n FROM known_words WHERE lemma = 'книга'").get()).toEqual({ n: 1 });

        raw.prepare("UPDATE card_progress SET level = 0 WHERE card_id = ?").run(c1);
        await service().syncKnownWords("ru", russian);
        expect((await coverage(a)).knownTokens).toBe(0);
    });

    test("the library refresh only does the work when the cards changed", async () => {
        const { db } = await setup();
        const d = await db.addDeck("One", "ru");
        const c = await db.addCard("книга", "book", "", "", d);
        let loads = 0;
        const load = async () => { loads++; return russian; };

        expect(await service().syncIfCardsChanged("ru", load)).toBe(true); // first time
        expect(await service().syncIfCardsChanged("ru", load)).toBe(false); // nothing changed: no dictionary load
        expect(loads).toBe(1);

        rawDb().prepare("UPDATE card_progress SET level = 6 WHERE card_id = ?").run(c);
        expect(await service().syncIfCardsChanged("ru", load)).toBe(true);
        expect(loads).toBe(2);
        expect([...(await db.getKnownLemmas("ru"))]).toContain("книга");
    });

    test("what you set yourself beats the cards, both ways", async () => {
        const { db, a, coverage } = await setup();
        const deck = await db.addDeck("One", "ru");
        const id = await db.addCard("кот", "cat", "", "", deck);
        const raw = rawDb();
        raw.prepare("UPDATE card_progress SET level = 7 WHERE card_id = ?").run(id);

        await db.setWordKnown("ru", "кот", false); // "I do not know it", though the card says so
        await service().syncKnownWords("ru", russian);
        expect((await coverage(a)).knownTokens).toBe(0);

        await db.setWordKnown("ru", "я", true); // known by hand, no card
        await service().syncKnownWords("ru", russian);
        expect((await coverage(a)).knownTokens).toBe(1);
    });

    test("a book with no words has 0 coverage and is still saved as analysed", async () => {
        const { db } = await setup();
        const empty = await db.addMyText("Пусто", "ru", "123 ... !!");
        expect(await service().analyzeBook(empty, russian)).toBe(0);
        const row = (await db.getBookSummaries("ru")).find((s) => s.id === empty)!;
        expect(row).toMatchObject({ totalTokens: 0, knownTokens: 0, analyzerVersion: russian.version });
    });

    test("books are analysed again only when the analyser version changes", async () => {
        const { db, a } = await setup();
        let calls = 0;
        const counting: Analyzer = { ...russian, lemma: (w) => { calls++; return russian.lemma(w); } };
        await service().analyzeNewBooks("ru", counting);
        expect(calls).toBe(0);

        await service().analyzeNewBooks("ru", { ...counting, version: russian.version + 1 });
        expect(calls).toBeGreaterThan(0);
        expect((await db.getBookSummaries("ru")).find((s) => s.id === a)?.analyzerVersion).toBe(russian.version + 1);
    });

    test("other languages and deleted books do not leak in", async () => {
        const { db, a, other } = await setup();
        expect(await service().analyzeBook(other, russian)).toBe(0); // wrong language: untouched
        await db.deleteMyText(a);
        const raw = rawDb();
        expect(raw.prepare("SELECT COUNT(*) AS n FROM book_vocab WHERE book_id = ?").get(a)).toEqual({ n: 0 });
    });
});

describe("migration", () => {
    test("an older database keeps its cards and review progress and gains the new tables", async () => {
        const tmp = makeTempDir();
        try {
            const file = `${tmp.dir}/old.db`;
            const old = new DatabaseSync(file);
            old.exec(`
                CREATE TABLE decks (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, language TEXT NOT NULL);
                CREATE TABLE cards (id INTEGER PRIMARY KEY AUTOINCREMENT, deck_id INTEGER NOT NULL, learning_text TEXT NOT NULL,
                    localized_text TEXT NOT NULL, example_sentence TEXT, romanization TEXT, image_id INTEGER);
                CREATE TABLE card_progress (id INTEGER PRIMARY KEY AUTOINCREMENT, card_id INTEGER NOT NULL UNIQUE, review_count INTEGER NOT NULL DEFAULT 0,
                    next_review_at INTEGER, mastered INTEGER NOT NULL DEFAULT 0, fsrs_card TEXT, last_review_at INTEGER, level INTEGER NOT NULL DEFAULT 0);
                CREATE TABLE my_texts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, language TEXT NOT NULL, body TEXT NOT NULL, added_at INTEGER NOT NULL);
                INSERT INTO decks (name, language) VALUES ('Old', 'ru');
                INSERT INTO cards (deck_id, learning_text, localized_text) VALUES (1, 'книга', 'book');
                INSERT INTO card_progress (card_id, review_count, level, mastered) VALUES (1, 4, 6, 0);
                INSERT INTO my_texts (title, language, body, added_at) VALUES ('Old book', 'ru', 'Книга кот', 1);
            `);
            old.close();

            const db = startApp(file);
            const cards = await db.getCards(1);
            expect(cards.map((c) => c.learningText)).toEqual(["книга"]);
            expect(await db.getCardProgress(cards[0].id!)).toMatchObject({ reviewCount: 4, level: 6 });
            const books = await db.getBookSummaries("ru");
            expect(books).toEqual([{ id: 1, title: "Old book", language: "ru", totalTokens: null, analyzerVersion: null, knownTokens: 0, ignoredTokens: 0 }]);

            await service().analyzeNewBooks("ru", russian); // the old book is picked up
            expect((await db.getBookSummaries("ru"))[0].totalTokens).toBe(2);
        } finally {
            stopApp();
            tmp.cleanup();
        }
    });
});
