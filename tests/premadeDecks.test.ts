import { getLanguage } from "../src/constants/languages";
import { BASICS, premadeDecks } from "../src/models/PremadeDecks";
import { getReading, readings, readingsFor } from "../src/models/Readings";
import { tokenize } from "../src/models/Tokens";

describe("premade decks", () => {
    test("every deck has the same cards in the same order, with meanings and text filled in", () => {
        expect(premadeDecks.length).toBeGreaterThan(0);
        for (const deck of premadeDecks) {
            expect(deck.cards.map((c) => c.meaning)).toEqual([...BASICS]);
            for (const card of deck.cards) expect(card.learning.trim()).not.toBe("");
        }
    });

    test("ids are unique and languages exist in the app", () => {
        expect(new Set(premadeDecks.map((d) => d.id)).size).toBe(premadeDecks.length);
        for (const deck of premadeDecks) expect(getLanguage(deck.language)).toBeDefined();
    });

    test("no deck repeats a word", () => {
        for (const deck of premadeDecks) {
            const words = deck.cards.map((c) => c.learning.toLowerCase());
            expect(new Set(words).size).toBe(words.length);
        }
    });
});

describe("library readings", () => {
    test("every premade-deck language also has something to read", () => {
        for (const deck of premadeDecks) expect(readingsFor(deck.language).length).toBeGreaterThan(0);
    });

    test("ids are unique, lines have text and an English meaning, and every line has words to tap", () => {
        expect(new Set(readings.map((r) => r.id)).size).toBe(readings.length);
        for (const reading of readings) {
            expect(getLanguage(reading.language)).toBeDefined();
            expect(getReading(reading.id)).toBe(reading);
            expect(reading.lines.length).toBeGreaterThan(0);
            for (const line of reading.lines) {
                expect(line.meaning.trim()).not.toBe("");
                expect(tokenize(line.text).some((token) => token.word)).toBe(true);
            }
        }
    });
});
