/** A saved AI explanation of one card: definition, grammar notes and example sentences. */

export type Explanation = {
    definition: string;
    grammar: string[];
    examples: { text: string; translation: string; romanization?: string }[];
};

/**
 * Changes whenever the words on the card change, so an edited card gets a fresh explanation
 * instead of an out-of-date one.
 */
export function explanationSignature(card: { learningText: string; localizedText: string; exampleSentence: string }): string {
    return [card.learningText, card.localizedText, card.exampleSentence].map((s) => s.trim().toLowerCase()).join("\u0001");
}

/** Reads a stored explanation; null if it is missing or not the right shape. */
export function parseStoredExplanation(raw: string | null | undefined): Explanation | null {
    if (!raw) return null;
    try {
        const data = JSON.parse(raw) as Partial<Explanation>;
        if (typeof data.definition !== "string" || !Array.isArray(data.grammar) || !Array.isArray(data.examples)) return null;
        const examples = data.examples.filter(
            (e): e is Explanation["examples"][number] => !!e && typeof e.text === "string" && typeof e.translation === "string",
        );
        return {
            definition: data.definition,
            grammar: data.grammar.filter((g): g is string => typeof g === "string"),
            examples,
        };
    } catch {
        return null;
    }
}

/** What to tell the user when asking the server for an explanation failed. */
export function explainErrorMessage(status: number | null): string {
    if (status === 401) return "Sign in (Account tab) to get explanations.";
    if (status === 429) return "Too many explanations for now. Try again in a little while.";
    if (status === 503) return "Explanations are not available yet.";
    if (status === null) return "Could not reach the server. Check your connection.";
    return "Could not make an explanation. Try again.";
}
