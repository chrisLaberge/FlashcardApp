import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import {
    deleteCard,
    getCards,
    updateCard,
} from "../database/database";

export default function EditCardScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const cardId = Number(id);

    const [front, setFront] = useState("");
    const [back, setBack] = useState("");

    useEffect(() => {
        const loadCard = async () => {
            const cards = await getCards();

            const card = cards.find(
                (card) => card.id === cardId
            );

            if (card) {
                setFront(card.front);
                setBack(card.back);
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

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Edit Card</Text>

            <Text style={styles.label}>Front</Text>

            <TextInput
                style={styles.input}
                value={front}
                onChangeText={setFront}
                placeholder="Enter the word or phrase"
                placeholderTextColor="#a89984"
            />

            <Text style={styles.label}>Back</Text>

            <TextInput
                style={styles.input}
                value={back}
                onChangeText={setBack}
                placeholder="Enter the meaning"
                placeholderTextColor="#a89984"
            />

            <Pressable
                style={({ pressed }) => [
                    styles.saveButton,
                    pressed && styles.buttonPressed,
                ]}
                onPress={saveChanges}
            >
                <Text style={styles.saveButtonText}>
                    Save Changes
                </Text>
            </Pressable>

            <Pressable
                style={({ pressed }) => [
                    styles.deleteButton,
                    pressed && styles.buttonPressed,
                ]}
                onPress={removeCard}
            >
                <Text style={styles.deleteButtonText}>
                    Delete Card
                </Text>
            </Pressable>
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
        marginBottom: 30,
    },

    label: {
        color: "#ebdbb2",
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 10,
    },

    input: {
        backgroundColor: "#3c3836",
        color: "#ebdbb2",
        fontSize: 18,
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#504945",
        marginBottom: 20,
    },

    saveButton: {
        backgroundColor: "#d79921",
        padding: 16,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 10,
    },

    saveButtonText: {
        color: "#282828",
        fontSize: 17,
        fontWeight: "bold",
    },

    deleteButton: {
        backgroundColor: "#3c3836",
        borderWidth: 1,
        borderColor: "#cc241d",
        padding: 16,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 15,
    },

    deleteButtonText: {
        color: "#cc241d",
        fontSize: 17,
        fontWeight: "bold",
    },

    buttonPressed: {
        opacity: 0.7,
    },
});