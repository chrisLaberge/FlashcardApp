import { router } from "expo-router";
import { StyleSheet, Text } from "react-native";
import Pressable from "./Pressable";
import { useMemo } from "react";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

export default function NavigationButton({
    deckId,
    variant = "floating",
}: {
    deckId?: string;
    variant?: "floating" | "pill";
}) {
    const t = useTheme();
    const styles = useMemo(() => makeStyles(t), [t]);
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

const makeStyles = (t: Palette) => StyleSheet.create({
    // Original floating style (unchanged)
    button: {
        backgroundColor: t.gold,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 10,
        position: "absolute",
        right: 20,
        bottom: 20,
    },

    text: {
        color: t.bg,
        fontSize: 16,
        fontWeight: "600",
    },

    // Compact pill that matches Undo / Edit card
    pill: {
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: t.gold,
    },

    pillText: {
        color: t.gold,
        fontSize: 14,
        fontWeight: "500",
    },

    buttonPressed: {
        opacity: 0.5,
    },
});