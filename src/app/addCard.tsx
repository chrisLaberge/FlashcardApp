import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
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
    const [exampleSentence, setExampleSentence] = useState("");

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

        await addCard(learningText, localizedText, exampleSentence, Number(deckId));

        setLearningText("");
        setLocalizedText("");
        setExampleSentence("");

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
            <Text style={styles.title}></Text>
            <Text style={styles.title}></Text>
            <Text style={styles.title}></Text>
            <Text style={styles.title}></Text>


            <View style={styles.form}>
                {/* Learning language */}

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

                {/* Localized language */}

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

                {/* Example */}

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
        </ScrollView>
    );
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
        marginBottom: 5,
    },

    subtitle: {
        color: COLORS.gray,
        fontSize: 16,
        marginBottom: 24,
    },

    form: {
        gap: 12,
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

    // Faded language tag in the bottom-right corner of a field
    watermark: {
        position: "absolute",
        right: 12,
        bottom: 8,
        color: COLORS.gray,
        fontSize: 13,
        opacity: 0.45,
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
        marginTop: 12,
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