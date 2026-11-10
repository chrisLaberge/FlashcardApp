import { getLanguage } from "../src/constants/languages";
import { BASICS, cardKey, premadeDecks, presentIndexes, targetDeckFor } from "../src/models/PremadeDecks";

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

describe("premade decks vs a deck you own", () => {
    const cards = [{ learning: "你好", meaning: "Hello" }, { learning: "谢谢", meaning: "Thank you" }, { learning: "水", meaning: "Water" }];

    test("finds the cards already there, ignoring case and spacing", () => {
        const existing = new Set([cardKey(" 谢谢 "), cardKey("other")]);
        expect([...presentIndexes(cards, existing)]).toEqual([1]);
        expect(cardKey("  Hello   There ")).toBe("hello there");
    });

    test("an empty deck has none", () => {
        expect(presentIndexes(cards, new Set()).size).toBe(0);
    });
});

describe("which deck premade cards go into", () => {
    const decks = [{ id: 1, language: "es" }, { id: 2, language: "zh" }, { id: 3, language: "zh" }];
    test("the last studied deck if it matches the language, else the first of that language, else none", () => {
        expect(targetDeckFor(decks, "zh", 3)?.id).toBe(3);
        expect(targetDeckFor(decks, "zh", 1)?.id).toBe(2);
        expect(targetDeckFor(decks, "zh", null)?.id).toBe(2);
        expect(targetDeckFor(decks, "fr", 1)).toBeNull();
    });
});
