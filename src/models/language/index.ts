/** Languages that have a word analyser. Others still get their PDFs; they just show no coverage. */
export const ANALYZED_LANGUAGES = ["ru"] as const;

export const hasAnalyzer = (language: string): boolean => (ANALYZED_LANGUAGES as readonly string[]).includes(language);

export type { Analyzer, Lemma } from "./types";
