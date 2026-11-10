import { lemmaKey } from "../Vocabulary";
import type { Analyzer } from "./types";

export const RUSSIAN_VERSION = 1;

/** The part of the `az` library that is used (it is untyped). */
export type AzMorph = (word: string) => { normalize(): { word: string }; score: number; parser: string }[];

/** How much of the probability one lemma must have before it is trusted. "стали" is стать at 98%; "замок" (castle or lock) is not. */
const SURE = 0.8;

/**
 * Russian lemmas from the `az` dictionary. A word is only trusted when it is in the dictionary
 * and one lemma clearly wins; anything else stays as the word itself.
 */
export function createRussianAnalyzer(morph: AzMorph): Analyzer {
    return {
        language: "ru",
        version: RUSSIAN_VERSION,
        lemma(surface) {
            const own = lemmaKey(surface);
            const parses = morph(surface).filter((p) => p.parser === "Dictionary");
            if (parses.length === 0) return { lemma: own, confident: false };

            const scores = new Map<string, number>();
            for (const parse of parses) {
                const key = lemmaKey(parse.normalize().word);
                scores.set(key, (scores.get(key) ?? 0) + parse.score);
            }
            const total = [...scores.values()].reduce((a, b) => a + b, 0);
            const [best, bestScore] = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
            return bestScore / total >= SURE ? { lemma: best, confident: true } : { lemma: own, confident: false };
        },
    };
}
