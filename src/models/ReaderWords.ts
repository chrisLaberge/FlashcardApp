import { lemmaKey } from "./Vocabulary";
import type { Analyzer } from "./language/types";
import { RUSSIAN_VERSION } from "./language/russian";
import { STEMMER_VERSION } from "./language/stemmed";

/** Books counted with an older set of rules are counted again (the text is kept, so this is quick). */
export const ANALYSIS_REVISION = 4;

/** Changes whenever the rules that turn words into lemmas change, so the saved known words are made again. */
export const SYNC_SALT = `${ANALYSIS_REVISION}.${RUSSIAN_VERSION}.${STEMMER_VERSION}`;

/** Languages written without spaces between words: a run of letters is a whole sentence, so words are not marked. */
const NO_SPACES = new Set(["zh", "ja", "th", "km", "lo", "my"]);

export const marksWords = (language: string): boolean => !NO_SPACES.has(language);

/** Used where a language has no dictionary: a word is only itself (lower case), so it matches the same spelling on your cards. */
export const plainAnalyzer = (language: string): Analyzer => ({
    language,
    version: ANALYSIS_REVISION,
    segmented: !marksWords(language),
    lemma: (surface) => ({ lemma: lemmaKey(surface), confident: false }),
});

/** Which of the page's words are not known yet. `keys` are lower-cased spellings from the page. */
export function unknownKeys(keys: readonly string[], analyzer: Analyzer, known: ReadonlySet<string>): string[] {
    const out: string[] = [];
    for (const key of keys) {
        if (!/\p{L}/u.test(key)) continue;
        if (!known.has(analyzer.lemma(key).lemma)) out.push(key);
    }
    return out;
}

/** Which of the page's words have a card you are still learning (they get a fainter mark). */
export function learningKeys(keys: readonly string[], analyzer: Analyzer, inDeck: ReadonlySet<string>): string[] {
    if (inDeck.size === 0) return [];
    const out: string[] = [];
    for (const key of keys) {
        if (!/\p{L}/u.test(key)) continue;
        if (inDeck.has(analyzer.lemma(key).lemma)) out.push(key);
    }
    return out;
}

/** Joins the pages read out of the PDF into the book's text (blank line between pages). */
export const bookText = (pages: readonly string[]): string => pages.map((p) => p.trim()).filter(Boolean).join("\n\n");
