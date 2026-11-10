import * as DocumentPicker from "expo-document-picker";
import { FileSystemUploadType, uploadAsync } from "expo-file-system/legacy";
import { addMyText } from "../database/database";
import { titleFromFileName } from "../models/PdfText";
import { authHeaders } from "./auth";
import { API_URL } from "./imageApi";

export class PdfError extends Error {}

function messageFor(status: number | null, detail?: string): string {
    if (status === null) return `Could not reach the server.${detail ? ` (${detail})` : ""}`;
    if (status === 401) return "Sign in first (Account tab) to add PDFs.";
    if (status === 413) return "That PDF is too big.";
    if (status === 404) return "The server does not support PDFs yet.";
    if (status === 422) return "No text found. Scanned PDFs do not work.";
    if (status === 429) return "Too many PDFs just now. Try again later.";
    return "Could not read that PDF.";
}

/** Lets the person pick a PDF, reads its text on the server and saves it. Returns the new id, or null if they cancelled. */
export async function addPdf(language: string): Promise<number | null> {
    const picked = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.[0]) return null;
    const file = picked.assets[0];

    // The phone streams the file straight from disk to the server, so even a big PDF is not loaded into memory.
    let status: number;
    let body: string;
    try {
        const result = await uploadAsync(`${API_URL}/pdf/text`, file.uri, {
            httpMethod: "POST",
            uploadType: FileSystemUploadType.BINARY_CONTENT,
            headers: { "Content-Type": "application/pdf", ...(await authHeaders()) },
        });
        status = result.status;
        body = result.body;
    } catch (error) {
        // The reason is shown so a failure can be told apart (offline, timeout, file unreadable).
        throw new PdfError(messageFor(null, error instanceof Error ? error.message.slice(0, 120) : undefined));
    }
    if (status < 200 || status >= 300) throw new PdfError(messageFor(status));

    let data: { text?: unknown } | null = null;
    try {
        data = JSON.parse(body) as { text?: unknown };
    } catch {
        // handled below
    }
    if (typeof data?.text !== "string" || data.text.trim() === "") throw new PdfError(messageFor(422));
    return addMyText(titleFromFileName(file.name), language, data.text);
}
