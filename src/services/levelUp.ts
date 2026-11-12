import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "last-level-seen";

type Listener = (level: number) => void;
const listeners = new Set<Listener>();

/** Calls `listener` when the player reaches a new level. Returns the way to stop listening. */
export function onLevelUp(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * Compares the level with the last one the player was told about. The very first call only remembers the
 * level (nobody is congratulated for the level they already had); a lower level is remembered quietly.
 */
export async function checkLevelUp(level: number): Promise<boolean> {
    let seen: number | null = null;
    try {
        const raw = await AsyncStorage.getItem(KEY);
        seen = raw === null ? null : Number(raw);
        if (seen !== null && !Number.isFinite(seen)) seen = null;
        if (seen !== level) await AsyncStorage.setItem(KEY, String(level));
    } catch {
        return false;
    }
    if (seen === null || level <= seen) return false;
    listeners.forEach((listener) => listener(level));
    return true;
}
