import AsyncStorage from "@react-native-async-storage/async-storage";
import { saveAppSettings } from "../database/database";

/** The settings kept outside the database. They are copied into it when a backup is made and put back when one is restored. */
export const SETTING_KEYS = ["learnSettings", "daily-goal", "daily-goal-celebrated", "app-theme", "last-level-seen"] as const;

export async function snapshotSettings(): Promise<void> {
    const pairs = await AsyncStorage.multiGet([...SETTING_KEYS]);
    const entries: Record<string, string> = {};
    for (const [key, value] of pairs) if (value !== null) entries[key] = value;
    await saveAppSettings(entries);
}

/** Puts back settings read from a backup. Only the known keys are accepted. */
export async function applySettings(rows: { key: string; value: string }[]): Promise<void> {
    const wanted = rows.filter((r) => (SETTING_KEYS as readonly string[]).includes(r.key));
    if (wanted.length > 0) await AsyncStorage.multiSet(wanted.map((r) => [r.key, r.value]));
}
