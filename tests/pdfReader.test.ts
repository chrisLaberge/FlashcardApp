import { analyzeText, spacedWords } from "../src/models/BookAnalysis";
import { fromBase64, splitBase64 } from "../src/models/Base64";
import { bookText, marksWords, plainAnalyzer, unknownKeys } from "../src/models/ReaderWords";

describe("base64 pieces", () => {
    test("pieces are multiples of 4 and join back to the original", () => {
        const data = Buffer.from(Uint8Array.from({ length: 1000 }, (_, i) => (i * 7) % 256)).toString("base64");
        const pieces = splitBase64(data, 100);
        expect(pieces.length).toBeGreaterThan(1);
        for (const piece of pieces.slice(0, -1)) expect(piece.length % 4).toBe(0);
        expect(pieces.join("")).toBe(data);
        expect(splitBase64("")).toEqual([]);
    });
});

describe("base64 decoding", () => {
    test("matches Buffer for every length, with and without padding", () => {
        for (let n = 0; n < 50; n++) {
            const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 53 + 7) % 256);
            const text = Buffer.from(bytes).toString("base64");
            expect(fromBase64(text)).toEqual(bytes);
            expect(fromBase64(text.replace(/=+$/, ""))).toEqual(bytes);
        }
    });

    test("a real binary dictionary file round-trips exactly", () => {
        const file = require("fs").readFileSync("node_modules/az/dicts/prediction-suffixes-1.dawg") as Buffer;
        expect(fromBase64(file.toString("base64"))).toEqual(new Uint8Array(file));
    });

    test("rejects text that is not base64", () => {
        expect(() => fromBase64("ab$d")).toThrow();
    });
});

describe("marking unknown words", () => {
    const analyzer = plainAnalyzer("es");

    test("words you know are left out, the rest are returned", () => {
        expect(unknownKeys(["el", "perro", "corre"], analyzer, new Set(["el", "perro"]))).toEqual(["corre"]);
    });

    test("numbers and symbols are never marked", () => {
        expect(unknownKeys(["123", "--", "hola"], analyzer, new Set())).toEqual(["hola"]);
    });

    test("uses the dictionary form when the analyser knows it", () => {
        const russian = { language: "ru", version: 1, lemma: (w: string) => ({ lemma: w === "книги" ? "книга" : w, confident: true }) };
        expect(unknownKeys(["книги", "дом"], russian, new Set(["книга"]))).toEqual(["дом"]);
    });

    test("languages without spaces are not marked", () => {
        expect(marksWords("zh")).toBe(false);
        expect(marksWords("ja")).toBe(false);
        expect(marksWords("ru")).toBe(true);
    });

    test("pages join with a blank line, empty pages are dropped", () => {
        expect(bookText([" Uno ", "", "Dos\n"])).toBe("Uno\n\nDos");
        expect(bookText(["", " "])).toBe("");
    });
});

describe("languages written without spaces", () => {
    const zh = plainAnalyzer("zh");

    test("the plain analyser is segmented for Chinese, not for Spanish", () => {
        expect(zh.segmented).toBe(true);
        expect(plainAnalyzer("es").segmented).toBeFalsy();
    });

    test("a text cut into words by spaces counts whole words, not characters", async () => {
        const stats = await analyzeText("我 喜欢 学习 中文 。 我 喜欢 猫", zh);
        expect(stats.total).toBe(7);
        expect(stats.lemmas.get("喜欢")?.count).toBe(2);
        expect(stats.lemmas.get("我")?.count).toBe(2);
    });

    test("spacedWords drops punctuation and keeps whole words", () => {
        expect(spacedWords("你好 ， 世界 ！").map((w) => w.text)).toEqual(["你好", "世界"]);
    });
});

describe("names and places", () => {
    const es = plainAnalyzer("es");
    const text = "Ayer Pedro fue al mercado. Luego vio a Pedro con Marta. La casa de Marta es grande. Pedro dijo que la casa es bonita. Casa vieja.";

    test("a word always capitalised in mid-sentence is taken for a name", async () => {
        const stats = await analyzeText(text, es);
        expect(stats.lemmas.get("pedro")?.name).toBe(true);
        expect(stats.lemmas.get("marta")?.name).toBe(true);
    });

    test("a word that also appears in lower case, or only starts sentences, is not", async () => {
        const stats = await analyzeText(text, es);
        expect(stats.lemmas.get("casa")?.name).toBe(false); // 'Casa' starts a sentence, 'casa' is lower case elsewhere
        expect(stats.lemmas.get("ayer")?.name).toBe(false);
        expect(stats.lemmas.get("luego")?.name).toBe(false);
    });

    test("one mention is not enough, and 'I' or all-caps headings are never names", async () => {
        const once = await analyzeText("Hoy vi a Juan en el parque.", es);
        expect(once.lemmas.get("juan")?.name).toBe(false);
        const english = await analyzeText("Then I went home. Later I ate. Now I sleep. I think I am done. THE END THE END", plainAnalyzer("en"));
        expect(english.lemmas.get("i")?.name).toBe(false);
        expect(english.lemmas.get("the")?.name).toBe(false);
    });

    test("German capitalises every noun, so capitals say nothing there; Chinese has none", async () => {
        const german = await analyzeText("Heute sah ich den Hund. Der Hund lief. Ich mag den Hund und den Hund.", plainAnalyzer("de"));
        expect([...german.lemmas.values()].some((l) => l.name)).toBe(false);
        const chinese = await analyzeText("我 喜欢 猫 我 喜欢 狗", plainAnalyzer("zh"));
        expect([...chinese.lemmas.values()].some((l) => l.name)).toBe(false);
    });
});
