import NavigationButton from "@/components/NavigationButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { getLanguage } from "../constants/languages";
import { getDecks, getProgressCounts } from "../database/database";
import { useFocusedInterval } from "../hooks/useFocusedInterval";


export default function HomeScreen() {
    const [dueCount, setDueCount] = useState(0);
    const [practicedCount, setPracticedCount] = useState(0);
    const [masteredCount, setMasteredCount] = useState(0);

    const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
    const [selectedDeckName, setSelectedDeckName] = useState("Select a deck");
    const [selectedDeckFlag, setSelectedDeckFlag] = useState("🌐");
    const [deckSelected, setDeckSelected] = useState(false);

    // The selected deck lives in storage (written by the decks screen), never in a route param:
    // a param would keep pointing at an old deck after the selection changes elsewhere.
    const activeDeckId = selectedDeckId ?? undefined;

    // Counts refresh when the screen gains focus, every 10 seconds while it is focused (and the
    // app is in the foreground), and right after a different deck is selected.
    const latestRequest = useRef(0);

    const loadCounts = useCallback(async (deckId: string | undefined) => {
        const request = ++latestRequest.current; // only the newest answer is allowed to update the screen

        const counts = deckId
            ? await getProgressCounts(Number(deckId))
            : { due: 0, practiced: 0, mastered: 0 };
        if (request !== latestRequest.current) return;

        setDueCount(counts.due);
        setPracticedCount(counts.practiced);
        setMasteredCount(counts.mastered);
    }, []);

    useFocusEffect(
        useCallback(() => {
            const loadDeck = async () => {
                const lastDeckId = await AsyncStorage.getItem("lastDeckId");

                const reset = () => {
                    void loadCounts(undefined);
                    setSelectedDeckId(null);
                    setSelectedDeckName("Select a deck");
                    setSelectedDeckFlag("🌐");
                    setDeckSelected(false);
                };

                if (!lastDeckId) return reset();

                const decks = await getDecks();
                const deck = decks.find((d) => d.id === Number(lastDeckId));

                if (!deck) return reset();

                void loadCounts(String(deck.id));
                setSelectedDeckId(String(deck.id));
                setSelectedDeckName(deck.name);
                setSelectedDeckFlag(getLanguage(deck.language)?.flag ?? "🌐");
                setDeckSelected(true);
            };

            loadDeck();
        }, [loadCounts])
    );


    useFocusedInterval(() => loadCounts(activeDeckId));

    const pulse = useRef(new Animated.Value(0)).current;

    useFocusEffect(useCallback(() => {
        if (deckSelected) {
            pulse.stopAnimation();
            pulse.setValue(0);
            return;
        }

        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: false,
                }),
                Animated.timing(pulse, {
                    toValue: 0,
                    duration: 800,
                    useNativeDriver: false,
                }),
            ])
        );

        animation.start();

        return () => animation.stop();
    }, [deckSelected, pulse]));

    const borderColor = pulse.interpolate({
        inputRange: [0, 1],
        outputRange: ["#504945", "#fabd2f"],
    });


    return (
        <View style={styles.container}>
            <Animated.View
                style={{
                    backgroundColor: "#3c3836",
                    borderWidth: deckSelected ? 1 : 2,
                    borderColor: deckSelected ? "#504945" : "#fabd2f",
                    borderRadius: 8,
                    marginBottom: 16,
                    opacity: deckSelected
                        ? 1
                        : pulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.5, 1],
                        }),
                }}
            >
                <Pressable
                    style={({ pressed }) => [
                        styles.deckButton,
                        pressed && styles.pressed,
                    ]}
                    onPress={() => router.push("/decks")}
                >
                    <Text style={styles.deckName} numberOfLines={1}>
                        {selectedDeckName}
                    </Text>
                    <Text style={styles.flag}>{selectedDeckFlag}</Text>
                    <Text style={styles.arrow}>▼</Text>
                </Pressable>
            </Animated.View>

            <Pressable
                style={({ pressed }) => [
                    styles.startButton,
                    !deckSelected && { opacity: 0.5 },
                    pressed && styles.pressed,
                ]}
                disabled={!deckSelected}
                onPress={() => router.push("/learn")}
            >
                <Text style={styles.startText}>Start Learning</Text>
            </Pressable>

            <Pressable
                style={({ pressed }) => [
                    styles.secondaryButton,
                    !deckSelected && { opacity: 0.5 },
                    pressed && styles.pressed]}
                disabled={!deckSelected}
                onPress={() => router.push("/cardList")}
            >
                <Text style={styles.secondaryText}>My Cards</Text>
            </Pressable>

            <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                onPress={() => router.push("/stats")}
            >
                <Text style={styles.secondaryText}>Progress</Text>
            </Pressable>

            <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                onPress={() => router.push("/account")}
            >
                <Text style={styles.secondaryText}>Account</Text>
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

            {deckSelected && <NavigationButton deckId={activeDeckId} />}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#282828", padding: 20, paddingTop: 70 },
    pressed: { opacity: 0.7 },

    deckButton: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 9,
        paddingHorizontal: 12,
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