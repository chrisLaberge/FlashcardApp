/**
 * Chooses a font size (and line count) so that a word is never broken across lines.
 *
 * React Native cannot be told "wrap only at spaces": when a single word is wider than the line it
 * is split in the middle. So instead of fixing it after the fact, we estimate how wide the
 * longest word is and shrink the font until it fits on one line. `adjustsFontSizeToFit` stays on
 * as a safety net for the cases an estimate cannot cover.
 */

const NARROW = new Set("iljtfIr.,:;!|'’ ");
const WIDE = new Set("mwMW@%");

/** Characters that have no spaces between words (Chinese, Japanese, Korean, Thai...), drawn full width. */
const isCjkLike = (char: string) =>
    /[ᄀ-ᇿ⺀-鿿ꥠ-꥿가-퟿豈-﫿＀-￯฀-๿]/u.test(char);

/** Approximate width of one character, as a fraction of the font size. */
export function charWidthEm(char: string): number {
    if (isCjkLike(char)) return 1;
    if ((char.codePointAt(0) ?? 0) > 0xffff) return 1.2; // emoji and other astral symbols
    if (NARROW.has(char)) return 0.34;
    if (WIDE.has(char)) return 0.92;
    if (char !== char.toLowerCase() && char === char.toUpperCase()) return 0.7; // capitals
    return 0.57;
}

export function widthEm(text: string): number {
    let total = 0;
    for (const char of text) total += charWidthEm(char);
    return total;
}

export type TextFit = { fontSize: number; numberOfLines: number };

export type TextFitOptions = {
    baseSize: number;
    /** Width available for one line of text, in px. */
    maxWidth: number;
    /** Lines allowed when the text is several words. */
    maxLines: number;
    /** The font is never shrunk below baseSize * minScale. */
    minScale?: number;
};

/** A "word" we keep whole: anything without spaces, except long runs of CJK text which may wrap anywhere. */
function isKeptWhole(word: string): boolean {
    const chars = [...word];
    return !chars.some(isCjkLike) || chars.length <= 8;
}

export function fitText(text: string, { baseSize, maxWidth, maxLines, minScale = 0.4 }: TextFitOptions): TextFit {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return { fontSize: baseSize, numberOfLines: maxLines };

    const wholeWords = words.filter(isKeptWhole);
    const longest = Math.max(0, ...wholeWords.map(widthEm));

    const singleWord = words.length === 1 && wholeWords.length === 1;
    const available = maxWidth * 0.97; // a little slack for estimation error

    let fontSize = baseSize;
    if (longest > 0 && longest * baseSize > available) fontSize = available / longest;
    fontSize = Math.max(baseSize * minScale, Math.floor(fontSize * 2) / 2);

    return { fontSize: Math.min(baseSize, fontSize), numberOfLines: singleWord ? 1 : maxLines };
}
