import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import Pressable from "../../components/Pressable";
import { getLanguage } from "../../constants/languages";
import { deleteMyText, getBookSummaries, getCards, getDecks, type BookSummary } from "../../database/database";
import { useImportJobs } from "../../hooks/useImportJobs";
import { cardKey, premadeDecksFor, presentIndexes } from "../../models/PremadeDecks";
import { coveragePercent } from "../../models/Vocabulary";
import { drop, enqueue, fractionOf, type ImportJob } from "../../services/pdfImport";
import { addPdf, removePdfFile } from "../../services/pdfReading";
import { useTheme } from "../../theme/ThemeProvider";
import type { Palette } from "../../theme/themes";


export default function LibraryScreen() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    type MyDeck = { id: number; name: string; language: string };
    const [myDecks, setMyDecks] = useState<MyDeck[] | null>(null);
    const [lastId, setLastId] = useState<number | null>(null);
    const [chosenId, setChosenId] = useState<number | null>(null);
    // Words already in the selected deck.
    const [owned, setOwned] = useState<Set<string>>(new Set());
    const [picking, setPicking] = useState(false);
    const [tab, setTab] = useState<"decks" | "pdfs">("decks");
    const [texts, setTexts] = useState<BookSummary[]>([]);
    const [busy, setBusy] = useState<string | null>(null);

    // The deck whose resources are shown: the one you picked, else the one you last studied, else the first.
    const deck = myDecks?.find((d) => d.id === (chosenId ?? lastId)) ?? myDecks?.[0] ?? null;
    const deckId = deck?.id ?? null;
    const language = deck?.language ?? null;
    const lang = language ? getLanguage(language) : undefined;
    const decks = language ? premadeDecksFor(language) : [];

    const load = useCallback(async () => {
        const [all, last] = await Promise.all([getDecks(), AsyncStorage.getItem("lastDeckId")]);
        setMyDecks(all.map((d) => ({ id: d.id, name: d.name, language: d.language })));
        setLastId(last ? Number(last) : null);
    }, []);

    useFocusEffect(useCallback(() => { void load(); }, [load]));

    const loadOwned = useCallback(async () => {
        setOwned(deckId === null ? new Set() : new Set((await getCards(deckId)).map((c) => cardKey(c.learningText))));
    }, [deckId]);
    useFocusEffect(useCallback(() => { void loadOwned(); }, [loadOwned]));

    const loadTexts = useCallback(async () => setTexts(language ? await getBookSummaries(language) : []), [language]);

    // Only reads saved numbers, so the tab opens at once. Words are counted when a book is opened.
    const refreshBooks = loadTexts;
    const jobs = useImportJobs();
    // When a PDF finishes (it leaves the list) its words are in; show the new numbers.
    const waiting = jobs.map((j) => `${j.id}:${j.phase === "failed" ? "f" : "w"}`).join(",");

    useFocusEffect(useCallback(() => {
        void refreshBooks();
        return () => undefined; // `waiting` is a dependency on purpose: it reloads the list when a PDF finishes
    }, [refreshBooks, waiting]));

    const pickPdf = async () => {
        if (busy || !language) return;
        setBusy("Adding…");
        try {
            const id = await addPdf(language);
            if (id !== null) {
                enqueue(id); // read and counted in the background, with progress in the list
                await loadTexts();
            }
        } catch (error) {
            Alert.alert("Could not add the PDF", error instanceof Error ? error.message : String(error));
        } finally {
            setBusy(null);
        }
    };

    const removeText = (id: number, title: string) =>
        Alert.alert(`Delete "${title}"?`, undefined, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => { drop(id);
            void deleteMyText(id).then((path) => { removePdfFile(path); return loadTexts(); }); } },
        ]);

    return (
        <View style={s.container}>
            <View style={s.dropWrap}>
                <Pressable style={({ pressed }) => [s.deckButton, pressed && { opacity: 0.7 }]} onPress={() => setPicking(true)} accessibilityRole="button" accessibilityLabel="Choose a deck">
                    <Text style={s.dropFlag}>{lang?.flag ?? "🌐"}</Text>
                    <Text style={s.deckName} numberOfLines={1}>{deck?.name ?? "No decks"}</Text>
                    <Text style={s.dropArrow}>▼</Text>
                </Pressable>
            </View>

            <Modal visible={picking} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPicking(false)}>
                <Pressable style={s.backdrop} dim={false} onPress={() => setPicking(false)}>
                    <ScrollView style={s.menu} showsVerticalScrollIndicator>
                        {(myDecks ?? []).map((d) => (
                            <Pressable key={d.id} style={[s.menuRow, d.id === deckId && s.menuRowOn]} onPress={() => { setChosenId(d.id); setPicking(false); }} accessibilityRole="button">
                                <Text style={s.dropFlag}>{getLanguage(d.language)?.flag ?? "🌐"}</Text>
                                <Text style={s.menuText} numberOfLines={1}>{d.name}</Text>
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
                    ListEmptyComponent={<Text style={s.empty}>{deck ? "Coming soon." : "Create a deck first."}</Text>}
                    renderItem={({ item }) => {
                        const have = presentIndexes(item.cards, owned).size;
                        const all = have === item.cards.length;
                        return (
                            <Pressable
                                style={({ pressed }) => [s.card, pressed && s.pressed]}
                                onPress={() => router.push({ pathname: "/premade", params: { id: item.id, deckId: String(deckId) } })}
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
                        <Pressable style={[s.addButton, busy !== null && { opacity: 0.5 }]} onPress={pickPdf} disabled={busy !== null} accessibilityRole="button">
                            <Text style={s.addText}>{busy ?? "+ Add a PDF"}</Text>
                        </Pressable>
                    }
                    renderItem={({ item }) => {
                        const job = jobs.find((j) => j.id === item.id);
                        const working = job !== undefined && job.phase !== "failed";
                        return (
                        <Pressable
                            style={({ pressed }) => [s.card, pressed && s.pressed]}
                            onPress={() => {
                                if (working) return;
                                if (job) enqueue(item.id); // failed: try again
                                else router.push({ pathname: "/reading", params: { id: String(item.id) } });
                            }}
                            onLongPress={() => removeText(item.id, item.title)}
                            accessibilityRole="button"
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={s.name} numberOfLines={2}>{item.title}</Text>
                                {!job && item.analyzerVersion !== null && item.totalTokens === 0 ? <Text style={s.meta}>No text found (a scan?)</Text> : null}
                                {job ? (
                                    <>
                                        <View style={s.track}><View style={[s.fill, { width: `${Math.round(fractionOf(job) * 100)}%` }, job.phase === "failed" && s.fillFailed]} /></View>
                                        <Text style={s.meta} numberOfLines={1}>{progressText(job)}</Text>
                                    </>
                                ) : null}
                            </View>
                            {!job && item.totalTokens ? (
                                <Pressable onPress={() => router.push({ pathname: "/book", params: { id: String(item.id) } })} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${item.title} words`} style={s.coverage}>
                                    <Text style={s.percent}>{coveragePercent(item.knownTokens, item.totalTokens - item.ignoredTokens)}%</Text>
                                    <Text style={s.meta}>{item.knownTokens.toLocaleString("en-US")} / {(item.totalTokens - item.ignoredTokens).toLocaleString("en-US")}</Text>
                                </Pressable>
                            ) : null}
                            <Pressable onPress={() => removeText(item.id, item.title)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Delete ${item.title}`}>
                                <Text style={s.remove}>✕</Text>
                            </Pressable>
                        </Pressable>
                        );
                    }}
                />
            )}
        </View>
    );
}

const progressText = (job: ImportJob): string =>
    job.phase === "failed" ? `${job.error ?? "Failed"} Tap to retry`
    : job.phase === "waiting" ? "Waiting…"
    : job.phase === "counting" ? "Counting words…"
    : job.total > 0 ? `Reading page ${job.done} of ${job.total}` : "Reading…";

const makeS = (t: Palette) => StyleSheet.create({
    track: { height: 4, borderRadius: 2, backgroundColor: t.surfaceHigh, overflow: "hidden", marginTop: 8, marginBottom: 4 },
    fill: { height: 4, borderRadius: 2, backgroundColor: t.blue },
    fillFailed: { backgroundColor: t.red },
    container: { flex: 1, backgroundColor: t.bg, paddingHorizontal: 16, paddingTop: 12 },
    dropWrap: { flexDirection: "row" },
    deckButton: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 10, backgroundColor: t.surface, borderWidth: 1, borderColor: t.surfaceHigh, borderRadius: 8 },
    deckName: { flexShrink: 1, color: t.text, fontSize: 13, fontWeight: "600", marginLeft: 6 },
    dropFlag: { fontSize: 16 },
    dropArrow: { color: t.muted, fontSize: 9, marginLeft: 6 },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 28 },
    menu: { maxHeight: "75%", backgroundColor: t.surface, borderRadius: 12, borderWidth: 1, borderColor: t.surfaceHigh, paddingVertical: 6 },
    menuRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 16 },
    menuRowOn: { backgroundColor: t.surfaceHigh },
    menuText: { color: t.text, fontSize: 16, fontWeight: "600" },
    toggle: { flexDirection: "row", backgroundColor: t.surface, borderRadius: 12, padding: 4, marginTop: 12, marginBottom: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: t.surfaceHigh },
    tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 9 },
    tabOn: { backgroundColor: t.surfaceHigh },
    tabText: { color: t.muted, fontWeight: "600" },
    tabTextOn: { color: t.text },
    list: { paddingTop: 6, paddingBottom: 40 },
    hint: { color: t.muted, fontSize: 13, marginBottom: 12 },
    empty: { color: t.muted, textAlign: "center", marginTop: 40 },
    card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: t.surfaceHigh },
    flag: { fontSize: 30 },
    name: { color: t.text, fontSize: 16, fontWeight: "600" },
    addButton: { backgroundColor: t.green, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 12 },
    addText: { color: t.bg, fontWeight: "600", fontSize: 16 },
    coverage: { alignItems: "flex-end", paddingHorizontal: 6 },
    percent: { color: t.green, fontSize: 18, fontWeight: "800" },
    remove: { color: t.muted, fontSize: 18, paddingHorizontal: 4 },
    metaDone: { color: t.green, fontWeight: "600" },
    meta: { color: t.muted, fontSize: 12, marginTop: 2 },
    arrow: { color: t.muted, fontSize: 24 },
    pressed: { opacity: 0.7 },
});
