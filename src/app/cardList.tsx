import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState, useMemo } from "react";
import { Alert, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import Pressable from "../components/Pressable";
import AddedHistory from "../components/AddedHistory";
import { getCardsPage } from "../database/database";
import { formatTimeRemaining } from "../utils/timeRemaining";
import { Card } from "../models/Card";
import { exportDatabase } from "../utils/exportDatabase";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

export default function CardsScreen() {
    const t = useTheme();
    const styles = useMemo(() => makeStyles(t), [t]);

    const [view, setView] = useState<"cards" | "history">("cards");
    const [cards, setCards] = useState<Card[]>([]);
    const [search, setSearch] = useState("");
    const [deckId, setDeckId] = useState<string | null>(null);
    const PAGE_SIZE = 100;

    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);


    const loadCards = useCallback(async () => {
        const lastDeckId = await AsyncStorage.getItem("lastDeckId");

        if (!lastDeckId) {
            setDeckId(null);
            setCards([]);
            return;
        }

        setDeckId(lastDeckId);
        setOffset(0);
        setHasMore(true);
        setLoading(true);

        try {
            const loadedCards = await getCardsPage(
                Number(lastDeckId),
                PAGE_SIZE,
                0,
                search
            );

            setCards(loadedCards);
            setOffset(loadedCards.length);
            setHasMore(loadedCards.length === PAGE_SIZE);
        } finally {
            setLoading(false);
        }
    }, [search]);

    useFocusEffect(
        useCallback(() => {
            loadCards();
        }, [loadCards])
    );

    const loadMoreCards = async () => {
        if (!deckId || loading || !hasMore) return;

        setLoading(true);

        try {
            const newCards = await getCardsPage(
                Number(deckId),
                PAGE_SIZE,
                offset,
                search
            );

            setCards((previous) => [...previous, ...newCards]);
            setOffset((previous) => previous + newCards.length);
            setHasMore(newCards.length === PAGE_SIZE);
        } finally {
            setLoading(false);
        }
    };



    const handleImport = () => {
        router.push("/import");
    };
    const handleExport = async () => {
        try {
            await exportDatabase();
        } catch (error) {
            Alert.alert(
                "Export failed",
                error instanceof Error ? error.message : String(error)
            );
        }
    };


    return (
        <View style={styles.container}>
            <View style={styles.actionRow}>
                <ActionButton label="Export" onPress={handleExport} />
                <ActionButton label="Import" onPress={handleImport} />
            </View>

            <View style={styles.toggle}>
                {(["cards", "history"] as const).map((v) => (
                    <Pressable key={v} style={[styles.toggleTab, view === v && styles.toggleTabOn]} onPress={() => setView(v)} accessibilityRole="button" accessibilityState={{ selected: view === v }}>
                        <Text style={[styles.toggleText, view === v && styles.toggleTextOn]}>{v === "cards" ? "Cards" : "History"}</Text>
                    </Pressable>
                ))}
            </View>

            {view === "history" ? <AddedHistory /> : (
            <>
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search cards..."
                    placeholderTextColor={t.muted}
                    value={search}
                    onChangeText={setSearch}
                />

                <Text style={styles.searchCount}>
                    {cards.length}
                </Text>
            </View>

            <FlatList
                style={styles.list}
                contentContainerStyle={styles.listContent}
                data={cards}
                keyExtractor={(card) => String(card.id)}
                renderItem={({ item: card }) => (
                    <Pressable
                        style={({ pressed }) => [
                            styles.card,
                            pressed && styles.cardPressed,
                        ]}
                        onPress={() =>
                            router.push({
                                pathname: "/editCard",
                                params: { id: String(card.id) },
                            })
                        }
                    >
                        <View style={styles.cardTextContainer}>
                            <Text style={styles.front}>
                                {card.learningText}
                            </Text>
                            <Text style={styles.back}>
                                {card.localizedText}
                            </Text>
                            <Text style={styles.example}>
                                {card.exampleSentence}
                            </Text>
                            <Text style={styles.due}>
                                Next review: {formatTimeRemaining(card.nextReviewAt)}
                            </Text>
                        </View>
                        <Text style={styles.arrow}>›</Text>
                    </Pressable>
                )}
                onEndReached={loadMoreCards}
                onEndReachedThreshold={0.5}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>
                        {loading
                            ? "Loading cards..."
                            : "You don't have any cards yet."}
                    </Text>
                }
                ListFooterComponent={
                    loading && cards.length > 0
                        ? <Text style={styles.emptyText}>Loading more...</Text>
                        : undefined
                }
            />
            </>
            )}
        </View>
    );
}

function ActionButton({
    label,
    onPress,
    disabled = false,
}: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
}) {
    const t = useTheme();
    const styles = useMemo(() => makeStyles(t), [t]);
    return (
        <Pressable
            disabled={disabled}
            onPress={onPress}
            hitSlop={8}
            style={({ pressed }) => [
                styles.actionButton,
                (pressed || disabled) && styles.actionButtonPressed,
            ]}
        >
            <Text style={styles.actionText}>{label}</Text>
        </Pressable>
    );
}

const makeCOLORS = (t: Palette) => ({
    background: t.bg,
    surface: t.surface,
    border: t.surfaceHigh,
    text: t.text,
    muted: t.muted,
    accent: t.gold,
    link: t.blue,
});

const makeStyles = (t: Palette) => {
    const COLORS = makeCOLORS(t);
    return StyleSheet.create({

    container: {
        flex: 1,
        backgroundColor: t.bg,
        padding: 20,
    },

    title: {
        color: t.text,
        fontSize: 32,
        fontWeight: "600",
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
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.surfaceHigh,
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
        color: t.text,
        fontSize: 19,
        fontWeight: "600",
        marginBottom: 5,
    },

    back: {
        color: t.muted,
        fontSize: 16,
    },

    due: { color: t.muted, fontSize: 12, marginTop: 4 },
    arrow: {
        color: t.gold,
        fontSize: 30,
        marginLeft: 15,
    },

    emptyText: {
        color: t.muted,
        fontSize: 16,
        textAlign: "center",
        marginTop: 40,
    },

    searchInput: {
        flex: 1,
        color: t.text,
        padding: 14,
        fontSize: 16,
    },

    searchCount: {
        color: t.blue,
        fontSize: 16,
        fontWeight: "600",
        marginRight: 14,
    },

    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.surfaceHigh,
        borderRadius: 12,
        marginBottom: 20,
    },
    example: {
        color: t.green,
        fontSize: 16,
        marginTop: 5,
    },

    actionButton: {
        alignSelf: "flex-end",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 12,
    },

    actionButtonPressed: {
        opacity: 0.5,
    },

    actionText: {
        color: COLORS.link,
        fontSize: 14,
        fontWeight: "500",
    },
    toggle: { flexDirection: "row", backgroundColor: t.surface, borderRadius: 10, padding: 3, marginBottom: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: t.surfaceHigh },
    toggleTab: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: "center" },
    toggleTabOn: { backgroundColor: t.surfaceHigh },
    toggleText: { color: t.muted, fontWeight: "600" },
    toggleTextOn: { color: t.text },
    actionRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 10,
    },
    });
};