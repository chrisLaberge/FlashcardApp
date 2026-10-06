import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
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

    const [learningText, setLearningText] = useState("");
    const [localizedText, setLocalizedText] = useState("");
    const [exampleSentence, setExampleSentence] = useState("");
    const [progress, setProgress] = useState<CardProgress>();
    const [showProgress, setShowProgress] = useState(false);
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
                setLearningText(card.learningText);
                setLocalizedText(card.localizedText);
                setExampleSentence(card.exampleSentence ?? "");
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
        await updateCard(cardId, learningText, localizedText, exampleSentence);
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

        const sourceText = isLearningSource ? learningText : localizedText;

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
                setLocalizedText(translation);
            } else {
                setLearningText(translation);
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
    // Faded label inside the input (flag + code, or plain text)
    // --------------------------------------------------

    const renderWatermark = (label: string) => (
        <Text style={styles.watermark} pointerEvents="none">
            {label}
        </Text>
    );

    // --------------------------------------------------
    // UI
    // --------------------------------------------------

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
        >

            {/* ---------- Card content ---------- */}
            <View style={styles.form}>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={learningText}
                        onChangeText={setLearningText}
                        placeholder="Enter the word or phrase"
                        placeholderTextColor={COLORS.gray}
                        multiline
                    />

                    {renderWatermark(
                        `${learningLanguageFlag} ${learningLanguageCode.toUpperCase()}`
                    )}
                    {renderTranslateButton("learningToLocalized")}
                </View>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={localizedText}
                        onChangeText={setLocalizedText}
                        placeholder="Enter the meaning"
                        placeholderTextColor={COLORS.gray}
                        multiline
                    />

                    {renderWatermark(
                        `${localizedLanguageFlag} ${localizedLanguageCode.toUpperCase()}`
                    )}
                    {renderTranslateButton("localizedToLearning")}
                </View>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={[styles.input, styles.exampleInput]}
                        value={exampleSentence}
                        onChangeText={setExampleSentence}
                        placeholder="Example sentence (optional)"
                        placeholderTextColor={COLORS.gray}
                        multiline
                    />

                    {renderWatermark("Example")}
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



            {/* ---------- Collapsible progress ---------- */}
            <View style={styles.progressSection}>
                <Pressable
                    style={({ pressed }) => [
                        styles.progressHeader,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={() => setShowProgress((value) => !value)}
                >
                    <Text style={styles.title}></Text>

                    <View style={styles.progressHeaderText}>

                        <Text style={styles.sectionTitle}>

                            Learning Progress
                        </Text>

                        {!showProgress && (
                            <Text style={styles.progressSummary}>
                                Level {progress?.reviewCount ?? 0} · Next:{" "}
                                {formatTimeRemaining(progress?.nextReviewAt)}
                            </Text>
                        )}
                    </View>

                    <MaterialCommunityIcons
                        name={showProgress ? "chevron-up" : "chevron-down"}
                        size={24}
                        color={COLORS.gray}
                    />
                </Pressable>

                {showProgress && (
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
                )}
            </View>

            <Text style={styles.title}></Text>
            <Text style={styles.title}></Text>

            {/* ---------- Actions ---------- */}
            <View style={styles.actionsRow}>
                <Pressable
                    style={({ pressed }) => [
                        styles.resetButton,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={() => setShowResetModal(true)}
                >
                    <Text style={styles.resetButtonText}>Reset</Text>
                </Pressable>

                <Pressable
                    style={({ pressed }) => [
                        styles.deleteButton,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={() => setShowDeleteModal(true)}
                >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
            </View>

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
        </ScrollView>
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
    },

    content: {
        padding: 20,
        paddingTop: 40,
        paddingBottom: 40,
    },

    title: {
        color: COLORS.fg,
        fontSize: 32,
        fontWeight: "bold",
        marginBottom: 24,
    },

    form: {
        gap: 4,
    },

    // Faded language tag in the bottom-right corner of a field
    watermark: {
        position: "absolute",
        right: 12,
        bottom: 8,
        color: COLORS.gray,
        fontSize: 13,
        opacity: 0.45,
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
        paddingBottom: 22,
        paddingTop: 22,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: COLORS.bg2,
        minHeight: 55,
        textAlignVertical: "top",
    },

    exampleInput: {
        minHeight: 55,
        paddingRight: 15,
        fontSize: 16,
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
        marginTop: 24,
        backgroundColor: COLORS.bg1,
        borderWidth: 1,
        borderColor: COLORS.bg2,
        borderRadius: 12,
        padding: 14,
    },

    progressHeader: {
        flexDirection: "row",
        alignItems: "center",
    },

    progressHeaderText: {
        flex: 1,
    },

    progressSummary: {
        color: COLORS.gray,
        fontSize: 13,
        marginTop: 2,
    },

    sectionTitle: {
        color: COLORS.fg,
        fontSize: 17,
        fontWeight: "bold",
    },

    statsContainer: {
        flexDirection: "row",
        gap: 10,
        marginTop: 14,
    },

    statCard: {
        flex: 1,
        backgroundColor: COLORS.bg0,
        borderWidth: 1,
        borderColor: COLORS.bg2,
        borderRadius: 10,
        paddingVertical: 14,
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

    actionsRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 24,
    },

    resetButton: {
        flex: 1,
        backgroundColor: COLORS.bg1,
        borderWidth: 1,
        borderColor: COLORS.blue,
        padding: 14,
        borderRadius: 10,
        alignItems: "center",
    },

    resetButtonText: {
        color: COLORS.blue,
        fontSize: 16,
        fontWeight: "bold",
    },

    deleteButton: {
        flex: 1,
        backgroundColor: COLORS.bg1,
        borderWidth: 1,
        borderColor: COLORS.red,
        padding: 14,
        borderRadius: 10,
        alignItems: "center",
    },

    deleteButtonText: {
        color: COLORS.red,
        fontSize: 16,
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