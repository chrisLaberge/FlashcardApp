import { orderedRange, textOfWords, wordCount } from "../src/models/Selection";

describe("picking words", () => {
    const text = "Je mange une pomme, puis j'aime l'eau.";

    test("one word, a run of words (with what lies between), or all of them", () => {
        expect(textOfWords(text, 1, 1)).toBe("mange");
        expect(textOfWords(text, 2, 3)).toBe("une pomme");
        expect(textOfWords(text, 3, 4)).toBe("pomme, puis");
        expect(textOfWords(text, 0, wordCount(text) - 1)).toBe("Je mange une pomme, puis j'aime l'eau");
    });

    test("order does not matter and out-of-range numbers are clamped", () => {
        expect(textOfWords(text, 3, 2)).toBe("une pomme");
        expect(textOfWords(text, -4, 1)).toBe("Je mange");
        expect(textOfWords(text, 5, 99)).toBe("j'aime l'eau");
        expect(textOfWords(text, 6, 99)).toBe("l'eau");
        expect(orderedRange(5, 2)).toEqual({ from: 2, to: 5 });
    });

    test("Chinese picks characters and keeps them together", () => {
        expect(textOfWords("我喜欢苹果。", 1, 2)).toBe("喜欢");
        expect(wordCount("我喜欢苹果。")).toBe(5);
    });

    test("no words, nothing to pick", () => {
        expect(wordCount("...")).toBe(0);
        expect(textOfWords("...", 0, 0)).toBe("");
        expect(textOfWords("", 0, 0)).toBe("");
    });
});
