import Mark from "../components/Mark";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from "react-native";
import Pressable from "../components/Pressable";
import { addDeck, deleteDeck, getDecks } from "../database/database";
import { getPremadeDeck, presentIndexes, targetDeckFor } from "../models/PremadeDecks";
import { addPremadeCards, existingWords } from "../services/premadeDecks";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

type Target = { id: number; name: string } | null;

/** A premade deck: every card you are missing is ticked. Untick what you do not want, then add. */
export default function PremadeDeckScreen() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const { id, deckId } = useLocalSearchParams<{ id?: string; deckId?: string }>();
    const deck = id ? getPremadeDeck(id) : undefined;
    const [loaded, setLoaded] = useState(false);
    const [target, setTarget] = useState<Target>(null);
    const [present, setPresent] = useState<Set<number>>(new Set());
    const [skipped, setSkipped] = useState<Set<number>>(new Set());
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        if (!deck) return;
        const [decks, lastId] = await Promise.all([getDecks(), AsyncStorage.getItem("lastDeckId")]);
        const found = decks.find((d) => d.id === Number(deckId) && d.language === deck.language) ?? targetDeckFor(decks, deck.language, lastId ? Number(lastId) : null);
        setTarget(found ? { id: found.id, name: found.name } : null);
        setPresent(found ? presentIndexes(deck.cards, await existingWords(found.id)) : new Set());
        setLoaded(true);
    }, [deck, deckId]);

    useFocusEffect(useCallback(() => { void load(); }, [load]));

    if (!deck) return <View style={s.container}><Text style={s.empty}>That deck could not be found.</Text></View>;

    const total = deck.cards.length;
    const missing = deck.cards.map((_, i) => i).filter((i) => !present.has(i));
    const chosen = missing.filter((i) => !skipped.has(i));

    const toggle = (i: number) =>
        setSkipped((prev) => {
            const next = new Set(prev);
            if (next.has(i)) next.delete(i);
            else next.add(i);
            return next;
        });

    const add = async () => {
        if (busy || chosen.length === 0) return;
        setBusy(true);
        try {
            let into = target?.id;
            const created = into === undefined;
            if (into === undefined) into = await addDeck(deck.name, deck.language);
            try {
                await addPremadeCards(chosen.map((i) => deck.cards[i]), deck.language, into);
            } catch (error) {
                if (created) await deleteDeck(into).catch(() => undefined);
                throw error;
            }
            setSkipped(new Set());
            await load();
        } catch (error) {
            Alert.alert("Could not add the cards", error instanceof Error ? error.message : String(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <View style={s.container}>
            <Stack.Screen options={{ title: deck.name }} />
            {!loaded ? <ActivityIndicator color={t.blue} style={{ marginTop: 40 }} /> : (
                <FlatList
                    data={deck.cards}
                    keyExtractor={(_, i) => String(i)}
                    contentContainerStyle={s.list}
                    ListHeaderComponent={
                        <Text style={s.status}>
                            {target ? `${present.size} of ${total} cards already in ${target.name}` : `Adds ${total} cards to a new deck`}
                        </Text>
                    }
                    renderItem={({ item, index }) => {
                        const here = present.has(index);
                        const on = !here && !skipped.has(index);
                        return (
                            <Pressable style={[s.card, here && s.cardHere]} disabled={here} onPress={() => toggle(index)} accessibilityRole="checkbox" accessibilityState={{ checked: here || on, disabled: here }}>
                                <View style={s.box}><Mark kind={here ? "check" : on ? "boxOn" : "box"} size={22} color={here || on ? t.green : t.muted} /></View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.learning}>{item.learning}</Text>
                                    <Text style={s.meaning}>{item.meaning}</Text>
                                </View>
                                {here ? <Text style={s.badge}>In deck</Text> : null}
                            </Pressable>
                        );
                    }}
                />
            )}
            {loaded ? (
                <View style={s.bar}>
                    <Pressable style={[s.button, (busy || chosen.length === 0) && s.off]} disabled={busy || chosen.length === 0} onPress={add} accessibilityRole="button">
                        {busy ? <ActivityIndicator color={t.bg} /> : (
                            <Text style={s.buttonText}>{missing.length === 0 ? "All cards are in your deck" : `Add ${chosen.length} card${chosen.length === 1 ? "" : "s"}`}</Text>
                        )}
                    </Pressable>
                </View>
            ) : null}
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    list: { padding: 16, paddingBottom: 110, gap: 8 },
    status: { color: t.text, fontSize: 15, fontWeight: "600", marginBottom: 6 },
    card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.surface, borderRadius: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: t.surfaceHigh },
    cardHere: { opacity: 0.5 },
    box: { width: 28, alignItems: "center" },
    learning: { color: t.text, fontSize: 18, fontWeight: "600" },
    meaning: { color: t.muted, fontSize: 13, marginTop: 2 },
    badge: { color: t.green, fontSize: 12, fontWeight: "600" },
    empty: { color: t.muted, textAlign: "center", marginTop: 40 },
    bar: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 14, backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.surfaceHigh },
    button: { backgroundColor: t.green, borderRadius: 12, paddingVertical: 15, alignItems: "center", justifyContent: "center" },
    buttonText: { color: t.bg, fontWeight: "600", fontSize: 16 },
    off: { opacity: 0.4 },
});
