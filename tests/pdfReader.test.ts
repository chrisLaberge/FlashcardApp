import { splitBase64 } from "../src/models/Base64";
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
