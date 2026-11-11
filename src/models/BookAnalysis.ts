import { tokenize } from "./Tokens";
import type { Analyzer } from "./language/types";
import { lemmaKey } from "./Vocabulary";

export type BookLemma = {
    count: number;
    /** The form seen most often in the text, for showing. */
    sample: string;
    /** Looks like a name or place: capitalised in the middle of sentences every time, never written in lower case. */
    name: boolean;
};

export type BookStats = {
    /** Every word occurrence counted (numbers and punctuation are not words). */
    total: number;
    lemmas: Map<string, BookLemma>;
};

const hasLetter = /\p{L}/u;

/** The words of a text whose words are already separated by spaces (what the PDF reader produces for Chinese and the like). */
export function spacedWords(text: string): { text: string; word: boolean }[] {
    return (text.match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).filter((w) => hasLetter.test(w)).map((w) => ({ text: w, word: true }));
}
const BATCH = 2000;

/** Languages where a capital letter in mid-sentence says "name" (German capitalises every noun, so there it says nothing). */
export const capitalsMarkNames = (analyzer: Analyzer): boolean => !analyzer.segmented && analyzer.language !== "de" && analyzer.language !== "lb";

const SENTENCE_BREAK = /[.!?…:;"«»“”„\n\u2014\u2013]/;
const isUpper = (c: string) => c !== c.toLowerCase() && c === c.toUpperCase();

/** Lets the screen redraw between batches so a long book does not freeze the app. */
const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Counts every word in a text by lemma. Each occurrence counts once ("книга" five times is 5), and
 * repeated forms are looked up once. Returns a total of 0 when the text has no words.
 */
export async function analyzeText(text: string, analyzer: Analyzer, onProgress?: (done: number, total: number) => void): Promise<BookStats> {
    const names = capitalsMarkNames(analyzer);
    const upperMid = new Map<string, number>();
    const writtenLower = new Set<string>();
    let words: { text: string; word: boolean }[];
    if (analyzer.segmented) {
        words = spacedWords(text);
    } else {
        words = [];
        let afterBreak = true;
        for (const token of tokenize(text)) {
            if (!token.word) {
                if (SENTENCE_BREAK.test(token.text)) afterBreak = true;
                continue;
            }
            if (!hasLetter.test(token.text)) continue;
            words.push(token);
            if (names) {
                const key = lemmaKey(token.text);
                const first = token.text[0];
                const rest = token.text.slice(1);
                if (!isUpper(first)) writtenLower.add(key);
                else if (!afterBreak && rest !== rest.toUpperCase()) upperMid.set(key, (upperMid.get(key) ?? 0) + 1);
            }
            afterBreak = false;
        }
    }
    const cache = new Map<string, string>();
    const forms = new Map<string, Map<string, number>>();
    const lemmas = new Map<string, BookLemma>();

    for (let i = 0; i < words.length; i++) {
        const surface = lemmaKey(words[i].text);
        let lemma = cache.get(surface);
        if (lemma === undefined) {
            lemma = analyzer.lemma(surface).lemma;
            cache.set(surface, lemma);
        }

        const seen = forms.get(lemma) ?? new Map<string, number>();
        seen.set(surface, (seen.get(surface) ?? 0) + 1);
        forms.set(lemma, seen);

        const entry = lemmas.get(lemma);
        if (entry) entry.count += 1;
        else lemmas.set(lemma, { count: 1, sample: surface, name: false });

        if ((i + 1) % BATCH === 0) {
            onProgress?.(i + 1, words.length);
            await nextTick();
        }
    }

    for (const [lemma, seen] of forms) {
        const entry = lemmas.get(lemma);
        if (!entry) continue;
        entry.sample = [...seen.entries()].sort((a, b) => b[1] - a[1])[0][0];
        if (names) {
            const surfaces = [...seen.keys()];
            const capitalised = surfaces.reduce((n, f) => n + (upperMid.get(f) ?? 0), 0);
            entry.name = capitalised >= 2 && surfaces.every((f) => !writtenLower.has(f) && f.length > 1 && !f.includes("'") && !f.includes("\u2019"));
        }
    }
    onProgress?.(words.length, words.length);
    return { total: words.length, lemmas };
}
