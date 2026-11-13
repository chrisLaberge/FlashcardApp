import * as DocumentPicker from "expo-document-picker";
import { Directory, File, FileMode, Paths } from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import * as SQLite from "expo-sqlite";
import { restoreFromBackup, setPdfPath, type RestoreResult } from "../database/database";
import { fromBase64 } from "../models/Base64";
import { applySettings } from "../services/backupSettings";
import { asRollbackJournal, BUNDLE_MAGIC, bundleJsonLength, isBundle, parseBundleHeader } from "../models/BackupBundle";

const PIECE = 4 * 1024 * 1024;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Gets the picked file onto the phone's own storage, trying every route a phone might allow (a file from Google
 * Drive or another app is often only readable one particular way). The reasons for each failure are kept, so if
 * every route fails the message says why.
 */
async function localCopy(uri: string): Promise<File> {
    const target = new File(Paths.cache, `restore-${Date.now()}.tmp`);
    const problems: string[] = [];
    const routes: [string, () => Promise<void>][] = [
        ["copy", async () => LegacyFileSystem.copyAsync({ from: uri, to: target.uri })],
        ["fetch", async () => {
            const bytes = new Uint8Array(await (await fetch(uri)).arrayBuffer());
            if (bytes.length === 0) throw new Error("empty file");
            target.create({ overwrite: true });
            target.write(bytes);
        }],
        ["read", async () => {
            const data = await LegacyFileSystem.readAsStringAsync(uri, { encoding: LegacyFileSystem.EncodingType.Base64 });
            const bytes = fromBase64(data);
            if (bytes.length === 0) throw new Error("empty file");
            target.create({ overwrite: true });
            target.write(bytes);
        }],
    ];
    for (const [name, run] of routes) {
        try {
            await run();
            if (target.exists && target.size > 0) return target;
            problems.push(`${name}: nothing was copied`);
        } catch (error) {
            problems.push(`${name}: ${message(error)}`);
            if (target.exists) target.delete();
        }
    }
    throw new Error(`Could not read the file. ${problems.join(" | ")}`);
}

/** Something that hands out a file's bytes in order. */
type Reader = { readBytes(length: number): Promise<Uint8Array>; close(): void };

/**
 * Opens the picked file piece by piece. Some phones will not give a handle on a picked file (the "read permission
 * missing" error); then the whole file is read at once instead, which works everywhere, at the cost of memory.
 */
async function openReader(file: File): Promise<Reader> {
    try {
        const handle = file.open(FileMode.ReadOnly);
        return { readBytes: async (n) => handle.readBytes(n), close: () => handle.close() };
    } catch {
        const all = new Uint8Array(await file.arrayBuffer());
        let at = 0;
        return {
            readBytes: async (n) => {
                const piece = all.slice(at, at + n);
                at += piece.length;
                return piece;
            },
            close: () => undefined,
        };
    }
}

export type RestoreOutcome = RestoreResult & { /** PDF files that came back with the backup. */ pdfs: number };

/**
 * Lets the user pick a backup file (made by the Export button) and restores it into the app.
 * Resolves to null if they cancel. Throws a readable error if the file cannot be restored, and in
 * that case nothing has been changed (see restoreFromBackup).
 */
export async function pickAndRestoreBackup(): Promise<RestoreOutcome | null> {
    const picked = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: false,
        multiple: false,
    });
    if (picked.canceled) return null;

    const source = await localCopy(picked.assets[0].uri);
    const input = await openReader(source);
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
            // A plain backup (the usual kind): read it the way it always was.
            bytes = new Uint8Array(await source.arrayBuffer());
        }
        // SQLite files start with this text. Checked first so a wrong file gives a clear message.
        const header = String.fromCharCode(...bytes.slice(0, 15));
        if (header !== "SQLite format 3") throw new Error("This file is not a flashcard backup.");

        const backup = await SQLite.deserializeDatabaseAsync(asRollbackJournal(bytes));
        let result: RestoreResult;
        try {
            result = await restoreFromBackup(backup);
            // Settings (theme, daily goal, ...) travel in the backup too. They take effect the next time the app starts.
            const settings = await backup.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM app_settings").catch(() => []);
            await applySettings(settings).catch(() => undefined);
        } finally {
            await backup.closeAsync().catch(() => undefined);
        }
        return { ...result, pdfs: await restorePdfs(input, pdfs) };
    } finally {
        input.close();
        if (source.exists) source.delete(); // the temporary copy
    }
}

/** Writes the PDFs that follow the database in a bundle back to the phone and points their books at them. A failure leaves that book to be added again. */
async function restorePdfs(input: Reader, pdfs: { id: number; size: number }[]): Promise<number> {
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
