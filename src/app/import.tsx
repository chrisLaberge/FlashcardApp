import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import Papa from "papaparse";
import { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import {
    addCard,
    getDecks,
    updateCardProgress,
} from "../database/database";


import { getRomanization } from "../utils/romanization";

type CsvCard = {
    learningText: string;
    definition: string;
    example?: string;
    timeTillNextReview?: number;
};

export default function ImportScreen() {
    const [cards, setCards] = useState<CsvCard[]>([]);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    async function selectCsv() {
        setError("");
        setMessage("");
        setCards([]);

        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
                copyToCacheDirectory: true,
                multiple: false,
            });

            if (result.canceled) return;

            const file = result.assets[0];

            if (!file.name.toLowerCase().endsWith(".csv")) {
                throw new Error("Please select a .csv file.");
            }

            console.log("Selected CSV:", file.uri);

            const csvText = await (await fetch(file.uri)).text();

            console.log("CSV contents:", csvText.slice(0, 200));

            const parsed = Papa.parse<string[]>(csvText, {
                header: false,
                skipEmptyLines: "greedy",
                transform: (value) => value.trim(),
            });

            if (parsed.errors.length > 0) {
                throw new Error(parsed.errors[0].message);
            }

            let rows = parsed.data;

            // Skip a recognizable header row, if present.
            if (rows.length > 0) {
                const first = rows[0].map((value) =>
                    value.trim().toLowerCase()
                );

                const firstCell = first[0] ?? "";
                const secondCell = first[1] ?? "";

                const headerLabels = [
                    "learningtext",
                    "learning text",
                    "word",
                    "term",
                    "front",
                ];

                const definitionLabels = [
                    "definition",
                    "translation",
                    "meaning",
                    "localizedtext",
                    "localized text",
                    "back",
                ];

                if (
                    headerLabels.includes(firstCell) ||
                    (firstCell === "learning" &&
                        definitionLabels.includes(secondCell))
                ) {
                    rows = rows.slice(1);
                }
            }

            const importedCards: CsvCard[] = [];

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];

                if (!row.some((value) => value.trim())) continue;

                const learningText = row[0]?.trim();
                const definition = row[1]?.trim();
                const example = row[2]?.trim();
                const rawTime = row[3]?.trim();

                if (!learningText || !definition) {
                    throw new Error(
                        `Row ${i + 1}: the first two columns ` +
                        "must contain learning text and definition."
                    );
                }

                let timeTillNextReview: number | undefined;

                if (rawTime) {
                    timeTillNextReview = Number(rawTime);

                    if (
                        !Number.isFinite(timeTillNextReview) ||
                        timeTillNextReview < 0
                    ) {
                        throw new Error(
                            `Row ${i + 1}: review delay must be ` +
                            "a non-negative number of milliseconds."
                        );
                    }
                }

                importedCards.push({
                    learningText,
                    definition,
                    example: example || undefined,
                    timeTillNextReview,
                });
            }

            if (importedCards.length === 0) {
                throw new Error("No cards were found in this CSV.");
            }

            setCards(importedCards);
            setMessage(`Found ${importedCards.length} cards.`);
        } catch (err) {
            console.error("CSV import error:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Could not read the CSV file."
            );
        }
    }

    async function importCards() {
        if (cards.length === 0 || loading) return;

        setLoading(true);
        setError("");
        setMessage("");

        try {
            const storedDeckId = await AsyncStorage.getItem("lastDeckId");

            if (!storedDeckId) {
                throw new Error("No deck selected. Go back and select a deck first.");
            }

            const deckId = Number(storedDeckId);
            const decks = await getDecks();
            const selectedDeck = decks.find((deck) => Number(deck.id) === deckId);

            if (!selectedDeck) {
                throw new Error(
                    `Deck ${deckId} not found. Go back to your deck list and select a deck again.`
                );
            }

            if (!Number.isInteger(deckId) || deckId <= 0) {
                throw new Error("The selected deck ID is invalid.");
            }

            let importedCount = 0;


            for (const card of cards) {
                const romanization = await getRomanization(
                    card.learningText,
                    selectedDeck.language
                );

                const cardId = await addCard(
                    card.learningText,
                    card.definition,
                    card.example ?? "",
                    romanization ?? "",
                    deckId
                );

                if (card.timeTillNextReview !== undefined) {
                    await updateCardProgress(
                        Number(cardId),
                        0,
                        Date.now() + card.timeTillNextReview,
                        false
                    );
                }

                importedCount++;
            }

            setCards([]);
            setMessage(`Successfully imported ${importedCount} cards.`);
        } catch (err) {
            console.error("Database import error:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to import cards."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={styles.back}>← Back</Text>
                </Pressable>

                <Text style={styles.title}>Import CSV</Text>
            </View>

            <Text style={styles.description}>
                CSV column order:
                {"\n"}1. Learning text (required)
                {"\n"}2. Definition (required)
                {"\n"}3. Example (optional)
                {"\n"}4. Time until next review in milliseconds (optional)
            </Text>

            <Pressable
                style={styles.button}
                onPress={selectCsv}
                disabled={loading}
            >
                <Text style={styles.buttonText}>Choose CSV File</Text>
            </Pressable>

            {!!message && (
                <Text style={styles.message}>{message}</Text>
            )}

            {!!error && (
                <Text style={styles.error}>{error}</Text>
            )}

            {cards.length > 0 && (
                <>
                    <Text style={styles.subtitle}>
                        Preview ({cards.length} cards)
                    </Text>

                    <ScrollView
                        style={styles.preview}
                        contentContainerStyle={styles.previewContent}
                    >
                        {cards.slice(0, 20).map((card, index) => (
                            <View key={index} style={styles.card}>
                                <Text style={styles.learning}>
                                    {card.learningText}
                                </Text>

                                <Text style={styles.definition}>
                                    {card.definition}
                                </Text>

                                {!!card.example && (
                                    <Text style={styles.example}>
                                        {card.example}
                                    </Text>
                                )}

                                {card.timeTillNextReview !== undefined && (
                                    <Text style={styles.muted}>
                                        Review delay:{" "}
                                        {card.timeTillNextReview} ms
                                    </Text>
                                )}
                            </View>
                        ))}

                        {cards.length > 20 && (
                            <Text style={styles.muted}>
                                Showing 20 of {cards.length} cards.
                            </Text>
                        )}
                    </ScrollView>

                    <Pressable
                        style={[
                            styles.button,
                            loading && styles.disabled,
                        ]}
                        onPress={importCards}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#282828" />
                        ) : (
                            <Text style={styles.buttonText}>
                                Import {cards.length} Cards
                            </Text>
                        )}
                    </Pressable>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#282828",
        padding: 20,
        paddingTop: 60,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 20,
        marginBottom: 20,
    },
    back: {
        color: "#fabd2f",
        fontSize: 16,
    },
    title: {
        color: "#ebdbb2",
        fontSize: 24,
        fontWeight: "bold",
    },
    description: {
        color: "#a89984",
        lineHeight: 22,
        marginBottom: 16,
    },
    button: {
        backgroundColor: "#fabd2f",
        padding: 14,
        borderRadius: 8,
        alignItems: "center",
        marginVertical: 8,
    },
    buttonText: {
        color: "#282828",
        fontWeight: "bold",
        fontSize: 16,
    },
    message: {
        color: "#b8bb26",
        marginVertical: 8,
    },
    error: {
        color: "#fb4934",
        marginVertical: 8,
    },
    subtitle: {
        color: "#ebdbb2",
        fontSize: 18,
        fontWeight: "bold",
        marginTop: 12,
    },
    preview: {
        flex: 1,
        marginVertical: 8,
    },
    previewContent: {
        paddingBottom: 8,
    },
    card: {
        backgroundColor: "#3c3836",
        padding: 12,
        borderRadius: 8,
        marginVertical: 4,
    },
    learning: {
        color: "#fabd2f",
        fontWeight: "bold",
        fontSize: 16,
    },
    definition: {
        color: "#ebdbb2",
        marginTop: 4,
    },
    example: {
        color: "#a89984",
        marginTop: 4,
        fontStyle: "italic",
    },
    muted: {
        color: "#a89984",
        marginTop: 6,
    },
    disabled: {
        opacity: 0.6,
    },
});

