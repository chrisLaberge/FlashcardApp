import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { getCards } from "../database/database";
import { Card } from "../models/Card";

export default function CardsScreen() {
    const [cards, setCards] = useState<Card[]>([]);

    const loadCards = useCallback(async () => {
        const loadedCards = await getCards();
        setCards(loadedCards);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadCards();
        }, [loadCards])
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>My Cards</Text>

            <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
            >
                {cards.length === 0 ? (
                    <Text style={styles.emptyText}>
                        You don't have any cards yet.
                    </Text>
                ) : (
                    cards.map((card) => (
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
                                        id: card.id,
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

                            <Text style={styles.arrow}>›</Text>
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
});