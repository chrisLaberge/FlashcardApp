import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import Pressable from "./Pressable";
import { formatStudyTime } from "../models/Stats";
import PetView from "./pet/PetView";
import { usePetLook } from "../hooks/usePetLook";
import { buildSummary, onStudyScreenLeft, type SessionSummary } from "../services/sessionSummary";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

/** Shown when you leave the study screen after answering some cards: what you did and what is left. */
export default function SessionSummaryPopup() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const [summary, setSummary] = useState<SessionSummary | null>(null);

    useEffect(
        () =>
            onStudyScreenLeft((deckId) => {
                buildSummary(deckId)
                    .then(setSummary)
                    .catch(() => undefined);
            }),
        [],
    );

    const pet = usePetLook(summary !== null);

    if (!summary) return null;
    const { session } = summary;
    const accuracy = session.reviews === 0 ? 0 : Math.round((session.correct / session.reviews) * 100);
    const left = summary.dueInDeck ?? summary.dueTotal;
    const done = left === 0;

    return (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => setSummary(null)}>
            <View style={s.backdrop}>
                <View style={s.card}>
                    {pet ? <View style={s.pet}><PetView level={pet.level} look={pet.look} size={110} /></View> : null}
                    <Text style={s.title}>{done ? "Session complete" : "Session so far"}</Text>
                    {summary.deckName ? <Text style={s.deck}>{summary.deckName}</Text> : null}

                    <View style={s.big}>
                        <Text style={s.bigNumber}>{accuracy}%</Text>
                        <Text style={s.label}>Accuracy</Text>
                    </View>

                    <View style={s.row}>
                        <View style={s.stat}>
                            <Text style={s.number}>{formatStudyTime(session.timeMs)}</Text>
                            <Text style={s.label}>Time spent</Text>
                        </View>
                        <View style={s.stat}>
                            <Text style={s.number}>{session.reviews}</Text>
                            <Text style={s.label}>Reviews</Text>
                        </View>
                        <View style={s.stat}>
                            <Text style={s.number}>{left}</Text>
                            <Text style={s.label}>{summary.dueInDeck !== null ? "Left in deck" : "Cards left"}</Text>
                        </View>
                    </View>

                    <View style={s.buttons}>
                        <Pressable style={[s.button, s.quiet]} onPress={() => setSummary(null)} accessibilityRole="button">
                            <Text style={s.quietText}>Close</Text>
                        </Pressable>
                        {!done ? (
                            <Pressable
                                style={s.button}
                                onPress={() => {
                                    setSummary(null);
                                    router.push("/learn");
                                }}
                                accessibilityRole="button"
                            >
                                <Text style={s.buttonText}>Keep going</Text>
                            </Pressable>
                        ) : null}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 24 },
    card: { width: "100%", maxWidth: 380, backgroundColor: t.bg, borderRadius: 20, padding: 20, gap: 14, borderWidth: 1, borderColor: t.surfaceHigh },
    pet: { alignItems: "center", marginTop: -4 },
    title: { color: t.text, fontSize: 22, fontWeight: "700", textAlign: "center" },
    deck: { color: t.muted, fontSize: 14, textAlign: "center", marginTop: -8 },
    big: { backgroundColor: t.surface, borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: t.surfaceHigh },
    bigNumber: { color: t.green, fontSize: 40, fontWeight: "800" },
    row: { flexDirection: "row", gap: 10 },
    stat: { flex: 1, backgroundColor: t.surface, borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: t.surfaceHigh },
    number: { color: t.text, fontSize: 20, fontWeight: "700" },
    label: { color: t.muted, fontSize: 12, marginTop: 2 },
    buttons: { flexDirection: "row", gap: 10, marginTop: 4 },
    button: { flex: 1, backgroundColor: t.green, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
    buttonText: { color: t.bg, fontWeight: "600", fontSize: 16 },
    quiet: { backgroundColor: t.surface },
    quietText: { color: t.text, fontWeight: "600", fontSize: 16 },
});
