import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getLanguage } from "../constants/languages";
import { addDeck, deleteDeck, getDecks } from "../database/database";
import { getPremadeDeck, presentIndexes } from "../models/PremadeDecks";
import { addPremadeCards, existingWords } from "../services/premadeDecks";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

type Target = { id: number; name: string };
const NEW = -1;

export default function PremadeDeckScreen() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const { id } = useLocalSearchParams<{ id?: string }>();
    const deck = id ? getPremadeDeck(id) : undefined;
    const [targets, setTargets] = useState<Target[] | null>(null);
    const [targetId, setTargetId] = useState<number | null>(null);
    const [present, setPresent] = useState<Set<number>>(new Set());
    const [picking, setPicking] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [busy, setBusy] = useState(false);

    const refreshPresent = useCallback(async (target: number) => {
        if (!deck) return;
        setPresent(target === NEW ? new Set() : presentIndexes(deck.cards, await existingWords(target)));
    }, [deck]);

    const load = useCallback(async () => {
        if (!deck) return;
        const [decks, lastId] = await Promise.all([getDecks(), AsyncStorage.getItem("lastDeckId")]);
        const mine = decks.filter((d) => d.language === deck.language).map((d) => ({ id: d.id, name: d.name }));
        setTargets(mine);
        // Keep the choice you made; otherwise the deck you last studied, else the first of this language, else a new deck.
        const next = targetId !== null && (targetId === NEW || mine.some((m) => m.id === targetId))
            ? targetId
            : (mine.find((m) => m.id === Number(lastId)) ?? mine[0])?.id ?? NEW;
        setTargetId(next);
        await refreshPresent(next);
    }, [deck, targetId, refreshPresent]);

    useFocusEffect(useCallback(() => { void load(); }, [load]));

    if (!deck) return <View style={s.container}><Text style={s.empty}>That deck could not be found.</Text></View>;

    const language = getLanguage(deck.language);
    const total = deck.cards.length;
    const newIndexes = deck.cards.map((_, i) => i).filter((i) => !present.has(i));
    const targetName = targetId === NEW || targetId === null ? null : targets?.find((x) => x.id === targetId)?.name;

    const choose = async (next: number) => {
        setTargetId(next);
        setSelected(new Set());
        await refreshPresent(next);
    };

    // Adds the given cards to the chosen deck (or a brand new one), then shows what changed.
    const add = async (indexes: number[]) => {
        if (busy || indexes.length === 0) return;
        setBusy(true);
        try {
            const cards = indexes.map((i) => deck.cards[i]);
            let into = targetId ?? NEW;
            let created = false;
            if (into === NEW) {
                into = await addDeck(deck.name, deck.language);
                created = true;
            }
            try {
                const added = await addPremadeCards(cards, deck.language, into);
                Alert.alert("Added", `${added} card${added === 1 ? "" : "s"} added.`);
            } catch (error) {
                if (created) await deleteDeck(into).catch(() => undefined);
                throw error;
            }
            setSelected(new Set());
            setPicking(false);
            setTargetId(into);
            await load();
        } catch (error) {
            Alert.alert("Could not add the cards", error instanceof Error ? error.message : String(error));
        } finally {
            setBusy(false);
        }
    };

    const toggle = (i: number) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(i)) next.delete(i);
            else next.add(i);
            return next;
        });

    const allNewSelected = newIndexes.length > 0 && newIndexes.every((i) => selected.has(i));

    return (
        <View style={s.container}>
            <Stack.Screen options={{ title: deck.name }} />
            <FlatList
                data={deck.cards}
                keyExtractor={(_, i) => String(i)}
                contentContainerStyle={s.list}
                ListHeaderComponent={
                    <View style={s.header}>
                        <Text style={s.hint}>{language?.flag} {deck.description}</Text>
                        <Text style={s.label}>Add to</Text>
                        {targets === null ? <ActivityIndicator color={t.blue} /> : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
                                {targets.map((d) => (
                                    <Pressable key={d.id} style={[s.chip, targetId === d.id && s.chipOn]} onPress={() => choose(d.id)} accessibilityRole="button">
                                        <Text style={[s.chipText, targetId === d.id && s.chipTextOn]}>{d.name}</Text>
                                    </Pressable>
                                ))}
                                <Pressable style={[s.chip, targetId === NEW && s.chipOn]} onPress={() => choose(NEW)} accessibilityRole="button">
                                    <Text style={[s.chipText, targetId === NEW && s.chipTextOn]}>+ New deck</Text>
                                </Pressable>
                            </ScrollView>
                        )}
                        <Text style={s.status}>
                            {targetId === NEW || targetId === null
                                ? `${total} cards, none in a deck yet`
                                : `${present.size} of ${total} cards already in ${targetName}`}
                        </Text>
                        <View style={s.row}>
                            <Pressable
                                style={[s.button, (busy || newIndexes.length === 0) && s.off]}
                                disabled={busy || newIndexes.length === 0}
                                onPress={() => add(newIndexes)}
                                accessibilityRole="button"
                            >
                                <Text style={s.buttonText}>{newIndexes.length === 0 ? "All added ✓" : `Add all${present.size > 0 ? ` ${newIndexes.length} new` : ""}`}</Text>
                            </Pressable>
                            <Pressable
                                style={[s.button, s.quiet, (busy || newIndexes.length === 0) && s.off]}
                                disabled={busy || newIndexes.length === 0}
                                onPress={() => { setPicking((p) => !p); setSelected(new Set()); }}
                                accessibilityRole="button"
                            >
                                <Text style={s.quietText}>{picking ? "Cancel" : "Pick cards"}</Text>
                            </Pressable>
                        </View>
                    </View>
                }
                renderItem={({ item, index }) => {
                    const here = present.has(index);
                    const on = selected.has(index);
                    return (
                        <Pressable
                            style={[s.card, here && s.cardHere, on && s.cardOn]}
                            disabled={!picking || here}
                            onPress={() => toggle(index)}
                            accessibilityRole={picking ? "checkbox" : undefined}
                            accessibilityState={picking ? { checked: on, disabled: here } : undefined}
                        >
                            {picking ? <Text style={s.box}>{here ? "✓" : on ? "☑" : "☐"}</Text> : null}
                            <View style={{ flex: 1 }}>
                                <Text style={s.learning}>{item.learning}</Text>
                                <Text style={s.meaning}>{item.meaning}</Text>
                            </View>
                            {here ? <Text style={s.badge}>In deck</Text> : null}
                        </Pressable>
                    );
                }}
            />
            {picking ? (
                <View style={s.bar}>
                    <Pressable style={[s.button, s.quiet]} onPress={() => setSelected(allNewSelected ? new Set() : new Set(newIndexes))} accessibilityRole="button">
                        <Text style={s.quietText}>{allNewSelected ? "Clear" : "Select all new"}</Text>
                    </Pressable>
                    <Pressable style={[s.button, (busy || selected.size === 0) && s.off]} disabled={busy || selected.size === 0} onPress={() => add([...selected].sort((a, b) => a - b))} accessibilityRole="button">
                        {busy ? <ActivityIndicator color={t.bg} /> : <Text style={s.buttonText}>Add selected ({selected.size})</Text>}
                    </Pressable>
                </View>
            ) : null}
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    list: { padding: 16, paddingBottom: 100, gap: 8 },
    header: { gap: 10, marginBottom: 6 },
    hint: { color: t.muted, fontSize: 13 },
    label: { color: t.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
    chips: { gap: 8 },
    chip: { backgroundColor: t.surface, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 14 },
    chipOn: { backgroundColor: t.yellow },
    chipText: { color: t.text, fontSize: 14, fontWeight: "600" },
    chipTextOn: { color: t.bg },
    status: { color: t.text, fontSize: 15, fontWeight: "600" },
    row: { flexDirection: "row", gap: 10 },
    button: { flex: 1, backgroundColor: t.green, borderRadius: 12, paddingVertical: 13, alignItems: "center", justifyContent: "center" },
    buttonText: { color: t.bg, fontWeight: "bold", fontSize: 15 },
    quiet: { backgroundColor: t.surface },
    quietText: { color: t.text, fontWeight: "600", fontSize: 15 },
    off: { opacity: 0.4 },
    card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.surface, borderRadius: 12, padding: 14, borderWidth: 2, borderColor: "transparent" },
    cardHere: { opacity: 0.5 },
    cardOn: { borderColor: t.green },
    box: { color: t.text, fontSize: 22 },
    learning: { color: t.text, fontSize: 18, fontWeight: "600" },
    meaning: { color: t.muted, fontSize: 13, marginTop: 2 },
    badge: { color: t.green, fontSize: 12, fontWeight: "bold" },
    empty: { color: t.muted, textAlign: "center", marginTop: 40 },
    bar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 10, padding: 14, backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.surfaceHigh },
});
