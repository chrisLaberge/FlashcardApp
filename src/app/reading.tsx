import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import LookupSheet from "../components/LookupSheet";
import TappableText from "../components/TappableText";
import { getLanguage } from "../constants/languages";
import { getMyText, type MyText } from "../database/database";
import { pdfLines } from "../models/PdfText";
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

    const lines = useMemo(() => (text ? pdfLines(text.body) : []), [text]);

    if (text === undefined) return <View style={s.container}><ActivityIndicator color={t.blue} style={{ marginTop: 40 }} /></View>;
    if (text === null) return <View style={s.container}><Text style={s.missing}>Not found.</Text></View>;
    const language = getLanguage(text.language);

    return (
        <View style={s.container}>
            <Stack.Screen options={{ title: text.title }} />
            <ScrollView contentContainerStyle={s.content}>
                {lines.map((line, i) => (
                    <TappableText
                        key={i}
                        text={line}
                        style={s.text}
                        onWord={(index) => setLookup({ text: textOfWords(line, index, index), context: line })}
                        onHold={(index) => setLookup({ text: textOfWords(line, index, index), context: line })}
                    />
                ))}
            </ScrollView>

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
                        router.push({ pathname: "/addCard", params: { text: entry.word, meaning: entry.translation, example } });
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
    missing: { color: t.muted, textAlign: "center", marginTop: 40 },
});
