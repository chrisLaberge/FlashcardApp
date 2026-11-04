import { tokenize } from "./Tokens";

/** A run of words picked in a piece of text: word numbers (0 is the first word), both ends included. */
export type WordRange = { from: number; to: number };

export const orderedRange = (a: number, b: number): WordRange => ({ from: Math.min(a, b), to: Math.max(a, b) });

/** Where each word starts and ends in the text. */
function wordSpans(text: string): { start: number; end: number }[] {
    const spans: { start: number; end: number }[] = [];
    let offset = 0;
    for (const token of tokenize(text)) {
        if (token.word) spans.push({ start: offset, end: offset + token.text.length });
        offset += token.text.length;
    }
    return spans;
}

export const wordCount = (text: string): number => wordSpans(text).length;

/** The text from the first picked word to the last, with what lies between them (spaces, commas). */
export function textOfWords(text: string, from: number, to: number): string {
    const spans = wordSpans(text);
    if (spans.length === 0) return "";
    const a = spans[Math.max(0, Math.min(from, to))];
    const b = spans[Math.min(spans.length - 1, Math.max(from, to))];
    return a && b ? text.slice(a.start, b.end) : "";
}
