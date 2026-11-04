import DailyGoalCard from "@/components/DailyGoalCard";
import NavigationButton from "@/components/NavigationButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState, useMemo } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { getLanguage } from "../../constants/languages";
import { getDecks, getProgressCounts } from "../../database/database";
import { useFocusedInterval } from "../../hooks/useFocusedInterval";
import { useTheme } from "../../theme/ThemeProvider";
import type { Palette } from "../../theme/themes";


export default function HomeScreen() {
    const t = useTheme();
    const styles = useMemo(() => makeStyles(t), [t]);
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

    const [pulse] = useState(() => new Animated.Value(0));

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
        outputRange: [t.surfaceHigh, t.yellow],
    });


    return (
        <View style={styles.container}>
            <DailyGoalCard />

            <Animated.View
                style={{
                    backgroundColor: t.surface,
                    borderWidth: deckSelected ? 1 : 2,
                    borderColor: deckSelected ? t.surfaceHigh : t.yellow,
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

            <View style={styles.statsBox}>
                <View style={styles.bar}>
                    <View style={{ flex: dueCount, backgroundColor: t.green }} />
                    <View style={{ flex: practicedCount, backgroundColor: t.blue }} />
                    <View style={{ flex: masteredCount, backgroundColor: t.yellow }} />
                </View>

                <View style={styles.row}>
                    <View style={styles.stat}>
                        <Text style={[styles.statNumber, { color: t.green }]}>{dueCount}</Text>
                        <Text style={styles.statLabel}>To learn</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={[styles.statNumber, { color: t.blue }]}>{practicedCount}</Text>
                        <Text style={styles.statLabel}>Practiced</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={[styles.statNumber, { color: t.yellow }]}>{masteredCount}</Text>
                        <Text style={styles.statLabel}>Mastered</Text>
                    </View>
                </View>
            </View>

            {deckSelected && <NavigationButton deckId={activeDeckId} />}
        </View>
    );
}

const makeStyles = (t: Palette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg, padding: 20, paddingTop: 56 },
    pressed: { opacity: 0.7 },

    deckButton: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 9,
        paddingHorizontal: 12,
    },
    deckName: { flex: 1, color: t.text, fontSize: 15, fontWeight: "600" },
    flag: { fontSize: 20, marginLeft: 8 },
    arrow: { color: t.muted, fontSize: 10, marginLeft: 8 },

    startButton: {
        backgroundColor: t.gold,
        paddingVertical: 28,
        borderRadius: 14,
        alignItems: "center",
        marginBottom: 12,
    },
    startText: { color: t.bg, fontSize: 24, fontWeight: "bold" },

    secondaryButton: {
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.surfaceHigh,
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: "center",
        marginBottom: 24,
    },
    secondaryText: { color: t.text, fontSize: 17, fontWeight: "bold" },

    statsBox: {
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.surfaceHigh,
        borderRadius: 12,
        padding: 16,
    },
    bar: {
        flexDirection: "row",
        height: 6,
        borderRadius: 3,
        overflow: "hidden",
        backgroundColor: t.surfaceHigh,
        marginBottom: 14,
    },
    row: { flexDirection: "row" },
    stat: { flex: 1, alignItems: "center" },
    statNumber: { fontSize: 22, fontWeight: "bold" },
    statLabel: { color: t.muted, fontSize: 13, marginTop: 2 },
});