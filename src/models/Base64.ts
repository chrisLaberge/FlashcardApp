const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Base64 of some bytes. Written out here so it does not depend on what the phone's JS engine offers. */
export function toBase64(bytes: Uint8Array): string {
    const parts: string[] = [];
    for (let i = 0; i < bytes.length; i += 3) {
        const a = bytes[i];
        const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
        const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
        const n = (a << 16) | (b << 8) | c;
        parts.push(
            ALPHABET[(n >> 18) & 63],
            ALPHABET[(n >> 12) & 63],
            i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : "=",
            i + 2 < bytes.length ? ALPHABET[n & 63] : "=",
        );
    }
    return parts.join("");
}

/** Splits bytes into base64 pieces of about `size` bytes each (a multiple of 3, so each piece decodes on its own). */
export function base64Chunks(bytes: Uint8Array, size = 192 * 1024): string[] {
    const step = Math.max(3, size - (size % 3));
    const out: string[] = [];
    for (let i = 0; i < bytes.length; i += step) out.push(toBase64(bytes.subarray(i, i + step)));
    return out;
}
