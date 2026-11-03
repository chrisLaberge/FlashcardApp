/**
 * Names for cached speech audio. The same text spoken by the same voice always gets the same
 * file name, so each word is fetched from the server once and played from the phone afterwards.
 */

// Two independent 32-bit FNV-1a hashes, so an accidental collision is vanishingly unlikely.
function fnv1a(text: string, seed: number): number {
    let hash = seed >>> 0;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

const hex = (n: number) => n.toString(16).padStart(8, "0");

/** Text is compared as the user would see it: surrounding spaces and Unicode form do not matter. */
export function normalizeSpeechText(text: string): string {
    return text.normalize("NFC").trim().replace(/\s+/g, " ");
}

/** e.g. "hyw-3f9a1c2b7d04e815" (no extension: the server decides the audio format). */
export function ttsCacheName(voice: string, text: string): string {
    const key = `${voice}\u0000${normalizeSpeechText(text)}`;
    return `${voice}-${hex(fnv1a(key, 0x811c9dc5))}${hex(fnv1a(key, 0x01234567))}`;
}
