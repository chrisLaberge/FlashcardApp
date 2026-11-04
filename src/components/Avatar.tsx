import { StyleSheet, Text, View } from "react-native";
import { avatarFor, nameHash } from "../constants/avatars";
import { useTheme } from "../theme/ThemeProvider";

/** A round profile picture: the chosen animal on a soft colour taken from the theme. */
export default function Avatar({ avatar, name, size = 40 }: { avatar?: string | null; name: string; size?: number }) {
    const t = useTheme();
    const tints = [t.green, t.blue, t.yellow, t.orange, t.aqua, t.red];
    const tint = tints[nameHash(name) % tints.length];
    return (
        <View style={[s.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: `${tint}40`, borderColor: tint }]}>
            <Text style={{ fontSize: size * 0.5 }}>{avatarFor(avatar, name)}</Text>
        </View>
    );
}

const s = StyleSheet.create({
    circle: { alignItems: "center", justifyContent: "center", borderWidth: 2 },
});
