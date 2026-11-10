/**
 * What "knowing a word" means, and how much of a book that covers. Pure rules, no database.
 *
 * A word is a lemma (its dictionary form: "книга" for книги, книгу, книгой...). It is known when
 * the person marked it known, or when a flashcard for it has been learned well enough.
 */

/** A card counts as learned once its study level reaches this (levels run 0 to 8). Change it here. */
export const KNOWN_MIN_LEVEL = 5;

/** The words of a card or book are compared in this form: lower case, and е for ё (people often skip the dots). */
export const lemmaKey = (word: string): string => word.normalize("NFC").trim().toLowerCase().replace(/ё/g, "е");

/** Has this card been learned well enough for its word to count as known? Reviews already made are never touched. */
export function isLearned(progress: { level: number; mastered: boolean }): boolean {
    return progress.mastered || progress.level >= KNOWN_MIN_LEVEL;
}

export type KnownSource = "manual" | "card";

/** One word's status. `manual` choices (known or not known) always beat what the cards say. */
export type KnownWord = { lemma: string; known: boolean; source: KnownSource };

/**
 * Which words the cards say are known: a word is known when ANY card for it is learned, so the
 * same word in several decks counts once. Cards with more than one word are ignored.
 */
export function knownFromCards(cards: readonly { lemma: string | null; level: number; mastered: boolean }[]): Set<string> {
    const known = new Set<string>();
    for (const card of cards) {
        if (card.lemma && isLearned(card)) known.add(lemmaKey(card.lemma));
    }
    return known;
}

/** Share of word occurrences you know, 0 to 100, to one decimal. A book with no words is 0, never NaN. */
export function coveragePercent(knownOccurrences: number, totalOccurrences: number): number {
    if (totalOccurrences <= 0) return 0;
    const share = (Math.min(knownOccurrences, totalOccurrences) / totalOccurrences) * 100;
    return Math.round(share * 10) / 10;
}
