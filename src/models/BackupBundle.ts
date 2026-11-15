/**
 * A backup that also carries PDF files. Layout: the 6 letters "FCBK1\n", a 4-byte header length (big end first),
 * the header (JSON), then the database bytes and each PDF's bytes one after another, in the header's order.
 * A plain backup (a bare SQLite file) is still accepted everywhere; this is only for ones with PDFs.
 */
export const BUNDLE_MAGIC = "FCBK1\n";

export type BundleHeader = { db: number; pdfs: { id: number; size: number }[] };

export function encodeBundleHeader(header: BundleHeader): Uint8Array {
    const json = new TextEncoder().encode(JSON.stringify(header));
    const out = new Uint8Array(BUNDLE_MAGIC.length + 4 + json.length);
    out.set(new TextEncoder().encode(BUNDLE_MAGIC), 0);
    new DataView(out.buffer).setUint32(BUNDLE_MAGIC.length, json.length);
    out.set(json, BUNDLE_MAGIC.length + 4);
    return out;
}

export const isBundle = (start: Uint8Array): boolean => BUNDLE_MAGIC.split("").every((c, i) => start[i] === c.charCodeAt(0));

/** The length of the header's JSON, from the first 10 bytes of a bundle. */
export function bundleJsonLength(start: Uint8Array): number {
    return new DataView(start.buffer, start.byteOffset, start.byteLength).getUint32(BUNDLE_MAGIC.length);
}

/** Reads the header and checks it makes sense; null if it does not. */
export function parseBundleHeader(json: Uint8Array): BundleHeader | null {
    try {
        const value = JSON.parse(new TextDecoder().decode(json)) as BundleHeader;
        const ok = Number.isInteger(value.db) && value.db > 0 && Array.isArray(value.pdfs)
            && value.pdfs.every((p) => Number.isInteger(p.id) && Number.isInteger(p.size) && p.size > 0);
        return ok ? value : null;
    } catch {
        return null;
    }
}

/**
 * A database saved while it was in WAL mode has "2" in two header bytes (offsets 18 and 19). Opened as a backup it
 * then looks for a journal file that does not exist and fails with "unable to open database file" (error 14).
 * The saved bytes already hold everything, so those two bytes are set to "1" (the normal mode) before opening.
 */
export function asRollbackJournal(bytes: Uint8Array): Uint8Array {
    if (bytes.length < 20 || (bytes[18] !== 2 && bytes[19] !== 2)) return bytes;
    const copy = new Uint8Array(bytes);
    copy[18] = 1;
    copy[19] = 1;
    return copy;
}
