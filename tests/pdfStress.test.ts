import { analyzeText } from "@/models/BookAnalysis";
import { bookText, plainAnalyzer } from "@/models/ReaderWords";
import { chunkCount, CHUNK_BYTES, friendlyPdfError } from "@/models/PdfErrors";
import { freezeTime, startApp, stopApp, T0, unfreezeTime } from "./helpers/testDb";

beforeEach(() => freezeTime(T0));
afterEach(() => { stopApp(); unfreezeTime(); });

const syllables = ["ca", "sa", "pe", "rro", "la", "ni", "ña", "ju", "ega", "mon", "ta", "ñas", "so", "ol", "bri", "lla"];
function words(count: number, seed = 7): string[] {
    let s = seed; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
        const n = 1 + Math.floor(rnd() * 3);
        let w = "";
        for (let k = 0; k < n; k++) w += syllables[Math.floor(rnd() * syllables.length)];
        out.push(w);
    }
    return out;
}

describe("big books", () => {
    test("a 1,000,000-word book (names, foreign words, punctuation) is counted without trouble", async () => {
        const w = words(1_000_000);
        const parts: string[] = [];
        for (let i = 0; i < w.length; i++) {
            const word = i % 40 === 0 ? w[i][0].toUpperCase() + w[i].slice(1) : w[i];
            parts.push(i % 13 === 0 ? `${word}.` : i % 29 === 0 ? `${word}, 123 —` : word);
            if (i % 5000 === 0) parts.push("Il est très tard et je ne sais pas où nous sommes avec les enfants.");
        }
        const text = parts.join(" ");
        const t0 = performance.now();
        const stats = await analyzeText(text, plainAnalyzer("es"));
        const ms = performance.now() - t0;
        expect(stats.total).toBeGreaterThan(1_000_000);
        expect(stats.lemmas.size).toBeGreaterThan(100);
        expect(ms).toBeLessThan(30_000);
        console.log(`1M words counted in ${Math.round(ms)} ms, ${stats.lemmas.size} distinct`);
    }, 60_000);

    test("saving 60,000 distinct words and reading the summary stays fast", async () => {
        const db = startApp();
        const id = await db.addMyText("Gran libro", "es", "x", 1, "file:///a.pdf");
        const lemmas = new Map<string, { count: number; sample: string; ignored?: boolean }>();
        for (let i = 0; i < 60_000; i++) lemmas.set(`palabra${i}`, { count: 1 + (i % 9), sample: `palabra${i}`, ignored: i % 50 === 0 });
        const t0 = performance.now();
        await db.saveBookAnalysis(id, 3, 300_000, lemmas);
        const saveMs = performance.now() - t0;
        for (let i = 0; i < 20_000; i++) if (i % 2 === 0) await db.setWordKnown("es", `palabra${i}`, true);
        const t1 = performance.now();
        const summary = await db.getBookSummary(id);
        const top = await db.getTopUnknown(id, 100);
        const names = await db.getBookIgnored(id);
        const readMs = performance.now() - t1;
        expect(summary?.totalTokens).toBe(300_000);
        expect(top).toHaveLength(100);
        expect(names.size).toBe(800); // 1,200 guessed, minus 400 you marked known yourself
        expect(summary!.knownTokens).toBeGreaterThan(0);
        expect(saveMs).toBeLessThan(20_000);
        expect(readMs).toBeLessThan(5_000);
        console.log(`save ${Math.round(saveMs)} ms, read ${Math.round(readMs)} ms`);
    }, 120_000);

    test("40 books, each with 5,000 words, list quickly", async () => {
        const db = startApp();
        for (let b = 0; b < 40; b++) {
            const id = await db.addMyText(`Libro ${b}`, "es", "x", 1000 + b, `file:///${b}.pdf`);
            const lemmas = new Map<string, { count: number; sample: string }>();
            for (let i = 0; i < 5000; i++) lemmas.set(`w${i}`, { count: 2, sample: `w${i}` });
            await db.saveBookAnalysis(id, 3, 10_000, lemmas);
        }
        for (let i = 0; i < 2000; i++) await db.setWordKnown("es", `w${i}`, true);
        const t0 = performance.now();
        const list = await db.getBookSummaries("es");
        const ms = performance.now() - t0;
        expect(list).toHaveLength(40);
        expect(list[0].knownTokens).toBe(4000);
        expect(ms).toBeLessThan(3_000);
        console.log(`40-book list in ${Math.round(ms)} ms`);
    }, 120_000);
});

describe("hostile text", () => {
    test("very long words, odd unicode, empty and symbol-only text do not break counting", async () => {
        const es = plainAnalyzer("es");
        expect((await analyzeText("", es)).total).toBe(0);
        expect((await analyzeText("   \n\n  ", es)).total).toBe(0);
        expect((await analyzeText("1234 5678 --- ... !!!", es)).total).toBe(0);
        const long = await analyzeText(`${"a".repeat(50_000)} hola ${"ñ".repeat(10_000)}`, es);
        expect(long.total).toBe(3);
        const mixed = await analyzeText("hola 😀🎉 café́ naïve عربى สวัสดี こんにちは ﬁ ligature \u0000 ￿", es);
        expect(mixed.total).toBeGreaterThan(3);
        for (const lang of ["ru", "zh", "ja", "th", "ar", "de", "xx"]) {
            const stats = await analyzeText("hola мир 你好 世界 こんにちは สวัสดี", plainAnalyzer(lang));
            expect(stats.total).toBeGreaterThan(0);
        }
    });

    test("a page that is one giant paragraph with no punctuation is fine", async () => {
        const stats = await analyzeText(words(200_000).join(" "), plainAnalyzer("es"));
        expect(stats.total).toBe(200_000);
    });
});

describe("pieces and messages", () => {
    test("piece counts: empty, exact fit, one over", () => {
        expect(chunkCount(0)).toBe(0);
        expect(chunkCount(1)).toBe(1);
        expect(chunkCount(CHUNK_BYTES)).toBe(1);
        expect(chunkCount(CHUNK_BYTES + 1)).toBe(2);
        expect(CHUNK_BYTES % 3).toBe(0);
    });

    test("plain reasons for the common failures", () => {
        expect(friendlyPdfError("PasswordException")).toMatch(/password/i);
        expect(friendlyPdfError("InvalidPDFException")).toMatch(/damaged/i);
        expect(friendlyPdfError(undefined, "No password given")).toMatch(/password/i);
        expect(friendlyPdfError("Weird", "x")).toBe("Could not read this PDF.");
    });

    test("a 600-page book's text joins into one body", () => {
        const pages = Array.from({ length: 600 }, (_, i) => (i % 50 === 0 ? "" : `Página ${i} con texto`));
        const body = bookText(pages);
        expect(body.split("\n\n")).toHaveLength(588);
    });
});
