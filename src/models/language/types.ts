/**
 * One language's word analysis. To support another language, write one of these (see russian.ts)
 * and add it in index.ts. Everything else (books, coverage, the known-word bank) is shared.
 */
export type Lemma = {
    /** The dictionary form (or, when unsure, the word itself), already passed through `lemmaKey`. */
    lemma: string;
    /** True only when the analyser is sure. An unsure word is kept as itself, so it never matches a different known word. */
    confident: boolean;
};

export type Analyzer = {
    language: string;
    /** Bump when the rules change; books analysed with an older version are analysed again. */
    version: number;
    lemma(surface: string): Lemma;
};
