import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

/** A language shown as its short code ("ZH", "ES") on a small rounded tile. Plain, and the same on every phone. */
export default function LangBadge({ code, size = 28 }: { code?: string | null; size?: number }) {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    return (
        <View style={[s.tile, { height: size * 0.8, minWidth: size * 1.15, borderRadius: size * 0.22 }]}>
            <Text style={[s.text, { fontSize: size * 0.4 }]} numberOfLines={1}>{(code ?? "--").toUpperCase()}</Text>
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    tile: { backgroundColor: t.surfaceHigh, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
    text: { color: t.text, fontWeight: "700", letterSpacing: 0.5 },
});
