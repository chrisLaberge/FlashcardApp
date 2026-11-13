import * as DocumentPicker from "expo-document-picker";
import { Directory, File, FileMode, Paths } from "expo-file-system";
import * as SQLite from "expo-sqlite";
import { restoreFromBackup, setPdfPath, type RestoreResult } from "../database/database";
import { BUNDLE_MAGIC, bundleJsonLength, isBundle, parseBundleHeader } from "../models/BackupBundle";

const PIECE = 4 * 1024 * 1024;

export type RestoreOutcome = RestoreResult & { /** PDF files that came back with the backup. */ pdfs: number };

/**
 * Lets the user pick a backup file (made by the Export button) and restores it into the app.
 * Resolves to null if they cancel. Throws a readable error if the file cannot be restored, and in
 * that case nothing has been changed (see restoreFromBackup).
 */
export async function pickAndRestoreBackup(): Promise<RestoreOutcome | null> {
    const picked = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
    });
    if (picked.canceled) return null;

    const source = new File(picked.assets[0].uri);
    const input = source.open(FileMode.ReadOnly);
    try {
        const start = await input.readBytes(BUNDLE_MAGIC.length + 4);
        let bytes: Uint8Array;
        let pdfs: { id: number; size: number }[] = [];
        if (isBundle(start)) {
            const header = parseBundleHeader(await input.readBytes(bundleJsonLength(start)));
            if (!header) throw new Error("This file is not a flashcard backup.");
            bytes = await input.readBytes(header.db);
            pdfs = header.pdfs;
        } else {
            input.offset = 0;
            bytes = await input.readBytes(source.size);
        }
        // SQLite files start with this text. Checked first so a wrong file gives a clear message.
        const header = String.fromCharCode(...bytes.slice(0, 15));
        if (header !== "SQLite format 3") throw new Error("This file is not a flashcard backup.");

        const backup = await SQLite.deserializeDatabaseAsync(bytes);
        let result: RestoreResult;
        try {
            result = await restoreFromBackup(backup);
        } finally {
            await backup.closeAsync().catch(() => undefined);
        }
        return { ...result, pdfs: await restorePdfs(input, pdfs) };
    } finally {
        input.close();
    }
}

/** Writes the PDFs that follow the database in a bundle back to the phone and points their books at them. A failure leaves that book to be added again. */
async function restorePdfs(input: ReturnType<File["open"]>, pdfs: { id: number; size: number }[]): Promise<number> {
    if (pdfs.length === 0) return 0;
    const folder = new Directory(Paths.document, "pdfs");
    if (!folder.exists) folder.create({ intermediates: true });
    let restored = 0;
    for (const pdf of pdfs) {
        const target = new File(folder, `${Date.now()}-${pdf.id}.pdf`);
        try {
            const out = (target.create(), target.open(FileMode.WriteOnly));
            try {
                for (let left = pdf.size; left > 0;) {
                    const piece = await input.readBytes(Math.min(PIECE, left));
                    if (piece.length === 0) throw new Error("The backup ends early.");
                    await out.writeBytes(piece);
                    left -= piece.length;
                }
            } finally {
                out.close();
            }
            await setPdfPath(pdf.id, target.uri);
            restored += 1;
        } catch {
            // The file is cut short, so the pieces after it cannot be found; stop here.
            if (target.exists) target.delete();
            break;
        }
    }
    return restored;
}
