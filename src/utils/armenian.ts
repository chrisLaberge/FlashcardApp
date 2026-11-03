/**
 * Approximating Western Armenian with an Eastern Armenian voice.
 *
 * Western and Eastern Armenian share a script but the stop and affricate consonants sound
 * different: the letter written բ is "b" in Eastern and "p" in Western, and likewise for the
 * other voiced/unvoiced pairs. An Eastern voice reading Western text therefore gets those
 * consonants systematically wrong.
 *
 * `westernToEasternSpelling` rewrites the text so that an Eastern voice produces the Western
 * sound. This is an approximation for testing voices, not a full conversion of Western
 * Armenian (vowels, stress and many word-specific pronunciations are not handled).
 */

// Each pair swaps: Western բ sounds like Eastern պ, and Western պ sounds like Eastern բ, etc.
const SWAPS: readonly [string, string][] = [
    ["բ", "պ"],
    ["դ", "տ"],
    ["գ", "կ"],
    ["ձ", "ծ"],
    ["ջ", "ճ"],
];

const SWAP_MAP: ReadonlyMap<string, string> = new Map(
    SWAPS.flatMap(([a, b]) => [
        [a, b],
        [b, a],
        [a.toUpperCase(), b.toUpperCase()],
        [b.toUpperCase(), a.toUpperCase()],
    ] as [string, string][]),
);

export function westernToEasternSpelling(text: string): string {
    return [...text.normalize("NFC")]
        .map((char) => SWAP_MAP.get(char) ?? char)
        .join("")
        // Classical orthography's two-letter "ev" becomes the single letter reformed spelling uses.
        .replace(/եւ/g, "և")
        .replace(/ԵՒ/g, "ԵՎ")
        // A word-initial յ is pronounced "h" in Western Armenian ("y" in Eastern).
        .replace(/(^|[^\p{L}])յ/gu, "$1հ")
        .replace(/(^|[^\p{L}])Յ/gu, "$1Հ");
}
