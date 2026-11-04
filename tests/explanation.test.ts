import { explainErrorMessage, explanationSignature, parseStoredExplanation } from "../src/models/Explanation";

const card = { learningText: "Pomme", localizedText: "apple", exampleSentence: "Je mange une pomme." };

describe("explanation signature", () => {
    test("ignores case and surrounding spaces, changes when the words change", () => {
        expect(explanationSignature({ ...card, learningText: "  pomme " })).toBe(explanationSignature(card));
        expect(explanationSignature({ ...card, localizedText: "apples" })).not.toBe(explanationSignature(card));
        expect(explanationSignature({ ...card, exampleSentence: "" })).toBe(explanationSignature(card));
    });
});

describe("parseStoredExplanation", () => {
    const good = { definition: "A fruit.", grammar: ["Feminine."], examples: [{ text: "a", translation: "b" }] };

    test("reads a good one", () => {
        expect(parseStoredExplanation(JSON.stringify(good))).toEqual(good);
    });

    test("drops bad entries but keeps the rest", () => {
        const messy = { ...good, grammar: ["ok", 3], examples: [{ text: "a", translation: "b" }, { text: "no translation" }, null] };
        expect(parseStoredExplanation(JSON.stringify(messy))).toEqual({ definition: "A fruit.", grammar: ["ok"], examples: [{ text: "a", translation: "b" }] });
    });

    test("null for missing, broken or wrong-shaped data", () => {
        expect(parseStoredExplanation(null)).toBeNull();
        expect(parseStoredExplanation("{not json")).toBeNull();
        expect(parseStoredExplanation('{"definition":5,"grammar":[],"examples":[]}')).toBeNull();
        expect(parseStoredExplanation('{"definition":"x"}')).toBeNull();
    });
});

describe("explainErrorMessage", () => {
    test("says what to do for each kind of failure", () => {
        expect(explainErrorMessage(401)).toMatch(/Sign in/);
        expect(explainErrorMessage(429)).toMatch(/Too many/);
        expect(explainErrorMessage(503)).toMatch(/not available/);
        expect(explainErrorMessage(null)).toMatch(/connection/);
        expect(explainErrorMessage(500)).toMatch(/Try again/);
    });
});
