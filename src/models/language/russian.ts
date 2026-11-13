import { lemmaKey } from "../Vocabulary";
import type { Analyzer } from "./types";

export const RUSSIAN_VERSION = 4; // 4: words the dictionary lacks use their ending's guess; 3: names and words of other languages are set aside

/** The part of the `az` library that is used (it is untyped). */
export type AzMorph = (word: string) => { normalize(): { word: string }; score: number; parser: string }[];

/** How much of the probability one lemma must have before it is trusted. "стали" is стать at 98%; "замок" (castle or lock) is not. */
const SURE = 0.8;

type Parse = ReturnType<AzMorph>[number];

/** The lemma one group of parses clearly agrees on, or null. */
function clearWinner(parses: Parse[]): string | null {
    if (parses.length === 0) return null;
    const scores = new Map<string, number>();
    for (const parse of parses) {
        const key = lemmaKey(parse.normalize().word);
        scores.set(key, (scores.get(key) ?? 0) + parse.score);
    }
    const total = [...scores.values()].reduce((a, b) => a + b, 0);
    const [best, bestScore] = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
    return total > 0 && bestScore / total >= SURE ? best : null;
}

/**
 * Russian lemmas from the `az` dictionary. A word is only trusted when it is in the dictionary
 * and one lemma clearly wins. A word the dictionary lacks ("чинового") is read from its ending, but only
 * when the ending clearly points to one lemma ("чиновый"); the loose prefix guesses are never used.
 * Anything else stays as the word itself. Answers are remembered, since a book repeats its words.
 */
export function createRussianAnalyzer(morph: AzMorph): Analyzer {
    const cache = new Map<string, { lemma: string; confident: boolean }>();
    const work = (surface: string): { lemma: string; confident: boolean } => {
        const own = lemmaKey(surface);
        const parses = morph(surface);
        const known = clearWinner(parses.filter((p) => p.parser === "Dictionary"));
        if (known) return { lemma: known, confident: true };
        if (own.length >= 4) {
            const guess = clearWinner(parses.filter((p) => p.parser === "SuffixKnown"));
            if (guess) return { lemma: guess, confident: false };
        }
        return { lemma: own, confident: false };
    };
    return {
        language: "ru",
        version: RUSSIAN_VERSION,
        lemma(surface) {
            const hit = cache.get(surface);
            if (hit) return hit;
            const result = work(surface);
            if (cache.size > 100_000) cache.clear();
            cache.set(surface, result);
            return result;
        },
    };
}
