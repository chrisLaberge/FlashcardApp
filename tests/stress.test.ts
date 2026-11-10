import path from "node:path";
import { analyzeText } from "@/models/BookAnalysis";
import { createRussianAnalyzer, type AzMorph } from "@/models/language/russian";
import type { Analyzer } from "@/models/language/types";
import { coveragePercent, lemmaKey } from "@/models/Vocabulary";
import { freezeTime, rawDb, startApp, stopApp, T0, unfreezeTime } from "./helpers/testDb";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Az = require("az") as { Morph: AzMorph & { init(dir: string, done: (err?: Error) => void): void } };
let russian: Analyzer;
beforeAll(async () => {
    await new Promise<void>((res, rej) => Az.Morph.init(path.join(__dirname, "../node_modules/az/dicts"), (e) => (e ? rej(e) : res())));
    russian = createRussianAnalyzer(Az.Morph);
});
beforeEach(() => freezeTime(T0));
afterEach(() => { stopApp(); unfreezeTime(); });
const service = () => require("@/services/vocabulary") as typeof import("@/services/vocabulary"); // eslint-disable-line @typescript-eslint/no-require-imports

const lemmasPool = ["книга", "кот", "дом", "идти", "читать", "мама", "собака", "город", "вода", "хороший", "большой", "делать", "говорить", "видеть", "знать", "работа", "время", "человек", "рука", "день"];
const forms = (w: string) => [w, w + "а", w + "у", w + "ой", w + "и", w.slice(0, -1) + "е"];

function bigText(words: number, seed = 1): string {
    let s = seed; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const out: string[] = [];
    for (let i = 0; i < words; i++) {
        const base = lemmasPool[Math.floor(rnd() * lemmasPool.length)];
        const f = forms(base)[Math.floor(rnd() * 6)];
        out.push(i % 17 === 0 ? `${f}.` : i % 29 === 0 ? `${f}, 123` : f);
    }
    return out.join(" ");
}

test("a 300,000-word book is analysed in reasonable time, and coverage matches a brute-force count", async () => {
    const text = bigText(300_000);
    const t0 = performance.now();
    const stats = await analyzeText(text, russian);
    const analyseMs = performance.now() - t0;
    expect(stats.total).toBe(300_000);
    expect(analyseMs).toBeLessThan(20_000);

    const db = startApp();
    const id = await db.addMyText("Big", "ru", "x");
    await db.saveBookAnalysis(id, russian.version, stats.total, stats.lemmas);

    for (const w of ["книга", "кот", "дом"]) await db.setWordKnown("ru", lemmaKey(w), true);
    const brute = [...stats.lemmas].filter(([l]) => ["книга", "кот", "дом"].includes(l)).reduce((a, [, e]) => a + e.count, 0);
    const summary = (await db.getBookSummaries("ru"))[0];
    expect(summary.knownTokens).toBe(brute);
    expect(coveragePercent(summary.knownTokens, summary.totalTokens!)).toBeGreaterThan(0);
    // the sum of all counts equals the total (nothing lost, nothing double counted)
    const sum = rawDb().prepare("SELECT SUM(count) AS n FROM book_vocab WHERE book_id = ?").get(id) as { n: number };
    expect(sum.n).toBe(stats.total);
});

test("many books and a large known-word bank: summaries and sync stay fast", async () => {
    const db = startApp();
    const ids: number[] = [];
    for (let b = 0; b < 30; b++) {
        const id = await db.addMyText(`B${b}`, "ru", "x");
        const stats = await analyzeText(bigText(5000, b + 1), russian);
        await db.saveBookAnalysis(id, russian.version, stats.total, stats.lemmas);
        ids.push(id);
    }
    const deck = await db.addDeck("D", "ru");
    for (let i = 0; i < 4000; i++) await db.addCard(i % 50 === 0 ? `фраза номер ${i}` : forms(lemmasPool[i % 20])[i % 6] + (i > 100 ? String(i) : ""), "m", "", "", deck);
    rawDb().prepare("UPDATE card_progress SET level = 6").run();

    const t0 = performance.now();
    await service().syncKnownWords("ru", russian);
    const syncMs = performance.now() - t0;
    const t1 = performance.now();
    const summaries = await db.getBookSummaries("ru");
    const sumMs = performance.now() - t1;
    expect(summaries.length).toBe(30);
    expect(syncMs).toBeLessThan(10_000);
    expect(sumMs).toBeLessThan(2_000);
    for (const s of summaries) expect(s.knownTokens).toBeLessThanOrEqual(s.totalTokens!);
});

test("hostile text does not crash or hang", async () => {
    const nasty = ["", " ", "\u0000\u0001", "a".repeat(100_000), "я ".repeat(50_000), "-".repeat(10_000), "😀 ".repeat(5000), "ё".repeat(300), "книга́", "КНИГА книга Книга"];
    for (const text of nasty) {
        const s = await analyzeText(text, russian);
        expect(Number.isFinite(s.total)).toBe(true);
    }
    expect((await analyzeText("КНИГА книга Книга", russian)).lemmas.get("книга")?.count).toBe(3);
});

test("two analyses of the same book at the same time leave consistent data", async () => {
    const db = startApp();
    const id = await db.addMyText("Race", "ru", "книга кот книги");
    await Promise.all([service().analyzeBook(id, russian), service().analyzeBook(id, russian), service().analyzeBook(id, russian)]);
    const sum = rawDb().prepare("SELECT SUM(count) AS n, COUNT(*) AS c FROM book_vocab WHERE book_id = ?").get(id) as { n: number; c: number };
    expect(sum).toEqual({ n: 3, c: 2 });
});
