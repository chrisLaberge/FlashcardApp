import { tokenize } from "../src/models/Tokens";

const words = (text: string) => tokenize(text).filter((t) => t.word).map((t) => t.text);
const rebuilt = (text: string) => tokenize(text).map((t) => t.text).join("");

describe("tokenize", () => {
    test("splits at spaces and punctuation, and loses nothing", () => {
        const text = "Je mange une pomme, puis j'aime l'eau.";
        expect(words(text)).toEqual(["Je", "mange", "une", "pomme", "puis", "j'aime", "l'eau"]);
        expect(rebuilt(text)).toBe(text);
    });

    test("keeps hyphenated words together", () => {
        expect(words("a well-known tip")).toEqual(["a", "well-known", "tip"]);
    });

    test("Russian, Armenian and accented text", () => {
        expect(words("У меня есть собака.")).toEqual(["У", "меня", "есть", "собака"]);
        expect(words("Ես սիրում եմ խնձոր։")).toEqual(["Ես", "սիրում", "եմ", "խնձոր"]);
        expect(words("Café déjà vu")).toEqual(["Café", "déjà", "vu"]);
    });

    test("Chinese and Japanese: one piece per character", () => {
        expect(words("我喜欢苹果。")).toEqual(["我", "喜", "欢", "苹", "果"]);
        expect(words("りんごを食べる")).toEqual(["り", "ん", "ご", "を", "食", "べ", "る"]);
        expect(rebuilt("我喜欢苹果。")).toBe("我喜欢苹果。");
    });

    test("numbers count as words; empty text gives nothing", () => {
        expect(words("3 apples")).toEqual(["3", "apples"]);
        expect(tokenize("")).toEqual([]);
        expect(tokenize("...")).toEqual([{ text: "...", word: false }]);
    });
});
