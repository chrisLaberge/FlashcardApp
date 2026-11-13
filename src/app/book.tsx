import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import Pressable from "../components/Pressable";
import { getBookSummary, getTopUnknown, setWordKnown, setWordIgnored, type BookSummary } from "../database/database";
import { coveragePercent } from "../models/Vocabulary";
import { hasStemmer } from "../models/language/stemmed";
import { readerAnalyzerFor } from "../services/morphology";
import { openAddCard } from "../services/openAddCard";
import { analyzeBook, syncKnownWords } from "../services/vocabulary";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

type Word = { lemma: string; count: number; sample: string };

const PAGE = 50;

/** How much of a book you know, and the words you meet most that you do not know yet. */
export default function BookScreen() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const { id } = useLocalSearchParams<{ id?: string }>();
    const bookId = Number(id);
    const [book, setBook] = useState<BookSummary | null | undefined>(undefined);
    const [words, setWords] = useState<Word[]>([]);

    const syncing = useRef(false);
    // How many words are listed. One more is asked for, to know whether "Show more" is needed.
    const limit = useRef(PAGE);
    const [more, setMore] = useState(false);

    // Reads the numbers and the list straight from the database.
    const show = useCallback(async () => {
        const [summary, unknown] = await Promise.all([getBookSummary(bookId), getTopUnknown(bookId, limit.current + 1)]);
        setBook(summary);
        setMore(unknown.length > limit.current);
        setWords(unknown.slice(0, limit.current));
        return summary;
    }, [bookId]);

    // Shows the saved numbers at once, then brings the words your cards say are known up to date (so a word you
    // just added a card for leaves the list) and counts a book that was never counted.
    const load = useCallback(async () => {
        const summary = await show();
        if (!summary || syncing.current) return;
        syncing.current = true;
        try {
            const analyzer = await readerAnalyzerFor(summary.language);
            await syncKnownWords(summary.language, analyzer);
            if (summary.analyzerVersion !== analyzer.version) await analyzeBook(bookId, analyzer);
            await show();
        } catch {
            // The saved numbers stay on screen; this runs again next time.
        } finally {
            syncing.current = false;
        }
    }, [bookId, show]);

    useFocusEffect(useCallback(() => { void load(); }, [load]));

    const showMore = async () => {
        limit.current += PAGE;
        await show();
    };

    if (book === undefined) return <View style={s.container}><ActivityIndicator color={t.blue} style={{ marginTop: 40 }} /></View>;
    if (book === null) return <View style={s.container}><Text style={s.empty}>Not found.</Text></View>;

    const total = (book.totalTokens ?? 0) - book.ignoredTokens;
    const percent = coveragePercent(book.knownTokens, total);

    // Stemmed languages keep a word stem as the key, which is not a word; show the form seen most in the book.
    const shown = (w: Word) => (hasStemmer(book.language) ? w.sample : w.lemma);
    const markKnown = async (lemma: string) => {
        await setWordKnown(book.language, lemma, true);
        await show(); // the percentage and the list both come from the database, so they stay in step
    };

    const markIgnored = async (lemma: string) => {
        await setWordIgnored(book.language, lemma, true);
        await show();
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
                ListFooterComponent={more ? (
                    <Pressable style={s.more} onPress={showMore} accessibilityRole="button">
                        <Text style={s.smallText}>Show more</Text>
                    </Pressable>
                ) : undefined}
                ListEmptyComponent={<Text style={s.empty}>{total === 0 ? "No words found." : "You know every word."}</Text>}
                renderItem={({ item }) => (
                    <View style={s.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.word}>{shown(item)}</Text>
                            <Text style={s.count}>{item.count}×</Text>
                        </View>
                        <Pressable style={s.small} onPress={() => markKnown(item.lemma)} accessibilityRole="button" accessibilityLabel={`I know ${shown(item)}`}>
                            <Text style={s.smallText}>Known</Text>
                        </Pressable>
                        <Pressable style={s.small} onPress={() => markIgnored(item.lemma)} accessibilityRole="button" accessibilityLabel={`${shown(item)} is ignored`}>
                            <Text style={s.smallText}>Ignore</Text>
                        </Pressable>
                        <Pressable style={[s.small, s.primary]} onPress={() => void openAddCard(book.language, { text: shown(item) })} accessibilityRole="button" accessibilityLabel={`Add ${shown(item)} as a card`}>
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
    more: { alignSelf: "center", backgroundColor: t.surfaceHigh, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28, marginTop: 8 },
    empty: { color: t.muted, textAlign: "center", marginTop: 40 },
});
