import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { translateText } from "@/services/api";
import { getLanguage } from "../constants/languages";
import {
    deleteCard,
    getCard,
    getCardProgress,
    getDecks,
    resetCardProgress,
    updateCard,
} from "../database/database";

import { CardProgress } from "../models/CardProgress";

type TranslationDirection = "learningToLocalized" | "localizedToLearning" | null;

// Gruvbox palette
const COLORS = {
    bg0: "#282828",
    bg1: "#3c3836",
    bg2: "#504945",
    fg: "#ebdbb2",
    gray: "#a89984",
    yellow: "#fabd2f",
    yellowDark: "#d79921",
    red: "#cc241d",
    blue: "#5992b1",
};

export default function EditCardScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const cardId = Number(id);

    const [front, setFront] = useState("");
    const [back, setBack] = useState("");
    const [progress, setProgress] = useState<CardProgress>();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);

    const [learningLanguageCode, setLearningLanguageCode] = useState("en");
    const [learningLanguageFlag, setLearningLanguageFlag] = useState("🌐");

    // TODO: Replace these when localized language becomes selectable
    const localizedLanguageCode = "en";
    const localizedLanguageFlag = "🇬🇧";

    const [translating, setTranslating] =
        useState<TranslationDirection>(null);

    useEffect(() => {
        const loadCard = async () => {
            const card = await getCard(cardId);

            if (card) {
                setFront(card.learningText);
                setBack(card.localizedText);
            }

            const cardProgress = await getCardProgress(cardId);

            if (cardProgress) {
                setProgress(cardProgress);
            }

            // Load deck language (same approach as AddCardScreen)
            const lastDeckId = await AsyncStorage.getItem("lastDeckId");

            if (lastDeckId) {
                const decks = await getDecks();
                const deck = decks.find(
                    (deck) => deck.id === Number(lastDeckId)
                );

                if (deck) {
                    const language = getLanguage(deck.language);
                    setLearningLanguageCode(language?.code ?? "en");
                    setLearningLanguageFlag(language?.flag ?? "🌐");
                }
            }
        };

        loadCard();
    }, [cardId]);

    const saveChanges = async () => {
        await updateCard(cardId, front, back);
        router.back();
    };

    const removeCard = async () => {
        await deleteCard(cardId);
        router.back();
    };

    const resetCard = async () => {
        await resetCardProgress(cardId);
        const cardProgress = await getCardProgress(cardId);

        if (cardProgress) {
            setProgress(cardProgress);
        }
    };

    // --------------------------------------------------
    // Translation
    // --------------------------------------------------

    const translate = async (
        direction: Exclude<TranslationDirection, null>
    ) => {
        if (translating !== null) {
            return;
        }

        const isLearningSource = direction === "learningToLocalized";

        const sourceText = isLearningSource ? front : back;

        const targetLanguage = isLearningSource
            ? localizedLanguageCode
            : learningLanguageCode;

        if (!sourceText.trim()) {
            return;
        }

        if (
            isLearningSource &&
            learningLanguageCode === localizedLanguageCode
        ) {
            return;
        }

        setTranslating(direction);

        try {
            const translation = await translateText(
                sourceText,
                targetLanguage
            );

            if (isLearningSource) {
                setBack(translation);
            } else {
                setFront(translation);
            }
        } catch (error) {
            console.error("Translation failed:", error);
        } finally {
            setTranslating(null);
        }
    };

    // --------------------------------------------------
    // Translate button
    // --------------------------------------------------

    const renderTranslateButton = (
        direction: Exclude<TranslationDirection, null>
    ) => {
        const isLoading = translating === direction;
        const isDisabled = translating !== null;

        return (
            <Pressable
                style={({ pressed }) => [
                    styles.translateButton,
                    pressed && styles.translateButtonPressed,
                    isDisabled && !isLoading && styles.translateButtonDisabled,
                ]}
                onPress={() => translate(direction)}
                disabled={isDisabled}
                hitSlop={8}
            >
                {isLoading ? (
                    <ActivityIndicator size="small" color={COLORS.yellow} />
                ) : (
                    <MaterialCommunityIcons
                        name="translate"
                        size={18}
                        color={COLORS.yellow}
                    />
                )}
            </Pressable>
        );
    };

    // --------------------------------------------------
    // UI
    // --------------------------------------------------

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Edit Card</Text>

            <View style={styles.form}>
                <Text style={styles.flag}>{learningLanguageFlag}</Text>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={front}
                        onChangeText={setFront}
                        placeholder="Enter the word or phrase"
                        placeholderTextColor={COLORS.gray}
                        multiline
                    />

                    {renderTranslateButton("learningToLocalized")}
                </View>

                <Text style={styles.flag}>{localizedLanguageFlag}</Text>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={back}
                        onChangeText={setBack}
                        placeholder="Enter the meaning"
                        placeholderTextColor={COLORS.gray}
                        multiline
                    />

                    {renderTranslateButton("localizedToLearning")}
                </View>

                <Pressable
                    style={({ pressed }) => [
                        styles.saveButton,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={saveChanges}
                >
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                </Pressable>
            </View>

            <View style={styles.progressSection}>
                <Text style={styles.sectionTitle}>Learning Progress</Text>

                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>
                            {progress?.reviewCount ?? 0}
                        </Text>

                        <Text style={styles.statLabel}>Level</Text>
                    </View>

                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>
                            {formatTimeRemaining(progress?.nextReviewAt)}
                        </Text>

                        <Text style={styles.statLabel}>Next Review</Text>
                    </View>

                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>
                            {progress?.mastered ? "Yes" : "No"}
                        </Text>

                        <Text style={styles.statLabel}>Mastered</Text>
                    </View>
                </View>
            </View>

            <Pressable
                style={({ pressed }) => [
                    styles.resetButton,
                    pressed && styles.buttonPressed,
                ]}
                onPress={() => setShowResetModal(true)}
            >
                <Text style={styles.resetButtonText}>Reset Card</Text>
            </Pressable>

            <Pressable
                style={({ pressed }) => [
                    styles.deleteButton,
                    pressed && styles.buttonPressed,
                ]}
                onPress={() => setShowDeleteModal(true)}
            >
                <Text style={styles.deleteButtonText}>Delete Card</Text>
            </Pressable>

            <Modal
                visible={showResetModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowResetModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modal}>
                        <Text style={styles.modalTitle}>
                            Reset Card Progress?
                        </Text>

                        <Text style={styles.modalText}>
                            This will reset this card's learning progress
                            back to the beginning.
                        </Text>

                        <View style={styles.modalButtons}>
                            <Pressable
                                style={styles.cancelButton}
                                onPress={() => setShowResetModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>
                                    Cancel
                                </Text>
                            </Pressable>

                            <Pressable
                                style={styles.resetConfirmButton}
                                onPress={async () => {
                                    await resetCard();
                                    setShowResetModal(false);
                                }}
                            >
                                <Text style={styles.resetConfirmText}>
                                    Reset
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showDeleteModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDeleteModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modal}>
                        <Text style={styles.modalTitle}>Delete Card?</Text>

                        <Text style={styles.modalText}>
                            Are you sure you want to permanently delete
                            this card?
                        </Text>

                        <View style={styles.modalButtons}>
                            <Pressable
                                style={styles.cancelButton}
                                onPress={() => setShowDeleteModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>
                                    Cancel
                                </Text>
                            </Pressable>

                            <Pressable
                                style={styles.deleteConfirmButton}
                                onPress={async () => {
                                    await removeCard();
                                }}
                            >
                                <Text style={styles.deleteConfirmText}>
                                    Delete
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function formatTimeRemaining(nextReviewAt?: number): string {
    if (!nextReviewAt) {
        return "Now";
    }

    const remaining = nextReviewAt - Date.now();

    if (remaining <= 0) {
        return "Now";
    }

    const minutes = Math.ceil(remaining / (60 * 1000));

    if (minutes < 60) {
        return `${minutes} min`;
    }

    const hours = Math.ceil(minutes / 60);

    if (hours < 24) {
        return `${hours} hr`;
    }

    const days = Math.ceil(hours / 24);

    return `${days} day${days === 1 ? "" : "s"}`;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg0,
        padding: 20,
        paddingTop: 40,
    },

    title: {
        color: COLORS.fg,
        fontSize: 32,
        fontWeight: "bold",
        marginBottom: 30,
    },

    form: {
        gap: 4,
    },

    flag: {
        fontSize: 20,
        marginLeft: 8,
        marginBottom: 8,
    },

    inputContainer: {
        position: "relative",
        marginBottom: 16,
    },

    input: {
        backgroundColor: COLORS.bg1,
        color: COLORS.fg,
        fontSize: 18,
        padding: 15,
        paddingRight: 56,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: COLORS.bg2,
        minHeight: 55,
        textAlignVertical: "top",
    },

    // Tinted circle, sits at the top-right of the field
    translateButton: {
        position: "absolute",
        right: 10,
        top: 9,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(250,189,47,0.12)",
        borderWidth: 1,
        borderColor: "rgba(250,189,47,0.35)",
    },

    translateButtonPressed: {
        opacity: 0.6,
    },

    translateButtonDisabled: {
        opacity: 0.4,
    },

    saveButton: {
        backgroundColor: COLORS.yellowDark,
        padding: 16,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 8,
    },

    saveButtonText: {
        color: COLORS.bg0,
        fontSize: 17,
        fontWeight: "bold",
    },

    progressSection: {
        marginTop: 30,
    },

    sectionTitle: {
        color: COLORS.fg,
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 12,
    },

    statsContainer: {
        flexDirection: "row",
        gap: 10,
    },

    statCard: {
        flex: 1,
        backgroundColor: COLORS.bg1,
        borderWidth: 1,
        borderColor: COLORS.bg2,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 8,
        alignItems: "center",
    },

    statNumber: {
        color: COLORS.yellowDark,
        fontSize: 21,
        fontWeight: "bold",
        marginBottom: 5,
    },

    statLabel: {
        color: COLORS.gray,
        fontSize: 13,
        textAlign: "center",
    },

    deleteButton: {
        backgroundColor: COLORS.bg1,
        borderWidth: 1,
        borderColor: COLORS.red,
        padding: 16,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 30,
    },

    deleteButtonText: {
        color: COLORS.red,
        fontSize: 17,
        fontWeight: "bold",
    },

    resetButton: {
        backgroundColor: COLORS.bg1,
        borderWidth: 1,
        borderColor: COLORS.blue,
        padding: 16,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 30,
    },

    resetButtonText: {
        color: COLORS.blue,
        fontSize: 17,
        fontWeight: "bold",
    },

    buttonPressed: {
        opacity: 0.7,
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        justifyContent: "center",
        alignItems: "center",
    },

    modal: {
        width: "85%",
        backgroundColor: COLORS.bg1,
        borderWidth: 1,
        borderColor: COLORS.bg2,
        borderRadius: 15,
        padding: 22,
    },

    modalTitle: {
        color: COLORS.fg,
        fontSize: 22,
        fontWeight: "bold",
        marginBottom: 10,
    },

    modalText: {
        color: COLORS.gray,
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 24,
    },

    modalButtons: {
        flexDirection: "row",
        gap: 10,
    },

    cancelButton: {
        flex: 1,
        backgroundColor: COLORS.bg2,
        padding: 14,
        borderRadius: 10,
        alignItems: "center",
    },

    cancelButtonText: {
        color: COLORS.fg,
        fontSize: 16,
        fontWeight: "bold",
    },

    resetConfirmButton: {
        flex: 1,
        backgroundColor: COLORS.blue,
        padding: 14,
        borderRadius: 10,
        alignItems: "center",
    },

    resetConfirmText: {
        color: COLORS.bg0,
        fontSize: 16,
        fontWeight: "bold",
    },

    deleteConfirmButton: {
        flex: 1,
        backgroundColor: COLORS.red,
        padding: 14,
        borderRadius: 10,
        alignItems: "center",
    },

    deleteConfirmText: {
        color: COLORS.fg,
        fontSize: 16,
        fontWeight: "bold",
    },
});