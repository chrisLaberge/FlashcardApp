import Mark from "./Mark";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import Pressable from "./Pressable";
import type { Explanation } from "../models/Explanation";
import { explainCard } from "../services/explain";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

type Props = {
    visible: boolean;
    onClose: () => void;
    card: { id?: number; learningText: string; localizedText: string; exampleSentence: string; romanization?: string };
    languageName: string;
};

/** A sheet with an AI-written definition, grammar notes and example sentences for one card. */
export default function ExplainSheet({ visible, onClose, card, languageName }: Props) {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const [state, setState] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "done"; explanation: Explanation }>({ status: "loading" });

    const run = useCallback((fresh: boolean) => {
        explainCard(card, languageName, fresh)
            .then((explanation) => setState({ status: "done", explanation }))
            .catch((e) => setState({ status: "error", message: e instanceof Error ? e.message : String(e) }));
    }, [card, languageName]);

    // The sheet is mounted fresh each time it opens (it starts in "loading").
    useEffect(() => {
        run(false);
    }, [run]);

    const load = (fresh: boolean) => {
        setState({ status: "loading" });
        run(fresh);
    };

    return (
        <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
            <Pressable style={s.backdrop} dim={false} onPress={onClose} accessibilityLabel="Close" />
            <View style={s.sheet}>
                <View style={s.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.word}>{card.learningText}</Text>
                        {card.romanization ? <Text style={s.muted}>{card.romanization}</Text> : null}
                        <Text style={s.muted}>{card.localizedText}</Text>
                    </View>
                    <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close"><Mark kind="close" size={22} /></Pressable>
                </View>

                <ScrollView contentContainerStyle={s.content}>
                    {state.status === "loading" && <ActivityIndicator color={t.blue} style={{ marginVertical: 30 }} />}

                    {state.status === "error" && (
                        <View style={s.center}>
                            <Text style={s.error}>{state.message}</Text>
                            <Pressable style={s.button} onPress={() => load(false)}><Text style={s.buttonText}>Try again</Text></Pressable>
                        </View>
                    )}

                    {state.status === "done" && (
                        <>
                            <Text style={s.label}>Meaning</Text>
                            <Text style={s.body}>{state.explanation.definition}</Text>

                            {state.explanation.grammar.length > 0 && (
                                <>
                                    <Text style={s.label}>Grammar</Text>
                                    {state.explanation.grammar.map((g, i) => <Text key={i} style={s.body}>• {g}</Text>)}
                                </>
                            )}

                            <Text style={s.label}>Examples</Text>
                            {state.explanation.examples.map((e, i) => (
                                <View key={i} style={s.example}>
                                    <Text style={s.exampleText}>{e.text}</Text>
                                    {e.romanization ? <Text style={s.muted}>{e.romanization}</Text> : null}
                                    <Text style={s.muted}>{e.translation}</Text>
                                </View>
                            ))}

                            <Text style={s.note}>AI-written. Double-check.</Text>
                            <Pressable onPress={() => load(true)}><Text style={s.link}>Explain again</Text></Pressable>
                        </>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
    sheet: { maxHeight: "75%", backgroundColor: t.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, borderTopWidth: 1, borderColor: t.surfaceHigh },
    header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 8 },
    word: { color: t.text, fontSize: 26, fontWeight: "600" },
    close: { color: t.muted, fontSize: 20, padding: 4 },
    content: { paddingBottom: 30, gap: 6 },
    label: { color: t.yellow, fontSize: 13, fontWeight: "700", textTransform: "uppercase", marginTop: 12 },
    body: { color: t.text, fontSize: 15, lineHeight: 22 },
    muted: { color: t.muted, fontSize: 14 },
    example: { backgroundColor: t.surface, borderRadius: 10, padding: 12, gap: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: t.surfaceHigh },
    exampleText: { color: t.text, fontSize: 16, fontWeight: "600" },
    center: { alignItems: "center", gap: 12, paddingVertical: 20 },
    error: { color: t.red, textAlign: "center" },
    button: { backgroundColor: t.green, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
    buttonText: { color: t.bg, fontWeight: "600" },
    note: { color: t.muted, fontSize: 12, textAlign: "center", marginTop: 14 },
    link: { color: t.blue, textAlign: "center", paddingVertical: 8 },
});
