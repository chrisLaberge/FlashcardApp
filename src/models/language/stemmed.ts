import * as snowball from "snowball-stemmers";
import { lemmaKey } from "../Vocabulary";
import type { Analyzer } from "./types";

export const STEMMER_VERSION = 1;

/** Languages counted by their word stem ("hablando" and "hablar" share one), with the Snowball name for each. */
const STEMMERS: Record<string, string> = { es: "spanish", fr: "french", de: "german", pt: "portuguese", it: "italian" };

export const hasStemmer = (language: string): boolean => language in STEMMERS;

/** Words shorter than this are kept as written: a stem of three letters would match too many different words. */
const MIN_STEM = 4;

/**
 * An analyser that treats every form of a word as one by cutting it back to its stem. The stem is only a key
 * for matching (it is not shown): your cards and the pages go through the same rule, so they agree.
 */
export function createStemAnalyzer(language: string): Analyzer | null {
    const name = STEMMERS[language];
    if (!name) return null;
    const stemmer = snowball.newStemmer(name);
    const memo = new Map<string, string>();
    return {
        language,
        version: STEMMER_VERSION,
        lemma(surface) {
            const word = lemmaKey(surface);
            if (word.length < MIN_STEM || !/^\p{L}+$/u.test(word)) return { lemma: word, confident: false };
            let stem = memo.get(word);
            if (stem === undefined) {
                stem = lemmaKey(stemmer.stem(word));
                if (stem.length < 2) stem = word;
                memo.set(word, stem);
            }
            return { lemma: stem, confident: true };
        },
    };
}
