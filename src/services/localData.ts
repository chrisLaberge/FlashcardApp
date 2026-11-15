import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, Paths } from "expo-file-system";
import { hasLocalData, wipeAllData } from "../database/database";

const OWNER_KEY = "data-owner-uid";

/**
 * Decks and progress live on the phone, so they must belong to one account. The first account to sign in
 * on a phone that already has cards claims them (this is how people who used the app before accounts keep
 * their cards). Another account signing in later is told, instead of silently getting someone else's cards.
 */
export async function claimLocalData(uid: string): Promise<"mine" | "foreign"> {
    const owner = await AsyncStorage.getItem(OWNER_KEY);
    if (owner === uid) return "mine";
    if (owner && (await hasLocalData())) return "foreign";
    await AsyncStorage.setItem(OWNER_KEY, uid);
    return "mine";
}

/** Removes everything about the studying from this phone: cards, progress, pet, books, saved PDFs and settings. The sign-in itself is kept. */
export async function eraseLocalData(): Promise<void> {
    await wipeAllData();
    for (const name of ["pdfs", "images"]) {
        try {
            const folder = new Directory(Paths.document, name);
            if (folder.exists) folder.delete();
        } catch {
            // A file that cannot be removed is only wasted space.
        }
    }
    // Firebase keeps the sign-in in the same storage; those keys must stay or the person is signed out.
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => !key.startsWith("firebase:"));
    await AsyncStorage.multiRemove(keys);
}
