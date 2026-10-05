import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { translateText } from "@/services/api";
import { getLanguage } from "../constants/languages";
import { addCard, getDecks } from "../database/database";

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
};

export default function AddCardScreen() {
    const { deckId } = useLocalSearchParams<{ deckId?: string }>();

    const [learningLanguageCode, setLearningLanguageCode] = useState("en");
    const [learningLanguageFlag, setLearningLanguageFlag] = useState("🌐");

    // TODO: Replace these when localized language becomes selectable
    const localizedLanguageCode = "en";
    const localizedLanguageFlag = "🇬🇧";

    const [learningText, setLearningText] = useState("");
    const [localizedText, setLocalizedText] = useState("");

    const [translating, setTranslating] =
        useState<TranslationDirection>(null);

    // --------------------------------------------------
    // Load deck language
    // --------------------------------------------------

    useFocusEffect(
        useCallback(() => {
            const loadDeck = async () => {
                const lastDeckId = await AsyncStorage.getItem("lastDeckId");

                if (!lastDeckId) {
                    setLearningLanguageCode("en");
                    setLearningLanguageFlag("🌐");
                    return;
                }

                const decks = await getDecks();

                const deck = decks.find(
                    (deck) => deck.id === Number(lastDeckId)
                );

                if (!deck) {
                    setLearningLanguageCode("en");
                    setLearningLanguageFlag("🌐");
                    return;
                }

                const language = getLanguage(deck.language);

                setLearningLanguageCode(language?.code ?? "en");
                setLearningLanguageFlag(language?.flag ?? "🌐");
            };

            loadDeck();
        }, [deckId])
    );

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
    // Save card
    // --------------------------------------------------

    const addCardToDatabase = async () => {
        if (!deckId) {
            return;
        }

        if (!learningText.trim() || !localizedText.trim()) {
            return;
        }

        await addCard(learningText, localizedText, Number(deckId));

        setLearningText("");
        setLocalizedText("");

        router.back();
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
            <Text style={styles.title}>Add Card</Text>

            <Text style={styles.subtitle}>Create a new flashcard</Text>

            <View style={styles.form}>
                {/* Learning language */}

                <Text style={styles.flag}>{learningLanguageFlag}</Text>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={learningText}
                        onChangeText={setLearningText}
                        placeholder="Enter the word or phrase"
                        placeholderTextColor={COLORS.gray}
                        multiline
                    />

                    {renderTranslateButton("learningToLocalized")}
                </View>

                {/* Localized language */}

                <Text style={styles.flag}>{localizedLanguageFlag}</Text>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={localizedText}
                        onChangeText={setLocalizedText}
                        placeholder="Enter the meaning"
                        placeholderTextColor={COLORS.gray}
                        multiline
                    />

                    {renderTranslateButton("localizedToLearning")}
                </View>

                {/* Add card */}

                <Pressable
                    style={({ pressed }) => [
                        styles.button,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={addCardToDatabase}
                >
                    <Text style={styles.buttonText}>Add Card</Text>
                </Pressable>
            </View>
        </View>
    );
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
        marginBottom: 5,
    },

    subtitle: {
        color: COLORS.gray,
        fontSize: 16,
        marginBottom: 40,
    },

    form: {
        gap: 12,
    },

    flag: {
        fontSize: 20,
        marginLeft: 8,
    },

    inputContainer: {
        position: "relative",
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

    button: {
        backgroundColor: COLORS.yellowDark,
        padding: 16,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 25,
    },

    buttonPressed: {
        opacity: 0.7,
    },

    buttonText: {
        color: COLORS.bg0,
        fontSize: 17,
        fontWeight: "bold",
    },
});