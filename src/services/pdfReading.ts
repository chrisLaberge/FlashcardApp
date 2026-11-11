import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { addMyText } from "../database/database";
import { splitBase64 } from "../models/Base64";
import { titleFromFileName } from "../models/PdfText";

export class PdfError extends Error {}

const detail = (error: unknown) => (error instanceof Error ? error.message.slice(0, 140) : String(error).slice(0, 140));

/**
 * Pick a PDF and keep a copy on the phone. No account and no internet needed: reading, selecting
 * and counting words all happen on the phone. Returns the new book's id, or null if cancelled.
 */
export async function addPdf(language: string): Promise<number | null> {
    let picked: DocumentPicker.DocumentPickerResult;
    try {
        picked = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: false });
    } catch (error) {
        throw new PdfError(`Could not open the file picker. (${detail(error)})`);
    }
    if (picked.canceled || !picked.assets?.[0]) return null;
    const asset = picked.assets[0];
    if (!/\.pdf$/i.test(asset.name) && asset.mimeType !== "application/pdf") throw new PdfError("Pick a PDF file.");

    const base = FileSystem.documentDirectory;
    if (!base) throw new PdfError("This device has no place to keep files.");
    const folder = `${base}pdfs/`;
    const target = `${folder}${Date.now()}.pdf`;
    try {
        await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
        await FileSystem.copyAsync({ from: asset.uri, to: target });
    } catch (error) {
        throw new PdfError(`Could not save the PDF. (${detail(error)})`);
    }
    try {
        return await addMyText(titleFromFileName(asset.name), language, "", Date.now(), target);
    } catch (error) {
        await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => undefined);
        throw new PdfError(`Could not add the PDF. (${detail(error)})`);
    }
}

/** The PDF as base64 pieces, ready to hand to the reader page. */
export async function pdfChunks(path: string): Promise<string[]> {
    const info = await FileSystem.getInfoAsync(path).catch(() => null);
    if (!info?.exists) throw new PdfError("The PDF file is missing. Add it again.");
    try {
        return splitBase64(await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 }));
    } catch (error) {
        throw new PdfError(`Could not read the PDF. (${detail(error)})`);
    }
}

/** Removes a book's PDF file; one that is already gone is fine. */
export function removePdfFile(path: string | null): void {
    if (path) void FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
}
