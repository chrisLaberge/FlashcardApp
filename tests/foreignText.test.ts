import { analyzeText } from "../src/models/BookAnalysis";
import { isForeignSentence, isForeignWord } from "../src/models/ForeignText";
import { plainAnalyzer } from "../src/models/ReaderWords";

describe("words in another writing system", () => {
    test("Latin words in a Russian book are foreign; Cyrillic words are not", () => {
        expect(isForeignWord("Facebook", "ru")).toBe(true);
        expect(isForeignWord("книга", "ru")).toBe(false);
        expect(isForeignWord("iPhone-ом", "ru")).toBe(false); // mixed: has Cyrillic letters
    });

    test("Cyrillic or Chinese words in a Spanish book are foreign", () => {
        expect(isForeignWord("привет", "es")).toBe(true);
        expect(isForeignWord("你好", "es")).toBe(true);
        expect(isForeignWord("hola", "es")).toBe(false);
    });

    test("Latin words in a Chinese or Japanese book are foreign, kana and kanji are not", () => {
        expect(isForeignWord("WiFi", "zh")).toBe(true);
        expect(isForeignWord("你好", "zh")).toBe(false);
        expect(isForeignWord("ありがとう", "ja")).toBe(false);
        expect(isForeignWord("漢字", "ja")).toBe(false);
    });

    test("numbers and punctuation are never foreign", () => {
        expect(isForeignWord("1234", "ru")).toBe(false);
        expect(isForeignWord("--", "es")).toBe(false);
    });
});

describe("letters a language does not use", () => {
    test("a French letter in a Spanish book marks the word foreign", () => {
        expect(isForeignWord("garçon", "es")).toBe(true);
        expect(isForeignWord("être", "es")).toBe(true);
        expect(isForeignWord("niño", "es")).toBe(false);
        expect(isForeignWord("canción", "es")).toBe(false);
    });

    test("Spanish ñ is foreign in a French book, French letters are fine in French", () => {
        expect(isForeignWord("niño", "fr")).toBe(true);
        expect(isForeignWord("garçon", "fr")).toBe(false);
    });

    test("languages without a letter list only use the writing-system rule", () => {
        expect(isForeignWord("garçon", "pl")).toBe(false);
    });
});

describe("whole sentences in another language", () => {
    const french = "Il est très tard et je ne sais pas où nous sommes avec les enfants".split(" ");
    const spanish = "Es muy tarde y no sé dónde estamos con los niños de la casa".split(" ");

    test("a French sentence in a Spanish book is foreign, a Spanish one is not", () => {
        expect(isForeignSentence(french, "es")).toBe(true);
        expect(isForeignSentence(spanish, "es")).toBe(false);
    });

    test("short sentences are never judged", () => {
        expect(isForeignSentence("le chat est là".split(" "), "es")).toBe(false);
    });

    test("a sentence of names or unknown language is left alone", () => {
        expect(isForeignSentence("Ayer Pedro Marta Juan Lucía Carlos".split(" "), "es")).toBe(false);
    });
});

describe("in a whole book", () => {
    const es = plainAnalyzer("es");

    test("a French passage and a word with a French letter are ignored, Spanish words are not", async () => {
        const text = "El niño juega en el parque con su perro. Il est très tard et je ne sais pas où nous sommes avec les enfants. Luego dijo garçon y se fue a casa. El perro come en la casa.";
        const stats = await analyzeText(text, es);
        expect(stats.lemmas.get("garçon")?.ignored).toBe(true);
        expect(stats.lemmas.get("enfants")?.ignored).toBe(true);
        expect(stats.lemmas.get("sommes")?.ignored).toBe(true);
        expect(stats.lemmas.get("perro")?.ignored).toBe(false);
        expect(stats.lemmas.get("casa")?.ignored).toBe(false);
    });

    test("a word used mostly in Spanish is kept even if one French sentence has it", async () => {
        const text = "No quiero ir. No sé nada. No es verdad. No hay problema. Il ne sait pas où nous sommes avec les enfants no.";
        const stats = await analyzeText(text, es);
        expect(stats.lemmas.get("no")?.ignored).toBe(false);
    });

    test("Latin words in a Russian book are ignored", async () => {
        const stats = await analyzeText("Он открыл Facebook и написал сообщение. Потом он закрыл Facebook.", plainAnalyzer("ru"));
        expect(stats.lemmas.get("facebook")?.ignored).toBe(true);
        expect(stats.lemmas.get("сообщение")?.ignored).toBe(false);
    });

    test("Latin words in a Chinese book (cut into words) are ignored", async () => {
        const stats = await analyzeText("我 用 WiFi 看 视频 我 用 WiFi", plainAnalyzer("zh"));
        expect(stats.lemmas.get("wifi")?.ignored).toBe(true);
        expect(stats.lemmas.get("视频")?.ignored).toBe(false);
    });
});
