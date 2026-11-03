import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { serializeDatabase } from "../database/database";

export async function exportDatabase(): Promise<void> {
    if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Sharing is not available on this device.");
    }

    const bytes = await serializeDatabase();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = new File(Paths.cache, `flashcards-backup-${stamp}.db`);

    file.create();
    file.write(bytes);

    await Sharing.shareAsync(file.uri, {
        mimeType: "application/octet-stream",
        dialogTitle: "Export flashcards database",
    });
}