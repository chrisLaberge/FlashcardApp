import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { getCards } from "../database/database";
import { Card } from "../models/Card";

export default function CardsScreen() {
    const [cards, setCards] = useState<Card[]>([]);
    const [search, setSearch] = useState("");
    const [deckId, setDeckId] = useState<string | null>(null);

    const loadCards = useCallback(async () => {
        const lastDeckId =
            await AsyncStorage.getItem("lastDeckId");

        if (!lastDeckId) {
            setDeckId(null);
            setCards([]);
            return;
        }

        setDeckId(lastDeckId);

        const loadedCards = await getCards(
            Number(lastDeckId)
        );

        setCards(loadedCards);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadCards();
        }, [loadCards])
    );

    const filteredCards = cards.filter(
        (card) =>
            card.front
                .toLowerCase()
                .includes(search.toLowerCase()) ||
            card.back
                .toLowerCase()
                .includes(search.toLowerCase())
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>
                My Cards
            </Text>

            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search cards..."
                    placeholderTextColor="#a89984"
                    value={search}
                    onChangeText={setSearch}
                />

                <Text style={styles.searchCount}>
                    {filteredCards.length}
                </Text>
            </View>

            <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
            >
                {cards.length === 0 ? (
                    <Text style={styles.emptyText}>
                        You don't have any cards yet.
                    </Text>
                ) : (
                    filteredCards.map((card) => (
                        <Pressable
                            key={card.id}
                            style={({ pressed }) => [
                                styles.card,
                                pressed && styles.cardPressed,
                            ]}
                            onPress={() =>
                                router.push({
                                    pathname: "/editCard",
                                    params: {
                                        id: String(card.id),
                                    },
                                })
                            }
                        >
                            <View style={styles.cardTextContainer}>
                                <Text style={styles.front}>
                                    {card.front}
                                </Text>

                                <Text style={styles.back}>
                                    {card.back}
                                </Text>
                            </View>

                            <Text style={styles.arrow}>
                                ›
                            </Text>
                        </Pressable>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#282828",
        padding: 20,
    },

    title: {
        color: "#ebdbb2",
        fontSize: 32,
        fontWeight: "bold",
        marginBottom: 20,
    },

    list: {
        flex: 1,
    },

    listContent: {
        gap: 12,
        paddingBottom: 20,
    },

    card: {
        backgroundColor: "#3c3836",
        borderWidth: 1,
        borderColor: "#504945",
        borderRadius: 12,
        padding: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    cardPressed: {
        opacity: 0.7,
    },

    cardTextContainer: {
        flex: 1,
    },

    front: {
        color: "#ebdbb2",
        fontSize: 19,
        fontWeight: "bold",
        marginBottom: 5,
    },

    back: {
        color: "#a89984",
        fontSize: 16,
    },

    arrow: {
        color: "#d79921",
        fontSize: 30,
        marginLeft: 15,
    },

    emptyText: {
        color: "#a89984",
        fontSize: 16,
        textAlign: "center",
        marginTop: 40,
    },

    searchInput: {
        flex: 1,
        color: "#ebdbb2",
        padding: 14,
        fontSize: 16,
    },

    searchCount: {
        color: "#83a598",
        fontSize: 16,
        fontWeight: "bold",
        marginRight: 14,
    },

    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#3c3836",
        borderWidth: 1,
        borderColor: "#504945",
        borderRadius: 12,
        marginBottom: 20,
    },
});