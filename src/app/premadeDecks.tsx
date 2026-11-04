import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { getLanguage } from "../constants/languages";
import { premadeDecks, type PremadeDeck } from "../models/PremadeDecks";
import { installPremadeDeck } from "../services/premadeDecks";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

export default function PremadeDecksScreen() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [added, setAdded] = useState<string[]>([]);

    const add = async (deck: PremadeDeck) => {
        if (busyId) return;
        setBusyId(deck.id);
        try {
            await installPremadeDeck(deck);
            setAdded((list) => [...list, deck.id]);
        } catch (error) {
            Alert.alert("Could not add the deck", error instanceof Error ? error.message : String(error));
        } finally {
            setBusyId(null);
        }
    };

    return (
        <View style={s.container}>
            <Text style={s.title}>Premade decks</Text>
            <Text style={s.hint}>Add one and it becomes your own deck. Change or delete its cards any time.</Text>

            <FlatList
                data={premadeDecks}
                keyExtractor={(d) => d.id}
                contentContainerStyle={{ paddingBottom: 40 }}
                renderItem={({ item }) => {
                    const lang = getLanguage(item.language);
                    const done = added.includes(item.id);
                    return (
                        <View style={s.card}>
                            <Text style={s.flag}>{lang?.flag ?? "🌐"}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={s.name}>{item.name}</Text>
                                <Text style={s.meta}>{item.cards.length} cards · {item.description}</Text>
                            </View>
                            <Pressable
                                style={({ pressed }) => [s.button, done && s.buttonDone, pressed && s.pressed]}
                                onPress={() => (done ? router.dismissTo("/decks") : add(item))}
                                disabled={busyId !== null}
                                accessibilityRole="button"
                            >
                                {busyId === item.id ? (
                                    <ActivityIndicator color={t.bg} />
                                ) : (
                                    <Text style={[s.buttonText, done && s.buttonTextDone]}>{done ? "Added ✓" : "Add"}</Text>
                                )}
                            </Pressable>
                        </View>
                    );
                }}
            />
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg, padding: 20, paddingTop: 60 },
    title: { color: t.text, fontSize: 22, fontWeight: "600", textAlign: "center" },
    hint: { color: t.muted, fontSize: 13, textAlign: "center", marginTop: 4, marginBottom: 18 },
    card: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: t.surface,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
    },
    flag: { fontSize: 30 },
    name: { color: t.text, fontSize: 16, fontWeight: "600" },
    meta: { color: t.muted, fontSize: 12, marginTop: 2 },
    button: { backgroundColor: t.green, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10, minWidth: 74, alignItems: "center" },
    buttonDone: { backgroundColor: t.surfaceHigh },
    buttonText: { color: t.bg, fontSize: 14, fontWeight: "bold" },
    buttonTextDone: { color: t.text },
    pressed: { opacity: 0.7 },
});
