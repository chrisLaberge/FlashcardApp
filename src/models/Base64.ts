/** Cuts a base64 string into pieces of about `size` characters. Each piece is a multiple of 4 long, so each decodes on its own. */
export function splitBase64(data: string, size = 256 * 1024): string[] {
    const step = Math.max(4, size - (size % 4));
    const out: string[] = [];
    for (let i = 0; i < data.length; i += step) out.push(data.slice(i, i + step));
    return out;
}
