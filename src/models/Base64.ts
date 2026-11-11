/** Cuts a base64 string into pieces of about `size` characters. Each piece is a multiple of 4 long, so each decodes on its own. */
export function splitBase64(data: string, size = 256 * 1024): string[] {
    const step = Math.max(4, size - (size % 4));
    const out: string[] = [];
    for (let i = 0; i < data.length; i += step) out.push(data.slice(i, i + step));
    return out;
}

const LOOKUP = (() => {
    const table = new Int16Array(128).fill(-1);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (let i = 0; i < alphabet.length; i++) table[alphabet.charCodeAt(i)] = i;
    return table;
})();

/** The bytes of a base64 string (padding and line breaks are fine). */
export function fromBase64(data: string): Uint8Array {
    const clean = data.replace(/[\s=]+/g, "");
    const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
    let bits = 0;
    let value = 0;
    let n = 0;
    for (let i = 0; i < clean.length; i++) {
        const code = clean.charCodeAt(i);
        const digit = code < 128 ? LOOKUP[code] : -1;
        if (digit < 0) throw new Error("Not base64");
        value = (value << 6) | digit;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out[n++] = (value >> bits) & 0xff;
            value &= (1 << bits) - 1;
        }
    }
    return out.subarray(0, n);
}
