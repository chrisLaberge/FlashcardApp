import { westernToEasternSpelling } from "@/utils/armenian";

describe("westernToEasternSpelling", () => {
    test("swaps the voiced and unvoiced consonants so an Eastern voice sounds Western", () => {
        expect(westernToEasternSpelling("բ")).toBe("պ");
        expect(westernToEasternSpelling("պ")).toBe("բ");
        expect(westernToEasternSpelling("գիրք")).toBe("կիրք"); // Western "kirk'"
        expect(westernToEasternSpelling("դուռ")).toBe("տուռ");
        expect(westernToEasternSpelling("ձայն")).toBe("ծայն");
        expect(westernToEasternSpelling("ջուր")).toBe("ճուր");
    });

    test("letters that are the same in both varieties are untouched", () => {
        expect(westernToEasternSpelling("փքթցչ")).toBe("փքթցչ");
        expect(westernToEasternSpelling("մայր")).toBe("մայր");
    });

    test("keeps upper and lower case", () => {
        expect(westernToEasternSpelling("Բարեւ")).toBe("Պարև");
        expect(westernToEasternSpelling("ԲԴԳ")).toBe("ՊՏԿ");
    });

    test("the consonant swap undoes itself", () => {
        const word = "բդգձջպտկծճ";
        expect(westernToEasternSpelling(westernToEasternSpelling(word))).toBe(word);
    });

    test("classical ligature spelling and word-initial յ", () => {
        expect(westernToEasternSpelling("եւ")).toBe("և");
        expect(westernToEasternSpelling("յոյս")).toBe("հոյս");
        expect(westernToEasternSpelling("ձայն յոյս")).toBe("ծայն հոյս");
    });

    test("text without Armenian letters is unchanged", () => {
        expect(westernToEasternSpelling("hello, 123")).toBe("hello, 123");
        expect(westernToEasternSpelling("")).toBe("");
    });
});
