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

/** The bytes of a base64 string (padding and line breaks are fine). Works four characters at a time, since the big dictionary files go through here. */
export function fromBase64(data: string): Uint8Array {
    const clean = /[^A-Za-z0-9+/]/.test(data) ? data.replace(/[\s=]+/g, "") : data;
    const length = clean.length;
    const out = new Uint8Array(Math.floor((length * 3) / 4));
    const table = LOOKUP;
    let n = 0;
    let i = 0;
    const whole = length - (length % 4);
    for (; i < whole; i += 4) {
        const a = table[clean.charCodeAt(i)];
        const b = table[clean.charCodeAt(i + 1)];
        const c = table[clean.charCodeAt(i + 2)];
        const d = table[clean.charCodeAt(i + 3)];
        // Codes of 128 and over read past the table (undefined), which fails the check below like -1 does.
        if (!(a >= 0 && b >= 0 && c >= 0 && d >= 0)) throw new Error("Not base64");
        out[n++] = (a << 2) | (b >> 4);
        out[n++] = ((b & 15) << 4) | (c >> 2);
        out[n++] = ((c & 3) << 6) | d;
    }
    const rest = length - whole;
    if (rest === 1) throw new Error("Not base64");
    if (rest > 0) {
        const a = table[clean.charCodeAt(i)];
        const b = table[clean.charCodeAt(i + 1)];
        const c = rest === 3 ? table[clean.charCodeAt(i + 2)] : 0;
        if (!(a >= 0 && b >= 0 && c >= 0)) throw new Error("Not base64");
        out[n++] = (a << 2) | (b >> 4);
        if (rest === 3) out[n++] = ((b & 15) << 4) | (c >> 2);
    }
    return out.subarray(0, n);
}
