import { Linking, Pressable, StyleSheet, Text } from "react-native";

/** Pixabay's API terms require showing where search results come from, with a link. */
export default function PixabayCredit() {
    return (
        <Pressable onPress={() => void Linking.openURL("https://pixabay.com")} accessibilityRole="link">
            <Text style={s.text}>
                Images from <Text style={s.link}>Pixabay</Text>
            </Text>
        </Pressable>
    );
}

const s = StyleSheet.create({
    text: { color: "#a89984", fontSize: 12, textAlign: "center", paddingVertical: 6 },
    link: { color: "#83a598", textDecorationLine: "underline" },
});
