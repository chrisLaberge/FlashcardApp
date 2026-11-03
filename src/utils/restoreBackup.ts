import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as SQLite from "expo-sqlite";
import { restoreFromBackup, type RestoreResult } from "../database/database";

/**
 * Lets the user pick a backup file (made by the Export button) and restores it into the app.
 * Resolves to null if they cancel. Throws a readable error if the file cannot be restored, and in
 * that case nothing has been changed (see restoreFromBackup).
 */
export async function pickAndRestoreBackup(): Promise<RestoreResult | null> {
    const picked = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
    });
    if (picked.canceled) return null;

    const bytes = new Uint8Array(await new File(picked.assets[0].uri).arrayBuffer());
    // SQLite files start with this text. Checked first so a wrong file gives a clear message.
    const header = String.fromCharCode(...bytes.slice(0, 15));
    if (header !== "SQLite format 3") throw new Error("This file is not a flashcard backup.");

    const backup = await SQLite.deserializeDatabaseAsync(bytes);
    try {
        return await restoreFromBackup(backup);
    } finally {
        await backup.closeAsync().catch(() => undefined);
    }
}
