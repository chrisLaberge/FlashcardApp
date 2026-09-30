import NavigationButton from "@/components/NavigationButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getLanguage } from "../constants/languages";
import { getDecks, getProgressCounts } from "../database/database";

export default function HomeScreen() {
    const [dueCount, setDueCount] = useState(0);
    const [practicedCount, setPracticedCount] = useState(0);
    const [masteredCount, setMasteredCount] = useState(0);

    const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
    const [selectedDeckName, setSelectedDeckName] = useState("Select a deck");
    const [selectedDeckFlag, setSelectedDeckFlag] = useState("🌐");

    const { deckId } = useLocalSearchParams<{ deckId?: string }>();

    const activeDeckId = deckId ?? selectedDeckId ?? undefined;

    useFocusEffect(
        useCallback(() => {
            const loadDeck = async () => {
                const lastDeckId = await AsyncStorage.getItem("lastDeckId");

                const reset = () => {
                    setSelectedDeckId(null);
                    setSelectedDeckName("Select a deck");
                    setSelectedDeckFlag("🌐");
                };

                if (!lastDeckId) return reset();

                const decks = await getDecks();
                const deck = decks.find((d) => d.id === Number(lastDeckId));

                if (!deck) return reset();

                setSelectedDeckId(String(deck.id));
                setSelectedDeckName(deck.name);
                setSelectedDeckFlag(getLanguage(deck.language)?.flag ?? "🌐");
            };

            loadDeck();
        }, [deckId])
    );

    useFocusEffect(
        useCallback(() => {
            const loadProgress = async () => {
                if (!activeDeckId) {
                    setDueCount(0);
                    setPracticedCount(0);
                    setMasteredCount(0);
                    return;
                }

                const counts = await getProgressCounts(Number(activeDeckId));

                setDueCount(counts.due);
                setPracticedCount(counts.practiced);
                setMasteredCount(counts.mastered);
            };

            loadProgress();

            const interval = setInterval(loadProgress, 10000);
            return () => clearInterval(interval);
        }, [activeDeckId])
    );

    return (
        <View style={styles.container}>
            <Pressable
                style={({ pressed }) => [styles.deckButton, pressed && styles.pressed]}
                onPress={() => router.push("/decks")}
            >
                <Text style={styles.deckName} numberOfLines={1}>
                    {selectedDeckName}
                </Text>
                <Text style={styles.flag}>{selectedDeckFlag}</Text>
                <Text style={styles.arrow}>▼</Text>
            </Pressable>

            <Pressable
                style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}
                onPress={() => router.push("/learn")}
            >
                <Text style={styles.startText}>Start Learning</Text>
            </Pressable>

            <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                onPress={() => router.push("/cardList")}
            >
                <Text style={styles.secondaryText}>My Cards</Text>
            </Pressable>

            <View style={styles.statsBox}>
                <View style={styles.bar}>
                    <View style={{ flex: dueCount, backgroundColor: "#b8bb26" }} />
                    <View style={{ flex: practicedCount, backgroundColor: "#83a598" }} />
                    <View style={{ flex: masteredCount, backgroundColor: "#fabd2f" }} />
                </View>

                <View style={styles.row}>
                    <View style={styles.stat}>
                        <Text style={[styles.statNumber, { color: "#b8bb26" }]}>{dueCount}</Text>
                        <Text style={styles.statLabel}>To learn</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={[styles.statNumber, { color: "#83a598" }]}>{practicedCount}</Text>
                        <Text style={styles.statLabel}>Practiced</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={[styles.statNumber, { color: "#fabd2f" }]}>{masteredCount}</Text>
                        <Text style={styles.statLabel}>Mastered</Text>
                    </View>
                </View>
            </View>

            <NavigationButton deckId={activeDeckId} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#282828", padding: 20, paddingTop: 70 },
    pressed: { opacity: 0.7 },

    deckButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#3c3836",
        borderWidth: 1,
        borderColor: "#504945",
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    deckName: { flex: 1, color: "#ebdbb2", fontSize: 15, fontWeight: "600" },
    flag: { fontSize: 20, marginLeft: 8 },
    arrow: { color: "#a89984", fontSize: 10, marginLeft: 8 },

    startButton: {
        backgroundColor: "#d79921",
        paddingVertical: 28,
        borderRadius: 14,
        alignItems: "center",
        marginBottom: 12,
    },
    startText: { color: "#282828", fontSize: 24, fontWeight: "bold" },

    secondaryButton: {
        backgroundColor: "#3c3836",
        borderWidth: 1,
        borderColor: "#504945",
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: "center",
        marginBottom: 24,
    },
    secondaryText: { color: "#ebdbb2", fontSize: 17, fontWeight: "bold" },

    statsBox: {
        backgroundColor: "#3c3836",
        borderWidth: 1,
        borderColor: "#504945",
        borderRadius: 12,
        padding: 16,
    },
    bar: {
        flexDirection: "row",
        height: 6,
        borderRadius: 3,
        overflow: "hidden",
        backgroundColor: "#504945",
        marginBottom: 14,
    },
    row: { flexDirection: "row" },
    stat: { flex: 1, alignItems: "center" },
    statNumber: { fontSize: 22, fontWeight: "bold" },
    statLabel: { color: "#a89984", fontSize: 13, marginTop: 2 },
});