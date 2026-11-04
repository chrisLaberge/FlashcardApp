/** A dictionary entry for one tapped word or sentence (written by an AI, kept on the phone). */

export type Lookup = {
    /** The full word or phrase in the learned language. */
    word: string;
    romanization?: string;
    /** A short meaning, good for the back of a card. */
    translation: string;
    definition: string;
    grammar: string[];
};

/** What the same tap means can depend on the sentence, so the sentence is part of the key. */
export function lookupKey(languageName: string, text: string, context: string): string {
    return [languageName, text, context === text ? "" : context].map((s) => s.trim().toLowerCase()).join("\u0001");
}

/** Reads a stored entry; null if it is missing or not the right shape. */
export function parseStoredLookup(raw: string | null | undefined): Lookup | null {
    if (!raw) return null;
    try {
        const d = JSON.parse(raw) as Partial<Lookup>;
        if (typeof d.word !== "string" || typeof d.translation !== "string" || typeof d.definition !== "string" || !Array.isArray(d.grammar)) return null;
        const entry: Lookup = {
            word: d.word,
            translation: d.translation,
            definition: d.definition,
            grammar: d.grammar.filter((g): g is string => typeof g === "string"),
        };
        if (typeof d.romanization === "string" && d.romanization) entry.romanization = d.romanization;
        return entry;
    } catch {
        return null;
    }
}

/** The text sent for a long press: a whole sentence, cut to what the server accepts. */
export const MAX_LOOKUP_TEXT = 200;
export const MAX_LOOKUP_CONTEXT = 300;

export function clipForLookup(text: string, max: number): string {
    const collapsed = text.replace(/\s+/g, " ").trim();
    return collapsed.length <= max ? collapsed : collapsed.slice(0, max).trim();
}
