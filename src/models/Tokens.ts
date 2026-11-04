/** Splits text into the pieces a learner can tap: words, and the spaces/punctuation between them. */

export type Token = { text: string; word: boolean };

// Chinese and Japanese are written without spaces, so each character is its own piece (the
// dictionary lookup finds the whole word it belongs to). Everything else is split at spaces and
// punctuation, keeping apostrophes and hyphens inside a word (l'eau, well-known).
function makeWordPattern(): RegExp {
    try {
        return new RegExp(
            "[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}]|[\\p{L}\\p{M}\\p{N}]+(?:['’\\-][\\p{L}\\p{M}\\p{N}]+)*",
            "gu",
        );
    } catch {
        return /\S+/g; // an engine without Unicode property escapes: split at spaces
    }
}

export function tokenize(text: string): Token[] {
    const pattern = makeWordPattern();
    const tokens: Token[] = [];
    let last = 0;
    for (const match of text.matchAll(pattern)) {
        const start = match.index ?? 0;
        if (start > last) tokens.push({ text: text.slice(last, start), word: false });
        tokens.push({ text: match[0], word: true });
        last = start + match[0].length;
    }
    if (last < text.length) tokens.push({ text: text.slice(last), word: false });
    return tokens;
}
