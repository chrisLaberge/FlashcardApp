import AsyncStorage from "@react-native-async-storage/async-storage";

/** Preferences for the learn screen. */
export type LearnSettings = {
    /** Read the learning text aloud whenever it appears. The speaker buttons always work. */
    autoSpeak: boolean;
    /** Show the romanization under the learning text. */
    showRomanization: boolean;
    /**
     * Allow listening-only reviews (sound, no text) for well-known cards. Off: those reviews show
     * the learning word instead. Needs automatic pronunciation to be on.
     */
    listeningCards: boolean;
};

/** Defaults match how the app behaved before these settings existed. */
export const DEFAULT_LEARN_SETTINGS: LearnSettings = {
    autoSpeak: true,
    showRomanization: true,
    listeningCards: true,
};

export const LEARN_SETTINGS_KEY = "learnSettings";

export async function loadLearnSettings(): Promise<LearnSettings> {
    try {
        const raw = await AsyncStorage.getItem(LEARN_SETTINGS_KEY);
        if (!raw) return DEFAULT_LEARN_SETTINGS;
        const parsed = JSON.parse(raw) as Partial<LearnSettings>;
        return {
            autoSpeak: typeof parsed.autoSpeak === "boolean" ? parsed.autoSpeak : DEFAULT_LEARN_SETTINGS.autoSpeak,
            showRomanization:
                typeof parsed.showRomanization === "boolean"
                    ? parsed.showRomanization
                    : DEFAULT_LEARN_SETTINGS.showRomanization,
            listeningCards:
                typeof parsed.listeningCards === "boolean"
                    ? parsed.listeningCards
                    : DEFAULT_LEARN_SETTINGS.listeningCards,
        };
    } catch {
        return DEFAULT_LEARN_SETTINGS; // unreadable or corrupt: fall back rather than break the screen
    }
}

export async function saveLearnSettings(settings: LearnSettings): Promise<void> {
    try {
        await AsyncStorage.setItem(LEARN_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
        console.error("Failed to save settings:", error);
    }
}
