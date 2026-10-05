
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { getLanguage } from "../constants/languages";
import { addCard, getDecks } from "../database/database";

export default function AddCardScreen() {
    const { deckId } = useLocalSearchParams<{ deckId?: string }>();

    const [learningLanguageFlag, setLearningLanguageFlag] = useState("🌐");
    const [localizedLanguageFlag, setLocalizedLanguageFlag] = useState("🇬🇧");

    const [learningText, setLearningText] = useState("");
    const [localizedText, setLocalizedText] = useState("");

    useFocusEffect(
        useCallback(() => {
            const loadDeck = async () => {
                const lastDeckId = await AsyncStorage.getItem("lastDeckId");

                const reset = () => {
                    setLearningLanguageFlag("🌐");
                };

                if (!lastDeckId) return reset();

                const decks = await getDecks();
                const deck = decks.find((d) => d.id === Number(lastDeckId));

                if (!deck) return reset();

                setLearningLanguageFlag(
                    getLanguage(deck.language)?.flag ?? "🌐"
                );
            };

            loadDeck();
        }, [deckId])
    );

    const addCardToDatabase = async () => {
        console.log("deckId:", deckId);
        console.log("learningText:", learningText);
        console.log("localizedText:", localizedText);

        if (!deckId) return;

        await addCard(
            learningText,
            localizedText,
            Number(deckId)
        );

        setLearningText("");
        setLocalizedText("");

        router.back();
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Add Card</Text>

            <Text style={styles.subtitle}>
                Create a new flashcard
            </Text>

            <View style={styles.form}>

                <Text style={styles.flag}>{learningLanguageFlag}</Text>

                <TextInput
                    style={styles.input}
                    value={learningText}
                    onChangeText={setLearningText}
                    placeholder="Enter the word or phrase"
                    placeholderTextColor="#a89984"
                />

                <Text style={styles.flag}>{localizedLanguageFlag}</Text>

                <TextInput
                    style={styles.input}
                    value={localizedText}
                    onChangeText={setLocalizedText}
                    placeholder="Enter the meaning"
                    placeholderTextColor="#a89984"
                />

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
        backgroundColor: "#282828",
        padding: 20,
        paddingTop: 40,
    },

    title: {
        color: "#ebdbb2",
        fontSize: 32,
        fontWeight: "bold",
        marginBottom: 5,
    },

    subtitle: {
        color: "#a89984",
        fontSize: 16,
        marginBottom: 40,
    },

    form: {
        gap: 12,
    },

    label: {
        color: "#ebdbb2",
        fontSize: 16,
        fontWeight: "600",
        marginTop: 10,
    },

    input: {
        backgroundColor: "#3c3836",
        color: "#ebdbb2",
        fontSize: 18,
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#504945",
    },

    button: {
        backgroundColor: "#d79921",
        padding: 16,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 25,
    },

    buttonPressed: {
        opacity: 0.7,
    },

    buttonText: {
        color: "#282828",
        fontSize: 17,
        fontWeight: "bold",
    },

    flag: {
        fontSize: 20,
        marginLeft: 8,
    },
});

