import { File, FileMode, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { getPdfBooks, serializeDatabase } from "../database/database";
import { encodeBundleHeader } from "../models/BackupBundle";

const PIECE = 4 * 1024 * 1024;

/** How many books have a PDF file on this phone (so the export can offer to include them). */
export async function countPdfFiles(): Promise<number> {
    const books = await getPdfBooks();
    return books.filter((b) => new File(b.pdfPath).exists).length;
}

/** Shares a backup of the cards and progress; with `withPdfs`, the PDF files go inside it too. */
export async function exportDatabase(withPdfs = false): Promise<void> {
    if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Sharing is not available on this device.");
    }

    const bytes = await serializeDatabase();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const pdfs = withPdfs ? (await getPdfBooks()).map((b) => ({ ...b, file: new File(b.pdfPath) })).filter((b) => b.file.exists && (b.file.size ?? 0) > 0) : [];
    const file = new File(Paths.cache, pdfs.length > 0 ? `flashcards-backup-${stamp}.fcbk` : `flashcards-backup-${stamp}.db`);
    if (file.exists) file.delete();
    file.create();

    if (pdfs.length === 0) {
        file.write(bytes);
    } else {
        const out = file.open(FileMode.WriteOnly);
        try {
            await out.writeBytes(encodeBundleHeader({ db: bytes.length, pdfs: pdfs.map((p) => ({ id: p.id, size: p.file.size })) }));
            await out.writeBytes(bytes);
            // One piece at a time, so a big PDF is never held in memory whole.
            for (const pdf of pdfs) {
                const input = pdf.file.open(FileMode.ReadOnly);
                try {
                    for (let left = pdf.file.size; left > 0;) {
                        const piece = await input.readBytes(Math.min(PIECE, left));
                        if (piece.length === 0) throw new Error("A PDF could not be read all the way.");
                        await out.writeBytes(piece);
                        left -= piece.length;
                    }
                } finally {
                    input.close();
                }
            }
        } finally {
            out.close();
        }
    }

    await Sharing.shareAsync(file.uri, {
        mimeType: "application/octet-stream",
        dialogTitle: "Export flashcards database",
    });
}
