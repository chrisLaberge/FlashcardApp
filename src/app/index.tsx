import NavigationButton from "@/components/NavigationButton";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { getCards } from "../database/database";

export default function HomeScreen() {
    const [cardCount, setCardCount] = useState(0);

    useFocusEffect(
        useCallback(() => {
            const loadCardCount = async () => {
                const cards = await getCards();
                setCardCount(cards.length);
            };

            loadCardCount();
        }, [])
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Start Learning</Text>

            <Text style={styles.subtitle}>
                Keep building your vocabulary.
            </Text>

            <Pressable
                style={({ pressed }) => [
                    styles.startButton,
                    pressed && styles.buttonPressed,
                ]}
                onPress={() => router.push("/learn")}
            >
                <Text style={styles.startButtonText}>Start Learning</Text>
            </Pressable>

            <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{cardCount}</Text>
                    <Text style={styles.statLabel}>Cards to Learn</Text>
                </View>

                <View style={styles.statCard}>
                    <Text style={styles.statNumber}>0</Text>
                    <Text style={styles.statLabel}>Cards Practiced</Text>
                </View>

                <View style={styles.statCard}>
                    <Text style={styles.statNumber}>0</Text>
                    <Text style={styles.statLabel}>Cards Mastered</Text>
                </View>
            </View>

            <NavigationButton />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#282828",
        padding: 20,
        paddingTop: 70,
    },

    title: {
        color: "#ebdbb2",
        fontSize: 38,
        fontWeight: "bold",
        marginBottom: 8,
    },

    subtitle: {
        color: "#a89984",
        fontSize: 17,
        marginBottom: 35,
    },

    startButton: {
        backgroundColor: "#d79921",
        paddingVertical: 17,
        borderRadius: 12,
        alignItems: "center",
        marginBottom: 35,
    },

    startButtonText: {
        color: "#282828",
        fontSize: 18,
        fontWeight: "bold",
    },

    buttonPressed: {
        opacity: 0.7,
    },

    statsContainer: {
        gap: 12,
    },

    statCard: {
        backgroundColor: "#3c3836",
        borderWidth: 1,
        borderColor: "#504945",
        borderRadius: 12,
        padding: 20,
        alignItems: "center",
    },

    statNumber: {
        color: "#d79921",
        fontSize: 32,
        fontWeight: "bold",
        marginBottom: 4,
    },

    statLabel: {
        color: "#ebdbb2",
        fontSize: 16,
    },
});