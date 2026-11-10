import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { getLanguage } from "../../constants/languages";
import { getDecks } from "../../database/database";
import { premadeDecks, premadeDecksFor, type PremadeDeck } from "../../models/PremadeDecks";
import { readings, readingsFor } from "../../models/Readings";
import { installPremadeDeck } from "../../services/premadeDecks";
import { useTheme } from "../../theme/ThemeProvider";
import type { Palette } from "../../theme/themes";

type Owned = { name: string; language: string };

// Languages that have something in the library, in the order they were written.
const libraryLanguages = [...new Set([...premadeDecks.map((d) => d.language), ...readings.map((r) => r.language)])];

export default function LibraryScreen() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const [owned, setOwned] = useState<Owned[]>([]);
    const [picking, setPicking] = useState(false);
    const [deckLanguage, setDeckLanguage] = useState<string | null>(null);
    const [chosen, setChosen] = useState<string | null>(null);
    const [tab, setTab] = useState<"decks" | "reading">("decks");
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        const [decks, lastDeckId] = await Promise.all([getDecks(), AsyncStorage.getItem("lastDeckId")]);
        setOwned(decks.map((d) => ({ name: d.name, language: d.language })));
        setDeckLanguage(decks.find((d) => d.id === Number(lastDeckId))?.language ?? null);
    }, []);

    useFocusEffect(useCallback(() => { void load(); }, [load]));

    // Start on the language of the deck being studied, if the library has something for it.
    const language = chosen ?? (deckLanguage && libraryLanguages.includes(deckLanguage) ? deckLanguage : libraryLanguages[0]);
    const lang = getLanguage(language);
    const decks = premadeDecksFor(language);
    const texts = readingsFor(language);

    const add = async (deck: PremadeDeck) => {
        if (busyId) return;
        setBusyId(deck.id);
        try {
            await installPremadeDeck(deck);
            await load();
        } catch (error) {
            Alert.alert("Could not add the deck", error instanceof Error ? error.message : String(error));
        } finally {
            setBusyId(null);
        }
    };

    return (
        <View style={s.container}>
            <View style={s.dropWrap}>
                <Pressable style={({ pressed }) => [s.deckButton, pressed && { opacity: 0.7 }]} onPress={() => setPicking(true)} accessibilityRole="button" accessibilityLabel="Choose a language">
                    <Text style={s.dropFlag}>{lang?.flag ?? "🌐"}</Text>
                    <Text style={s.deckName} numberOfLines={1}>{lang?.name ?? language}</Text>
                    <Text style={s.dropArrow}>▼</Text>
                </Pressable>
            </View>

            <Modal visible={picking} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPicking(false)}>
                <Pressable style={s.backdrop} onPress={() => setPicking(false)}>
                    <View style={s.menu}>
                        {libraryLanguages.map((code) => (
                            <Pressable key={code} style={[s.menuRow, code === language && s.menuRowOn]} onPress={() => { setChosen(code); setPicking(false); }} accessibilityRole="button">
                                <Text style={s.dropFlag}>{getLanguage(code)?.flag ?? "🌐"}</Text>
                                <Text style={s.menuText}>{getLanguage(code)?.name ?? code}</Text>
                            </Pressable>
                        ))}
                    </View>
                </Pressable>
            </Modal>

            <View style={s.toggle}>
                {(["decks", "reading"] as const).map((w) => (
                    <Pressable key={w} style={[s.tab, tab === w && s.tabOn]} onPress={() => setTab(w)}>
                        <Text style={[s.tabText, tab === w && s.tabTextOn]}>{w === "decks" ? "Decks" : "Reading"}</Text>
                    </Pressable>
                ))}
            </View>

            {tab === "decks" ? (
                <FlatList
                    data={decks}
                    keyExtractor={(d) => d.id}
                    contentContainerStyle={s.list}
                    ListHeaderComponent={<Text style={s.hint}>Add a deck and it becomes your own. Change or delete its cards any time.</Text>}
                    ListEmptyComponent={<Text style={s.empty}>No premade decks for {lang?.name ?? "this language"} yet.</Text>}
                    renderItem={({ item }) => {
                        const done = owned.some((d) => d.name === item.name && d.language === item.language);
                        return (
                            <View style={s.card}>
                                <Text style={s.flag}>{lang?.flag ?? "🌐"}</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.name}>{item.name}</Text>
                                    <Text style={s.meta}>{item.cards.length} cards · {item.description}</Text>
                                </View>
                                <Pressable
                                    style={({ pressed }) => [s.button, done && s.buttonDone, pressed && s.pressed]}
                                    onPress={() => add(item)}
                                    disabled={done || busyId !== null}
                                    accessibilityRole="button"
                                >
                                    {busyId === item.id ? <ActivityIndicator color={t.bg} /> : <Text style={[s.buttonText, done && s.buttonTextDone]}>{done ? "Added ✓" : "Add"}</Text>}
                                </Pressable>
                            </View>
                        );
                    }}
                />
            ) : (
                <FlatList
                    data={texts}
                    keyExtractor={(r) => r.id}
                    contentContainerStyle={s.list}
                    ListHeaderComponent={<Text style={s.hint}>Tap any word while reading to see what it means and add it as a card.</Text>}
                    ListEmptyComponent={<Text style={s.empty}>No reading for {lang?.name ?? "this language"} yet.</Text>}
                    renderItem={({ item }) => (
                        <Pressable
                            style={({ pressed }) => [s.card, pressed && s.pressed]}
                            onPress={() => router.push({ pathname: "/reading", params: { id: item.id } })}
                            accessibilityRole="button"
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={s.name}>{item.title}</Text>
                                <Text style={s.meta}>{item.titleMeaning} · {item.level} · {item.lines.length} lines</Text>
                            </View>
                            <Text style={s.arrow}>›</Text>
                        </Pressable>
                    )}
                />
            )}
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg, paddingHorizontal: 16, paddingTop: 12 },
    dropWrap: { flexDirection: "row" },
    deckButton: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 10, backgroundColor: t.surface, borderWidth: 1, borderColor: t.surfaceHigh, borderRadius: 8 },
    deckName: { flexShrink: 1, color: t.text, fontSize: 13, fontWeight: "600", marginLeft: 6 },
    dropFlag: { fontSize: 16 },
    dropArrow: { color: t.muted, fontSize: 9, marginLeft: 6 },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 28 },
    menu: { backgroundColor: t.surface, borderRadius: 14, borderWidth: 1, borderColor: t.surfaceHigh, paddingVertical: 6 },
    menuRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 16 },
    menuRowOn: { backgroundColor: t.surfaceHigh },
    menuText: { color: t.text, fontSize: 16, fontWeight: "600" },
    toggle: { flexDirection: "row", backgroundColor: t.surface, borderRadius: 12, padding: 4, marginTop: 12, marginBottom: 8 },
    tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 9 },
    tabOn: { backgroundColor: t.surfaceHigh },
    tabText: { color: t.muted, fontWeight: "600" },
    tabTextOn: { color: t.text },
    list: { paddingTop: 6, paddingBottom: 40 },
    hint: { color: t.muted, fontSize: 13, marginBottom: 12 },
    empty: { color: t.muted, textAlign: "center", marginTop: 40 },
    card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.surface, borderRadius: 14, padding: 14, marginBottom: 10 },
    flag: { fontSize: 30 },
    name: { color: t.text, fontSize: 16, fontWeight: "600" },
    meta: { color: t.muted, fontSize: 12, marginTop: 2 },
    arrow: { color: t.muted, fontSize: 24 },
    button: { backgroundColor: t.green, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10, minWidth: 74, alignItems: "center" },
    buttonDone: { backgroundColor: t.surfaceHigh },
    buttonText: { color: t.bg, fontSize: 14, fontWeight: "bold" },
    buttonTextDone: { color: t.text },
    pressed: { opacity: 0.7 },
});
