import * as DocumentPicker from "expo-document-picker";
import { File as NewFile } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import { addMyText } from "../database/database";
import { CHUNK_BYTES, chunkCount, MAX_PDF_BYTES } from "../models/PdfErrors";
import { titleFromFileName } from "../models/PdfText";

export class PdfError extends Error {}

const detail = (error: unknown) => (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ").slice(0, 400);

/**
 * Pick a PDF and keep a copy on the phone. No account and no internet needed: reading, selecting
 * and counting words all happen on the phone. Returns the new book's id, or null if cancelled.
 */
export async function addPdf(language: string): Promise<number | null> {
    let picked: DocumentPicker.DocumentPickerResult;
    try {
        picked = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: false, multiple: false });
    } catch (error) {
        throw new PdfError(`Could not open the file picker. (${detail(error)})`);
    }
    if (picked.canceled || !picked.assets?.[0]) return null;
    const asset = picked.assets[0];
    if (!/\.pdf$/i.test(asset.name) && asset.mimeType !== "application/pdf") throw new PdfError("Pick a PDF file.");

    if (typeof asset.size === "number" && asset.size > MAX_PDF_BYTES) throw new PdfError("This PDF is too large (over 150 MB).");
    const target = await saveCopy(asset.uri);
    try {
        return await addMyText(titleFromFileName(asset.name), language, "", Date.now(), target);
    } catch (error) {
        await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => undefined);
        throw new PdfError(`Could not add the PDF. (${detail(error)})`);
    }
}

/**
 * Sends a PDF to a reader page piece by piece, reading the file a little at a time so a big PDF never sits
 * in memory whole. `open` goes first and says how many pieces follow. `step` is called between pieces, and
 * `cancelled` stops the sending (the book was deleted or the page closed).
 */
export async function sendPdf(path: string, open: object, send: (message: object) => void, step?: () => void, cancelled?: () => boolean): Promise<void> {
    const info = await FileSystem.getInfoAsync(path).catch(() => null);
    if (!info?.exists) throw new PdfError("The PDF file is missing. Add it again.");
    const size = "size" in info ? info.size : 0;
    if (size > MAX_PDF_BYTES) throw new PdfError("This PDF is too large (over 150 MB).");
    if (size === 0) throw new PdfError("This PDF is empty.");
    const count = chunkCount(size);
    send({ ...open, chunks: count });
    for (let i = 0; i < count; i++) {
        if (cancelled?.()) return; // the page this was for is gone; do not feed a different one
        let data: string;
        try {
            data = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64, position: i * CHUNK_BYTES, length: CHUNK_BYTES });
        } catch (error) {
            throw new PdfError(`Could not read the PDF. (${detail(error)})`);
        }
        send({ t: "chunk", i, d: data });
        step?.();
        // Let the screen breathe between pieces.
        if (i % 4 === 3) await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
}

/** Removes a book's PDF file; one that is already gone is fine. */
export function removePdfFile(path: string | null): void {
    if (path) void FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
}

/**
 * Keeps a copy of the picked file. Tries the permanent folder first and the cache folder if that is refused,
 * and for each tries a straight copy, then reading and writing the bytes (which works where a copy is not allowed).
 */
async function saveCopy(from: string): Promise<string> {
    const places = [FileSystem.documentDirectory, FileSystem.cacheDirectory].filter((p): p is string => !!p);
    if (places.length === 0) throw new PdfError("This device has no place to keep files.");
    const problems: string[] = [];
    for (const base of places) {
        const folder = `${base}pdfs/`;
        const target = `${folder}${Date.now()}.pdf`;
        try {
            await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => undefined);
            await copyBytes(from, target, problems);
            return target;
        } catch (error) {
            problems.push(detail(error));
        }
    }
    throw new PdfError(`Could not save the PDF [v3]. ${problems.join(" | ")}`);
}

/** Gets a file's bytes to `to` by whichever route this phone allows; the reasons for the ones that fail are added to `problems`. */
async function copyBytes(from: string, to: string, problems: string[]): Promise<void> {
    const routes: [string, () => Promise<void>][] = [
        ["copy", () => FileSystem.copyAsync({ from, to })],
        ["read", async () => {
            const data = await FileSystem.readAsStringAsync(from, { encoding: FileSystem.EncodingType.Base64 });
            await FileSystem.writeAsStringAsync(to, data, { encoding: FileSystem.EncodingType.Base64 });
        }],
        ["fetch", async () => {
            const bytes = new Uint8Array(await (await fetch(from)).arrayBuffer());
            if (bytes.length === 0) throw new Error("empty file");
            const out = new NewFile(to);
            out.create({ overwrite: true });
            out.write(bytes);
        }],
    ];
    for (const [name, run] of routes) {
        try {
            await run();
            return;
        } catch (error) {
            problems.push(`${name}: ${detail(error)}`);
        }
    }
    throw new Error("all routes failed");
}
