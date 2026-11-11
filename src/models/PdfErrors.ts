/** A short, plain reason for a PDF that could not be opened, from the name pdf.js gives its error. */
export function friendlyPdfError(code: string | undefined, message = ""): string {
    switch (code) {
        case "PasswordException":
            return "This PDF is password protected.";
        case "InvalidPDFException":
            return "This file is damaged or is not a PDF.";
        case "MissingPDFException":
            return "The PDF file is missing. Add it again.";
        default:
            return /password/i.test(message) ? "This PDF is password protected." : "Could not read this PDF.";
    }
}

/** Biggest PDF we will take in. The file stays on the phone, but a bigger one cannot be handled safely. */
export const MAX_PDF_BYTES = 150 * 1024 * 1024;

/** Bytes read from the file and sent to the reader page at a time (a multiple of 3, so each piece is whole base64). */
export const CHUNK_BYTES = 192 * 1024;

export const chunkCount = (bytes: number): number => Math.ceil(bytes / CHUNK_BYTES);
