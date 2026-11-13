import { createStemAnalyzer, hasStemmer } from "../src/models/language/stemmed";

describe("stem analyzer", () => {
    it("joins the forms of a Spanish word", () => {
        const a = createStemAnalyzer("es")!;
        expect(a.lemma("hablando").lemma).toBe(a.lemma("hablar").lemma);
        expect(a.lemma("Casas").lemma).toBe(a.lemma("casa").lemma);
    });
    it("joins French and German forms", () => {
        const fr = createStemAnalyzer("fr")!;
        expect(fr.lemma("chanteurs").lemma).toBe(fr.lemma("chanteur").lemma);
        const de = createStemAnalyzer("de")!;
        expect(de.lemma("Katzen").lemma).toBe(de.lemma("Katze").lemma);
    });
    it("keeps short words and non-words as they are", () => {
        const a = createStemAnalyzer("it")!;
        expect(a.lemma("Il")).toEqual({ lemma: "il", confident: false });
        expect(a.lemma("a1b2c3").confident).toBe(false);
    });
    it("only covers the five languages", () => {
        expect(hasStemmer("pt")).toBe(true);
        expect(hasStemmer("ru")).toBe(false);
        expect(createStemAnalyzer("ja")).toBeNull();
    });
});
