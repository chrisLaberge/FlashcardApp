import { Linking, Pressable, StyleSheet, Text } from "react-native";
import { useMemo } from "react";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

/** Pixabay's API terms require showing where search results come from, with a link. */
export default function PixabayCredit() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    return (
        <Pressable onPress={() => void Linking.openURL("https://pixabay.com")} accessibilityRole="link">
            <Text style={s.text}>
                Images from <Text style={s.link}>Pixabay</Text>
            </Text>
        </Pressable>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    text: { color: t.muted, fontSize: 12, textAlign: "center", paddingVertical: 6 },
    link: { color: t.blue, textDecorationLine: "underline" },
});
