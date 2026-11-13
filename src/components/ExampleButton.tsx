import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet } from "react-native";
import Pressable from "./Pressable";
import { ExplainError, explainCard } from "../services/explain";
import { useTheme } from "../theme/ThemeProvider";

type Props = {
    learningText: string;
    localizedText: string;
    languageName: string;
    /** Set when the card already exists, so the full explanation is kept for the info sheet. */
    cardId?: number;
    onExample: (sentence: string) => void;
};

/** A small sparkle button that writes an example sentence for the card. Shown only while the example is empty. */
export default function ExampleButton({ learningText, localizedText, languageName, cardId, onExample }: Props) {
    const t = useTheme();
    const [loading, setLoading] = useState(false);
    const ready = learningText.trim().length > 0 && localizedText.trim().length > 0 && languageName.length > 0;

    const run = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const explanation = await explainCard(
                { id: cardId, learningText: learningText.trim(), localizedText: localizedText.trim(), exampleSentence: "" },
                languageName,
            );
            const sentence = explanation.examples[0]?.text;
            if (sentence) onExample(sentence);
            else Alert.alert("No example", "Couldn't write an example for this card.");
        } catch (error) {
            Alert.alert("No example", error instanceof ExplainError ? error.message : "Something went wrong. Try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Pressable
            onPress={run}
            disabled={!ready || loading}
            hitSlop={8}
            accessibilityLabel="Write an example sentence"
            style={({ pressed }) => [
                s.button,
                { backgroundColor: `${t.yellow}1f`, borderColor: `${t.yellow}59` },
                (pressed || !ready) && s.dim,
            ]}
        >
            {loading ? <ActivityIndicator size="small" color={t.yellow} /> : <Ionicons name="sparkles" size={18} color={t.yellow} />}
        </Pressable>
    );
}

const s = StyleSheet.create({
    button: {
        position: "absolute",
        right: 10,
        top: 9,
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
    },
    dim: { opacity: 0.45 },
});
