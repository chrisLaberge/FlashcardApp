import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import Pressable from "../components/Pressable";
import { getBookSummary, getTopUnknown, setWordKnown, type BookSummary } from "../database/database";
import { coveragePercent } from "../models/Vocabulary";
import { readerAnalyzerFor } from "../services/morphology";
import { analyzeBook, syncKnownWords } from "../services/vocabulary";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

type Word = { lemma: string; count: number; sample: string };

/** How much of a book you know, and the words you meet most that you do not know yet. */
export default function BookScreen() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const { id } = useLocalSearchParams<{ id?: string }>();
    const bookId = Number(id);
    const [book, setBook] = useState<BookSummary | null | undefined>(undefined);
    const [words, setWords] = useState<Word[]>([]);

    const tried = useRef(false);

    const load = useCallback(async () => {
        const [summary, unknown] = await Promise.all([getBookSummary(bookId), getTopUnknown(bookId, 100)]);
        setBook(summary);
        setWords(unknown);
        // A book that has text but was never counted (an older book) is counted now, after the screen is up.
        if (summary && summary.analyzerVersion === null && !tried.current) {
            tried.current = true; // once per visit, so a failure cannot loop
            try {
                const analyzer = await readerAnalyzerFor(summary.language);
                await syncKnownWords(summary.language, analyzer);
                await analyzeBook(bookId, analyzer);
                const [again, list] = await Promise.all([getBookSummary(bookId), getTopUnknown(bookId, 100)]);
                setBook(again);
                setWords(list);
            } catch {
                // Nothing to show yet; it is tried again next time.
            }
        }
    }, [bookId]);

    useFocusEffect(useCallback(() => { void load(); }, [load]));

    if (book === undefined) return <View style={s.container}><ActivityIndicator color={t.blue} style={{ marginTop: 40 }} /></View>;
    if (book === null) return <View style={s.container}><Text style={s.empty}>Not found.</Text></View>;

    const total = book.totalTokens ?? 0;
    const percent = coveragePercent(book.knownTokens, total);

    const markKnown = async (lemma: string) => {
        await setWordKnown(book.language, lemma, true);
        await load(); // the percentage and the list both come from the database, so they stay in step
    };

    return (
        <View style={s.container}>
            <Stack.Screen options={{ title: book.title }} />
            <FlatList
                data={words}
                keyExtractor={(w) => w.lemma}
                contentContainerStyle={s.list}
                ListHeaderComponent={
                    <View style={s.header}>
                        <Text style={s.percent}>{percent}%</Text>
                        <Text style={s.counts}>{book.knownTokens.toLocaleString("en-US")} known · {(total - book.knownTokens).toLocaleString("en-US")} unknown</Text>
                        <Pressable style={s.read} onPress={() => router.push({ pathname: "/reading", params: { id: String(book.id) } })} accessibilityRole="button">
                            <Text style={s.readText}>Read</Text>
                        </Pressable>
                    </View>
                }
                ListEmptyComponent={<Text style={s.empty}>{total === 0 ? "No words found." : "You know every word."}</Text>}
                renderItem={({ item }) => (
                    <View style={s.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.word}>{item.lemma}</Text>
                            <Text style={s.count}>{item.count}×</Text>
                        </View>
                        <Pressable style={s.small} onPress={() => markKnown(item.lemma)} accessibilityRole="button" accessibilityLabel={`I know ${item.lemma}`}>
                            <Text style={s.smallText}>Known</Text>
                        </Pressable>
                        <Pressable style={[s.small, s.primary]} onPress={() => router.push({ pathname: "/addCard", params: { text: item.lemma } })} accessibilityRole="button" accessibilityLabel={`Add ${item.lemma} as a card`}>
                            <Text style={[s.smallText, { color: t.bg }]}>+ Card</Text>
                        </Pressable>
                    </View>
                )}
            />
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    list: { padding: 16, paddingBottom: 60, gap: 8 },
    header: { alignItems: "center", gap: 6, marginBottom: 14 },
    percent: { color: t.text, fontSize: 52, fontWeight: "800" },
    counts: { color: t.muted, fontSize: 14 },
    read: { backgroundColor: t.green, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 40, marginTop: 8 },
    readText: { color: t.bg, fontWeight: "600", fontSize: 16 },
    row: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.surface, borderRadius: 12, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: t.surfaceHigh },
    word: { color: t.text, fontSize: 18, fontWeight: "600" },
    count: { color: t.muted, fontSize: 12, marginTop: 2 },
    small: { backgroundColor: t.surfaceHigh, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12 },
    primary: { backgroundColor: t.green },
    smallText: { color: t.text, fontWeight: "600", fontSize: 13 },
    empty: { color: t.muted, textAlign: "center", marginTop: 40 },
});
