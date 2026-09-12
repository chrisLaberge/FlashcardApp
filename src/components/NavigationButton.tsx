import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

export default function NavigationButton() {
    return (
        <Pressable
            style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push("/addCard")}
        >
            <Text style={styles.text}>+ Add Card</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
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

    buttonPressed: {
        opacity: 0.7,
    },
});