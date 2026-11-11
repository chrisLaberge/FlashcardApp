import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState, useMemo } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Text, View } from "react-native";
import Pressable from "../components/Pressable";
import { getLanguage } from "../constants/languages";
import { deleteDeck, getDecks } from "../database/database";
import { backfillLocalImages } from "../services/localImages";
import { pickAndRestoreBackup } from "../utils/restoreBackup";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

type Deck = { id: number; name: string; language: string; card_count: number; due_count: number };

export default function DecksScreen() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const [decks, setDecks] = useState<Deck[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [deckToDelete, setDeckToDelete] = useState<Deck | null>(null);

    const load = async () => setDecks(await getDecks());

    const [restoring, setRestoring] = useState(false);

    const restoreBackup = () => {
        if (restoring) return;
        Alert.alert(
            "Restore from backup?",
            "Choose a backup file made with the Export button. Restoring only works while the app has no decks, so nothing you have can be overwritten.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Choose file",
                    onPress: async () => {
                        setRestoring(true);
                        try {
                            const result = await pickAndRestoreBackup();
                            if (!result) return;
                            await load();
                            void backfillLocalImages(); // pictures are copied to this phone again in the background
                            Alert.alert(
                                "Backup restored",
                                `${result.decks} deck${result.decks === 1 ? "" : "s"}, ${result.cards} cards and your progress are back.`,
                            );
                        } catch (error) {
                            Alert.alert(
                                "Could not restore",
                                error instanceof Error ? error.message : String(error),
                            );
                        } finally {
                            setRestoring(false);
                        }
                    },
                },
            ],
        );
    };

    useFocusEffect(useCallback(() => { load(); }, []));

    const confirmDelete = async () => {
        if (!deckToDelete) return;

        await deleteDeck(deckToDelete.id);

        const lastDeckId = await AsyncStorage.getItem("lastDeckId");

        if (lastDeckId === String(deckToDelete.id)) {
            await AsyncStorage.removeItem("lastDeckId");
        }

        if (selectedId === deckToDelete.id) {
            setSelectedId(null);
        }

        setDeckToDelete(null);
        load();
    };

    return (
        <View style={s.container}>
            <Text style={s.title}>My decks</Text>
            <Text style={s.hint}>Tap to select · hold to delete</Text>

            {decks.length === 0 && (
                <Pressable
                    style={({ pressed }) => [s.restoreBox, pressed && s.pressed]}
                    onPress={restoreBackup}
                    disabled={restoring}
                    accessibilityRole="button"
                >
                    {restoring ? (
                        <ActivityIndicator color={t.blue} />
                    ) : (
                        <>
                            <Text style={s.restoreTitle}>Restore from backup</Text>
                            <Text style={s.restoreText}>
                                Moving from another install? Choose the file saved with Export.
                            </Text>
                        </>
                    )}
                </Pressable>
            )}

            <FlatList
                data={decks}
                keyExtractor={(d) => String(d.id)}
                contentContainerStyle={{ paddingBottom: 100 }}
                renderItem={({ item }) => {
                    const selected = item.id === selectedId;
                    const lang = getLanguage(item.language);
                    return (
                        <Pressable
                            onPress={async () => {
                                setSelectedId(item.id);

                                await AsyncStorage.setItem(
                                    "lastDeckId",
                                    String(item.id)
                                );

                                // Home reads the selected deck from storage; go back to it rather than stacking a second copy.
                                router.dismissTo("/");
                            }}
                            onLongPress={() => setDeckToDelete(item)}
                            style={[s.card, selected && s.cardSelected]}
                        >
                            <Text style={s.flag}>{lang?.flag ?? "🌐"}</Text>

                            <View style={{ flex: 1 }}>
                                <Text style={[s.name, selected && s.onAccent]}>{item.name}</Text>
                                <Text style={[s.language, selected && s.onAccent]}>
                                    {lang ? `${lang.name} · ${lang.nativeName}` : item.language}
                                </Text>
                                {item.card_count > 0 && (
                                    <Text style={[item.due_count > 0 ? s.due : s.caughtUp, selected && s.onAccent]}>
                                        {item.due_count > 0 ? `${item.due_count} due` : "All caught up ✓"}
                                    </Text>
                                )}
                            </View>

                            <View style={s.countBox}>
                                <Text style={[s.count, selected && s.onAccent]}>{item.card_count}</Text>
                                <Text style={[s.countLabel, selected && s.onAccent]}>cards</Text>
                            </View>
                        </Pressable>
                    );
                }}
            />

            <Pressable style={s.fab} onPress={() => router.push("/createDeck")}>
                <Text style={s.fabText}>+</Text>
            </Pressable>

            <Modal
                visible={deckToDelete !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setDeckToDelete(null)}
            >
                <Pressable style={s.backdrop} dim={false} onPress={() => setDeckToDelete(null)}>
                    <Pressable style={s.dialog} onPress={() => { }}>
                        <Text style={s.dialogFlag}>
                            {deckToDelete ? getLanguage(deckToDelete.language)?.flag ?? "🌐" : ""}
                        </Text>
                        <Text style={s.dialogTitle}>Delete deck?</Text>
                        <Text style={s.dialogBody}>
                            <Text style={s.dialogDeck}>{deckToDelete?.name}</Text> and all{" "}
                            {deckToDelete?.card_count} of its cards will be permanently removed.
                        </Text>

                        <View style={s.dialogButtons}>
                            <Pressable
                                style={({ pressed }) => [s.btn, s.cancelBtn, pressed && s.pressed]}
                                onPress={() => setDeckToDelete(null)}
                            >
                                <Text style={s.cancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [s.btn, s.deleteBtn, pressed && s.pressed]}
                                onPress={confirmDelete}
                            >
                                <Text style={s.deleteText}>Delete</Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg, padding: 20, paddingTop: 60 },

    title: {
        color: t.text,
        fontSize: 22,
        fontWeight: "600",
        textAlign: "center",
        letterSpacing: 0.5,
    },
    hint: {
        color: t.subtle,
        fontSize: 13,
        textAlign: "center",
        marginTop: 6,
        marginBottom: 28,
    },

    card: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: t.surface,
        borderRadius: 12,
        padding: 18,
        marginBottom: 12,
    },
    cardSelected: { backgroundColor: t.gold },
    flag: { fontSize: 32, marginRight: 14 },
    name: { color: t.text, fontSize: 19, fontWeight: "600" },
    language: { color: t.muted, fontSize: 14, marginTop: 3 },
    countBox: { alignItems: "center", marginLeft: 12 },
    count: { color: t.blue, fontSize: 28, fontWeight: "600" },
    countLabel: { color: t.muted, fontSize: 12 },
    due: { color: t.yellow, fontSize: 13, fontWeight: "700", marginTop: 3 },
    caughtUp: { color: t.green, fontSize: 13, marginTop: 3 },
    onAccent: { color: t.bg },

    restoreBox: {
        borderWidth: 1,
        borderColor: t.surfaceHigh,
        borderStyle: "dashed",
        borderRadius: 12,
        padding: 18,
        marginBottom: 16,
        alignItems: "center",
    },
    restoreTitle: { color: t.blue, fontSize: 16, fontWeight: "600" },
    restoreText: { color: t.muted, fontSize: 13, marginTop: 4, textAlign: "center" },

    fab: {
        position: "absolute",
        right: 24,
        bottom: 32,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: t.green,
        alignItems: "center",
        justifyContent: "center",
    },
    fabText: { color: t.bg, fontSize: 32, lineHeight: 34, fontWeight: "600" },

    // Delete dialog
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(29, 32, 33, 0.85)",
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
    },
    dialog: {
        width: "100%",
        maxWidth: 340,
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.surfaceHigh,
        borderRadius: 12,
        padding: 24,
        alignItems: "center",
    },
    dialogFlag: { fontSize: 40, marginBottom: 10 },
    dialogTitle: { color: t.text, fontSize: 20, fontWeight: "600", marginBottom: 10 },
    dialogBody: { color: t.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
    dialogDeck: { color: t.text, fontWeight: "600" },
    dialogButtons: { flexDirection: "row", gap: 10, marginTop: 24 },
    btn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: "center" },
    cancelBtn: { backgroundColor: t.surfaceHigh },
    cancelText: { color: t.text, fontSize: 16, fontWeight: "600" },
    deleteBtn: { backgroundColor: t.bg, borderWidth: 1, borderColor: t.red },
    deleteText: { color: t.red, fontSize: 16, fontWeight: "600" },
    pressed: { opacity: 0.7 },
});