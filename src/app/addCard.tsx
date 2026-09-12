import { useState } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { Card } from "../models/Card";
import { deck } from "../models/DeckManager";

export default function AddCardScreen() {
    const [front, setFront] = useState("");
    const [back, setBack] = useState("");

    const addCard = () => {
        const card = new Card(front, back);
        deck.addToBack(card);

        setFront("");
        setBack("");
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Add Card</Text>
            <Text style={styles.subtitle}>Create a new flashcard</Text>

            <View style={styles.form}>
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
                        styles.button,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={addCard}
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
        paddingTop: 60,
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
});