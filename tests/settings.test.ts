import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    DEFAULT_LEARN_SETTINGS,
    LEARN_SETTINGS_KEY,
    loadLearnSettings,
    saveLearnSettings,
} from "@/settings";

beforeEach(async () => {
    await AsyncStorage.clear();
});

describe("learn settings", () => {
    test("defaults keep the app's previous behaviour (speak and show romanization)", async () => {
        expect(await loadLearnSettings()).toEqual({ autoSpeak: true, showRomanization: true, listeningCards: true });
        expect(DEFAULT_LEARN_SETTINGS).toEqual({ autoSpeak: true, showRomanization: true, listeningCards: true });
    });

    test("saved choices survive a reload", async () => {
        await saveLearnSettings({ autoSpeak: false, showRomanization: true, listeningCards: false });
        expect(await loadLearnSettings()).toEqual({ autoSpeak: false, showRomanization: true, listeningCards: false });
        await saveLearnSettings({ autoSpeak: true, showRomanization: false, listeningCards: true });
        expect(await loadLearnSettings()).toEqual({ autoSpeak: true, showRomanization: false, listeningCards: true });
    });

    test("a missing field falls back to its default", async () => {
        await AsyncStorage.setItem(LEARN_SETTINGS_KEY, JSON.stringify({ autoSpeak: false }));
        expect(await loadLearnSettings()).toEqual({ autoSpeak: false, showRomanization: true, listeningCards: true });
    });

    test("wrong types and corrupt data fall back instead of breaking the screen", async () => {
        await AsyncStorage.setItem(LEARN_SETTINGS_KEY, JSON.stringify({ autoSpeak: "no", showRomanization: 0 }));
        expect(await loadLearnSettings()).toEqual(DEFAULT_LEARN_SETTINGS);
        await AsyncStorage.setItem(LEARN_SETTINGS_KEY, "{not json");
        expect(await loadLearnSettings()).toEqual(DEFAULT_LEARN_SETTINGS);
    });
});
