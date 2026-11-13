import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import Pressable from "../components/Pressable";
import LookupSheet from "../components/LookupSheet";
import PdfReader from "../components/pdf/PdfReader";
import TappableText from "../components/TappableText";
import { getLanguage } from "../constants/languages";
import { getBookSummary, getMyText, type MyText } from "../database/database";
import { coveragePercent } from "../models/Vocabulary";
import { pdfLines } from "../models/PdfText";
import { openAddCard } from "../services/openAddCard";
import { textOfWords } from "../models/Selection";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

/** A PDF you added. Tap any word to see what it means and add it as a card. */
export default function ReadingScreen() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const { id } = useLocalSearchParams<{ id?: string }>();
    const [text, setText] = useState<MyText | null | undefined>(undefined);
    const [lookup, setLookup] = useState<{ text: string; context: string } | null>(null);

    useEffect(() => {
        let active = true;
        getMyText(Number(id)).then((found) => {
            if (active) setText(found);
        });
        return () => {
            active = false;
        };
    }, [id]);

    const [coverage, setCoverage] = useState<number | null>(null);
    const refreshCoverage = useCallback(() => {
        void getBookSummary(Number(id)).then((b) => setCoverage(b && b.totalTokens ? coveragePercent(b.knownTokens, b.totalTokens - b.ignoredTokens) : null)).catch(() => undefined);
    }, [id]);
    // A PDF shows its percentage once the reader has brought the known words up to date, so it does not jump.
    const isPdf = !!text?.pdfPath;
    useEffect(() => { if (text !== undefined && !isPdf) refreshCoverage(); }, [refreshCoverage, text, isPdf]);

    const lines = useMemo(() => (text ? pdfLines(text.body) : []), [text]);

    if (text === undefined) return <View style={s.container}><ActivityIndicator color={t.blue} style={{ marginTop: 40 }} /></View>;
    if (text === null) return <View style={s.container}><Text style={s.missing}>Not found.</Text></View>;
    const language = getLanguage(text.language);

    const header = (
        <Stack.Screen
            options={{
                title: text.title,
                headerRight: () => (coverage === null ? null : (
                    <Pressable onPress={() => router.push({ pathname: "/book", params: { id: String(text.id) } })} hitSlop={10} accessibilityRole="button" accessibilityLabel="Words in this book">
                        <Text style={s.coverage}>{coverage}%</Text>
                    </Pressable>
                )),
            }}
        />
    );

    // A PDF kept on the phone opens as the real PDF, page by page.
    if (text.pdfPath && language) {
        return (
            <View style={s.container}>
                {header}
                <PdfReader book={text} languageName={language.name} onAnalyzed={refreshCoverage} />
            </View>
        );
    }

    return (
        <View style={s.container}>
            {header}
            {/* A list draws only the lines on screen, so a whole book stays smooth. */}
            <FlatList
                data={lines}
                keyExtractor={(_, i) => String(i)}
                contentContainerStyle={s.content}
                initialNumToRender={12}
                windowSize={7}
                renderItem={({ item: line }) => (
                    <TappableText
                        text={line}
                        style={s.text}
                        onWord={(index) => setLookup({ text: textOfWords(line, index, index), context: line })}
                        onHold={(index) => setLookup({ text: textOfWords(line, index, index), context: line })}
                    />
                )}
            />

            {language && lookup && (
                <LookupSheet
                    key={`${lookup.text}\u0001${lookup.context}`}
                    text={lookup.text}
                    context={lookup.context}
                    languageName={language.name}
                    onClose={() => setLookup(null)}
                    onAdd={(entry) => {
                        const example = lookup.context !== lookup.text ? lookup.context : "";
                        setLookup(null);
                        void openAddCard(text.language, { text: entry.word, meaning: entry.translation, example });
                    }}
                />
            )}
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, paddingBottom: 60, gap: 18 },
    text: { color: t.text, fontSize: 22, lineHeight: 34 },
    coverage: { color: t.blue, fontSize: 16, fontWeight: "600" },
    missing: { color: t.muted, textAlign: "center", marginTop: 40 },
});
