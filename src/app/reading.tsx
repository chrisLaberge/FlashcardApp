import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import LookupSheet from "../components/LookupSheet";
import TappableText from "../components/TappableText";
import { getLanguage } from "../constants/languages";
import { getReading } from "../models/Readings";
import { textOfWords } from "../models/Selection";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

export default function ReadingScreen() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const { id } = useLocalSearchParams<{ id?: string }>();
    const reading = id ? getReading(id) : undefined;
    const [showMeaning, setShowMeaning] = useState(false);
    const [lookup, setLookup] = useState<{ text: string; context: string } | null>(null);

    if (!reading) {
        return <View style={s.container}><Text style={s.meaning}>That text could not be found.</Text></View>;
    }
    const language = getLanguage(reading.language);

    return (
        <View style={s.container}>
            <Stack.Screen options={{ title: reading.titleMeaning }} />
            <ScrollView contentContainerStyle={s.content}>
                <Text style={s.title}>{reading.title}</Text>
                <Text style={s.hint}>Tap a word to see what it means.</Text>

                {reading.lines.map((line) => (
                    <View key={line.text} style={s.line}>
                        <TappableText
                            text={line.text}
                            style={s.text}
                            onWord={(index) => setLookup({ text: textOfWords(line.text, index, index), context: line.text })}
                            onHold={(index) => setLookup({ text: textOfWords(line.text, index, index), context: line.text })}
                        />
                        {showMeaning ? <Text style={s.meaning}>{line.meaning}</Text> : null}
                    </View>
                ))}

                <Pressable style={({ pressed }) => [s.button, pressed && s.pressed]} onPress={() => setShowMeaning((v) => !v)}>
                    <Text style={s.buttonText}>{showMeaning ? "Hide English" : "Show English"}</Text>
                </Pressable>
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
    content: { padding: 20, paddingBottom: 60 },
    title: { color: t.text, fontSize: 26, fontWeight: "700" },
    hint: { color: t.muted, fontSize: 13, marginTop: 4, marginBottom: 20 },
    line: { marginBottom: 18 },
    text: { color: t.text, fontSize: 24, lineHeight: 36 },
    meaning: { color: t.muted, fontSize: 15, marginTop: 4 },
    button: { alignSelf: "center", backgroundColor: t.surface, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 22, marginTop: 10 },
    buttonText: { color: t.text, fontWeight: "600" },
    pressed: { opacity: 0.7 },
});
