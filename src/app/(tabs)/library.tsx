import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getLanguage, languages } from "../../constants/languages";
import { deleteMyText, getCards, getDecks, getMyTexts } from "../../database/database";
import { cardKey, premadeDecks, premadeDecksFor, presentIndexes, targetDeckFor } from "../../models/PremadeDecks";
import { addPdf } from "../../services/pdfReading";
import { useTheme } from "../../theme/ThemeProvider";
import type { Palette } from "../../theme/themes";


// Every language in the app. The ones with premade decks come first.
const withContent = new Set(premadeDecks.map((d) => d.language));
const libraryLanguages = [
    ...languages.filter((l) => withContent.has(l.code)).map((l) => l.code),
    ...languages.filter((l) => !withContent.has(l.code)).map((l) => l.code),
];

export default function LibraryScreen() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    // Words in the deck premade cards go into, per language.
    const [owned, setOwned] = useState<Map<string, Set<string>>>(new Map());
    const [picking, setPicking] = useState(false);
    const [deckLanguage, setDeckLanguage] = useState<string | null>(null);
    const [chosen, setChosen] = useState<string | null>(null);
    const [tab, setTab] = useState<"decks" | "pdfs">("decks");
    const [texts, setTexts] = useState<{ id: number; title: string }[]>([]);
    const [adding, setAdding] = useState(false);

    const load = useCallback(async () => {
        const [decks, lastDeckId] = await Promise.all([getDecks(), AsyncStorage.getItem("lastDeckId")]);
        const last = lastDeckId ? Number(lastDeckId) : null;
        const words = new Map<string, Set<string>>();
        for (const code of new Set(decks.map((d) => d.language))) {
            const target = targetDeckFor(decks, code, last);
            if (target) words.set(code, new Set((await getCards(target.id)).map((c) => cardKey(c.learningText))));
        }
        setOwned(words);
        setDeckLanguage(decks.find((d) => d.id === Number(lastDeckId))?.language ?? null);
    }, []);

    useFocusEffect(useCallback(() => { void load(); }, [load]));

    // Start on the language of the deck being studied, if the library has something for it.
    const language = chosen ?? (deckLanguage && libraryLanguages.includes(deckLanguage) ? deckLanguage : libraryLanguages[0]);
    const lang = getLanguage(language);
    const decks = premadeDecksFor(language);

    const loadTexts = useCallback(async () => setTexts(await getMyTexts(language)), [language]);
    useFocusEffect(useCallback(() => { void loadTexts(); }, [loadTexts]));

    const pickPdf = async () => {
        if (adding) return;
        setAdding(true);
        try {
            const id = await addPdf(language);
            if (id !== null) {
                await loadTexts();
                router.push({ pathname: "/reading", params: { id: String(id) } });
            }
        } catch (error) {
            Alert.alert("Could not add the PDF", error instanceof Error ? error.message : String(error));
        } finally {
            setAdding(false);
        }
    };

    const removeText = (id: number, title: string) =>
        Alert.alert(`Delete "${title}"?`, undefined, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => { void deleteMyText(id).then(loadTexts); } },
        ]);

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
                    <ScrollView style={s.menu} showsVerticalScrollIndicator>
                        {libraryLanguages.map((code) => (
                            <Pressable key={code} style={[s.menuRow, code === language && s.menuRowOn]} onPress={() => { setChosen(code); setPicking(false); }} accessibilityRole="button">
                                <Text style={s.dropFlag}>{getLanguage(code)?.flag ?? "🌐"}</Text>
                                <Text style={[s.menuText, !withContent.has(code) && { color: t.muted }]}>{getLanguage(code)?.name ?? code}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                </Pressable>
            </Modal>

            <View style={s.toggle}>
                {(["decks", "pdfs"] as const).map((w) => (
                    <Pressable key={w} style={[s.tab, tab === w && s.tabOn]} onPress={() => setTab(w)}>
                        <Text style={[s.tabText, tab === w && s.tabTextOn]}>{w === "decks" ? "Decks" : "PDFs"}</Text>
                    </Pressable>
                ))}
            </View>

            {tab === "decks" ? (
                <FlatList
                    data={decks}
                    keyExtractor={(d) => d.id}
                    contentContainerStyle={s.list}
                    ListEmptyComponent={<Text style={s.empty}>Coming soon.</Text>}
                    renderItem={({ item }) => {
                        const have = presentIndexes(item.cards, owned.get(item.language) ?? new Set()).size;
                        const all = have === item.cards.length;
                        return (
                            <Pressable
                                style={({ pressed }) => [s.card, pressed && s.pressed]}
                                onPress={() => router.push({ pathname: "/premade", params: { id: item.id } })}
                                accessibilityRole="button"
                            >
                                <Text style={s.flag}>{lang?.flag ?? "🌐"}</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.name}>{item.name}</Text>
                                    <Text style={[s.meta, all && s.metaDone]}>{all ? "All in your deck ✓" : `${have} / ${item.cards.length} in your deck`}</Text>
                                </View>
                                <Text style={s.arrow}>›</Text>
                            </Pressable>
                        );
                    }}
                />
            ) : (
                <FlatList
                    data={texts}
                    keyExtractor={(r) => String(r.id)}
                    contentContainerStyle={s.list}
                    ListHeaderComponent={
                        <Pressable style={[s.addButton, adding && { opacity: 0.5 }]} onPress={pickPdf} disabled={adding} accessibilityRole="button">
                            <Text style={s.addText}>{adding ? "Reading PDF…" : "+ Add a PDF"}</Text>
                        </Pressable>
                    }
                    renderItem={({ item }) => (
                        <Pressable
                            style={({ pressed }) => [s.card, pressed && s.pressed]}
                            onPress={() => router.push({ pathname: "/reading", params: { id: String(item.id) } })}
                            onLongPress={() => removeText(item.id, item.title)}
                            accessibilityRole="button"
                        >
                            <Text style={[s.name, { flex: 1 }]} numberOfLines={2}>{item.title}</Text>
                            <Pressable onPress={() => removeText(item.id, item.title)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Delete ${item.title}`}>
                                <Text style={s.remove}>✕</Text>
                            </Pressable>
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
    menu: { maxHeight: "75%", backgroundColor: t.surface, borderRadius: 14, borderWidth: 1, borderColor: t.surfaceHigh, paddingVertical: 6 },
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
    addButton: { backgroundColor: t.green, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 12 },
    addText: { color: t.bg, fontWeight: "bold", fontSize: 16 },
    remove: { color: t.muted, fontSize: 18, paddingHorizontal: 4 },
    metaDone: { color: t.green, fontWeight: "600" },
    meta: { color: t.muted, fontSize: 12, marginTop: 2 },
    arrow: { color: t.muted, fontSize: 24 },
    pressed: { opacity: 0.7 },
});
