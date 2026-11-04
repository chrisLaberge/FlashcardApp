import { clipForLookup, lookupKey, parseStoredLookup } from "../src/models/Lookup";

const entry = { word: "собака", translation: "dog", definition: "A noun.", grammar: ["Feminine."] };

describe("lookup entries", () => {
    test("the key depends on language, word and sentence but not on case or spacing", () => {
        const base = lookupKey("Russian", "Собака", "У меня есть собака.");
        expect(lookupKey("russian", " собака ", "у меня есть собака.")).toBe(base);
        expect(lookupKey("Russian", "собака", "Другое предложение.")).not.toBe(base);
        expect(lookupKey("French", "собака", "У меня есть собака.")).not.toBe(base);
    });

    test("a sentence tapped as a whole has the same key with or without context", () => {
        expect(lookupKey("French", "Bonjour", "Bonjour")).toBe(lookupKey("French", "Bonjour", ""));
    });

    test("stored entries are read back, bad ones are ignored", () => {
        expect(parseStoredLookup(JSON.stringify(entry))).toEqual(entry);
        expect(parseStoredLookup(JSON.stringify({ ...entry, romanization: "sobaka" }))?.romanization).toBe("sobaka");
        expect(parseStoredLookup(JSON.stringify({ ...entry, grammar: ["ok", 3] }))?.grammar).toEqual(["ok"]);
        expect(parseStoredLookup(JSON.stringify({ word: "x" }))).toBeNull();
        expect(parseStoredLookup("not json")).toBeNull();
        expect(parseStoredLookup(null)).toBeNull();
    });

    test("long text is cut to what the server accepts", () => {
        expect(clipForLookup("  a \n b  ", 10)).toBe("a b");
        expect(clipForLookup("x".repeat(500), 200)).toHaveLength(200);
    });
});
