import * as DocumentPicker from "expo-document-picker";
import { addMyText } from "../database/database";
import { titleFromFileName } from "../models/PdfText";
import { authHeaders } from "./auth";
import { API_URL } from "./imageApi";

const TIMEOUT_MS = 60_000;

export class PdfError extends Error {}

function messageFor(status: number | null): string {
    if (status === null) return "Could not reach the server. Check your connection.";
    if (status === 401) return "Sign in first (Account tab) to add PDFs.";
    if (status === 413) return "That PDF is too big.";
    if (status === 422) return "No text found. Scanned PDFs do not work.";
    if (status === 429) return "Too many PDFs just now. Try again later.";
    return "Could not read that PDF.";
}

/** Lets the person pick a PDF, reads its text on the server and saves it. Returns the new id, or null if they cancelled. */
export async function addPdf(language: string): Promise<number | null> {
    const picked = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.[0]) return null;
    const file = picked.assets[0];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
        const bytes = await (await fetch(file.uri)).blob();
        response = await fetch(`${API_URL}/pdf/text`, {
            method: "POST",
            headers: { "Content-Type": "application/pdf", ...(await authHeaders()) },
            body: bytes,
            signal: controller.signal,
        });
    } catch {
        throw new PdfError(messageFor(null));
    } finally {
        clearTimeout(timer);
    }
    if (!response.ok) throw new PdfError(messageFor(response.status));

    const data = (await response.json().catch(() => null)) as { text?: unknown } | null;
    if (typeof data?.text !== "string" || data.text.trim() === "") throw new PdfError(messageFor(422));
    return addMyText(titleFromFileName(file.name), language, data.text);
}
