import { MAX_LINE, pdfLines, titleFromFileName } from "../src/models/PdfText";

describe("pdf text to lines", () => {
    test("each paragraph starts a new line and short sentences stay together", () => {
        expect(pdfLines("Hola. Me llamo Ana.\n\nSegundo párrafo.")).toEqual(["Hola. Me llamo Ana.", "Segundo párrafo."]);
    });

    test("long paragraphs are split at sentence ends, never past the limit", () => {
        const sentence = "Esta es una frase de ejemplo bastante larga. ";
        const lines = pdfLines(sentence.repeat(20));
        expect(lines.length).toBeGreaterThan(1);
        for (const line of lines) {
            expect(line.length).toBeLessThanOrEqual(MAX_LINE);
            expect(line.endsWith(".")).toBe(true);
        }
    });

    test("Chinese sentences split on 。 and a sentence with no spaces is cut at the limit", () => {
        expect(pdfLines("你好。我叫小明。")).toEqual(["你好。我叫小明。"]);
        const long = "字".repeat(MAX_LINE * 2 + 10);
        const lines = pdfLines(long);
        expect(lines.map((l) => l.length)).toEqual([MAX_LINE, MAX_LINE, 10]);
    });

    test("blank text gives no lines", () => {
        expect(pdfLines(" \n \n")).toEqual([]);
    });

    test("titles come from the file name", () => {
        expect(titleFromFileName("my story_1.PDF")).toBe("my story 1");
        expect(titleFromFileName(undefined)).toBe("Untitled PDF");
        expect(titleFromFileName("   .pdf")).toBe("Untitled PDF");
    });
});
