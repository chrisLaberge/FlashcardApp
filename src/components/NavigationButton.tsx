import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

export default function NavigationButton({
    deckId,
    variant = "floating",
}: {
    deckId?: string;
    variant?: "floating" | "pill";
}) {
    const isPill = variant === "pill";

    return (
        <Pressable
            style={({ pressed }) => [
                isPill ? styles.pill : styles.button,
                pressed && styles.buttonPressed,
            ]}
            hitSlop={8}
            onPress={() => {
                router.push({
                    pathname: "/addCard",
                    params: {
                        deckId: String(deckId),
                    },
                });
            }}
        >
            <Text style={isPill ? styles.pillText : styles.text}>
                {isPill ? "+ Add" : "+ Add Card"}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    // Original floating style (unchanged)
    button: {
        backgroundColor: "#d79921",
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 10,
        position: "absolute",
        right: 20,
        bottom: 20,
    },

    text: {
        color: "#282828",
        fontSize: 16,
        fontWeight: "bold",
    },

    // Compact pill that matches Undo / Edit card
    pill: {
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#d79921",
    },

    pillText: {
        color: "#d79921",
        fontSize: 14,
        fontWeight: "500",
    },

    buttonPressed: {
        opacity: 0.5,
    },
});