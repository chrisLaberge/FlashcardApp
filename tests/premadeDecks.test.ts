import { getLanguage } from "../src/constants/languages";
import { BASICS, premadeDecks } from "../src/models/PremadeDecks";

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
