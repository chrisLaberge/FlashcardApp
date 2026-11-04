import AsyncStorage from "@react-native-async-storage/async-storage";
import { addHidden, parseHidden } from "../utils/hiddenUsers";

const KEY = "hidden-leaderboard-users";

export async function loadHidden(): Promise<string[]> {
    try {
        return parseHidden(await AsyncStorage.getItem(KEY));
    } catch {
        return [];
    }
}

export async function hideUser(uid: string): Promise<string[]> {
    const next = addHidden(await loadHidden(), uid);
    try {
        await AsyncStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        // hidden for this visit only
    }
    return next;
}
