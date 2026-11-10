import { base64Chunks, toBase64 } from "../src/models/Base64";
import { bookText, marksWords, plainAnalyzer, unknownKeys } from "../src/models/ReaderWords";

describe("base64", () => {
    test("matches Buffer for every length, including padding", () => {
        for (let n = 0; n < 40; n++) {
            const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256);
            expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
        }
    });

    test("chunks decode on their own and join back to the original", () => {
        const bytes = Uint8Array.from({ length: 1000 }, (_, i) => (i * 7) % 256);
        const chunks = base64Chunks(bytes, 100);
        expect(chunks.length).toBeGreaterThan(1);
        const joined = Buffer.concat(chunks.map((c) => Buffer.from(c, "base64")));
        expect(new Uint8Array(joined)).toEqual(bytes);
        expect(base64Chunks(new Uint8Array(0))).toEqual([]);
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
