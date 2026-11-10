import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import { addMyText } from "../database/database";
import { base64Chunks } from "../models/Base64";
import { titleFromFileName } from "../models/PdfText";

export class PdfError extends Error {}

const folder = () => new Directory(Paths.document, "pdfs");

/** Lets the person pick a PDF and keeps a copy on the phone. Everything after that happens on the phone too. Null if they cancelled. */
export async function addPdf(language: string): Promise<number | null> {
    const picked = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.[0]) return null;
    const asset = picked.assets[0];

    const source = new File(asset.uri);
    let header = "";
    try {
        header = await source.slice(0, 5).text();
    } catch {
        throw new PdfError("Could not open that file.");
    }
    if (header !== "%PDF-") throw new PdfError("That is not a PDF.");

    try {
        const directory = folder();
        if (!directory.exists) directory.create({ intermediates: true });
        const target = new File(directory, `${Date.now()}.pdf`);
        source.copy(target);
        return await addMyText(titleFromFileName(asset.name), language, "", Date.now(), target.uri);
    } catch (error) {
        throw new PdfError(`Could not save the PDF.${error instanceof Error ? ` (${error.message.slice(0, 100)})` : ""}`);
    }
}

/** The PDF's bytes as base64 pieces, ready to hand to the reader page. */
export async function pdfChunks(path: string): Promise<string[]> {
    const file = new File(path);
    if (!file.exists) throw new PdfError("The PDF file is missing. Add it again.");
    return base64Chunks(new Uint8Array(await file.arrayBuffer()));
}

/** Removes a book's PDF file; a file that is already gone is fine. */
export function removePdfFile(path: string | null): void {
    if (!path) return;
    try {
        const file = new File(path);
        if (file.exists) file.delete();
    } catch {
        // Nothing more to do; the book is already gone.
    }
}
