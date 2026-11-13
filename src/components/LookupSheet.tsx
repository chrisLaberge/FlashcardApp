import Mark from "./Mark";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import Pressable from "./Pressable";
import type { Lookup } from "../models/Lookup";
import { lookupText } from "../services/lookup";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

type Props = {
    onClose: () => void;
    /** The tapped word, or the whole sentence after a long press. */
    text: string;
    /** The sentence the word was tapped in. */
    context: string;
    languageName: string;
    /** Start a new card from this entry. */
    onAdd: (lookup: Lookup) => void;
    /** When given, a "Known" button marks this word as known (shown for a single word). */
    onKnown?: () => void;
    /** When given, an "Ignore" button sets this word aside (a name, a place, or a word of another language). */
    onIgnore?: () => void;
};

type State = { status: "loading" } | { status: "error"; message: string } | { status: "done"; lookup: Lookup };

/** A sheet with the meaning of one tapped word or sentence, and a button to make it a card. Mount it fresh for each tap. */
export default function LookupSheet({ onClose, text, context, languageName, onAdd, onKnown, onIgnore }: Props) {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const [state, setState] = useState<State>({ status: "loading" });

    const run = useCallback(() => {
        let active = true;
        lookupText(text, context, languageName)
            .then((lookup) => active && setState({ status: "done", lookup }))
            .catch((e) => active && setState({ status: "error", message: e instanceof Error ? e.message : String(e) }));
        return () => {
            active = false;
        };
    }, [text, context, languageName]);

    useEffect(() => run(), [run]);

    return (
        <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
            <Pressable style={s.backdrop} dim={false} onPress={onClose} accessibilityLabel="Close" />
            <View style={s.sheet}>
                <View style={s.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.word}>{state.status === "done" ? state.lookup.word : text}</Text>
                        {state.status === "done" && state.lookup.romanization ? <Text style={s.muted}>{state.lookup.romanization}</Text> : null}
                        {state.status === "done" ? <Text style={s.translation}>{state.lookup.translation}</Text> : null}
                    </View>
                    <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close"><Mark kind="close" size={22} /></Pressable>
                </View>

                <ScrollView contentContainerStyle={s.content}>
                    {state.status === "loading" && <ActivityIndicator color={t.blue} style={{ marginVertical: 24 }} />}

                    {state.status === "error" && (
                        <View style={s.center}>
                            <Text style={s.error}>{state.message}</Text>
                            <Pressable
                                style={s.retry}
                                onPress={() => {
                                    setState({ status: "loading" });
                                    run();
                                }}
                            >
                                <Text style={s.retryText}>Try again</Text>
                            </Pressable>
                        </View>
                    )}

                    {state.status === "done" && (
                        <>
                            <Text style={s.body}>{state.lookup.definition}</Text>
                            {state.lookup.grammar.map((g, i) => <Text key={i} style={s.body}>• {g}</Text>)}
                            <Text style={s.note}>AI-written. Double-check.</Text>
                        </>
                    )}
                </ScrollView>

                <View style={s.actions}>
                    {onKnown ? (
                        <Pressable style={s.known} onPress={onKnown} accessibilityRole="button" accessibilityLabel="I know this word">
                            <Ionicons name="checkmark" size={20} color={t.green} />
                            <Text style={s.knownText}>Known</Text>
                        </Pressable>
                    ) : null}
                    {onIgnore ? (
                        <Pressable style={s.name} onPress={onIgnore} accessibilityRole="button" accessibilityLabel="Ignore this word (a name, place or another language)">
                            <Text style={s.nameText}>Ignore</Text>
                        </Pressable>
                    ) : null}
                    {state.status === "done" && (
                        <Pressable style={[s.add, { flex: 1 }]} onPress={() => onAdd(state.lookup)} accessibilityLabel="Add as a card">
                            <Ionicons name="add" size={22} color={t.bg} />
                            <Text style={s.addText}>Add as a card</Text>
                        </Pressable>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
    sheet: { maxHeight: "70%", backgroundColor: t.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, borderTopWidth: 1, borderColor: t.surfaceHigh },
    header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 8 },
    word: { color: t.text, fontSize: 26, fontWeight: "600" },
    translation: { color: t.yellow, fontSize: 17, fontWeight: "600", marginTop: 2 },
    close: { color: t.muted, fontSize: 20, padding: 4 },
    content: { paddingBottom: 12, gap: 8 },
    body: { color: t.text, fontSize: 15, lineHeight: 22 },
    muted: { color: t.muted, fontSize: 14 },
    center: { alignItems: "center", gap: 12, paddingVertical: 16 },
    error: { color: t.red, textAlign: "center" },
    retry: { backgroundColor: t.green, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
    retryText: { color: t.bg, fontWeight: "600" },
    note: { color: t.muted, fontSize: 12, textAlign: "center", marginTop: 8 },
    add: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: t.green, borderRadius: 12, paddingVertical: 12 },
    actions: { flexDirection: "row", gap: 10, marginTop: 6 },
    known: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1.5, borderColor: t.green },
    name: { alignItems: "center", justifyContent: "center", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1.5, borderColor: t.surfaceTop },
    nameText: { color: t.muted, fontSize: 16, fontWeight: "600" },
    knownText: { color: t.green, fontSize: 16, fontWeight: "600" },
    addText: { color: t.bg, fontSize: 16, fontWeight: "600" },
});
