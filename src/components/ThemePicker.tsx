import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme, useThemeControls } from "../theme/ThemeProvider";
import { THEMES, type Palette } from "../theme/themes";

/** Lets the user pick the colour theme. Each option previews its own colours. */
export default function ThemePicker() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const { theme, setThemeId } = useThemeControls();

    return (
        <View style={s.wrap}>
            <Text style={s.heading}>Theme</Text>
            <View style={s.grid}>
                {THEMES.map((option) => {
                    const selected = option.id === theme.id;
                    const c = option.colors;
                    return (
                        <Pressable
                            key={option.id}
                            onPress={() => setThemeId(option.id)}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityLabel={`${option.name} theme`}
                            style={[s.option, { backgroundColor: c.bg, borderColor: selected ? t.yellow : t.surfaceHigh }]}
                        >
                            <View style={[s.preview, { backgroundColor: c.surface }]}>
                                <View style={[s.dot, { backgroundColor: c.green }]} />
                                <View style={[s.dot, { backgroundColor: c.blue }]} />
                                <View style={[s.dot, { backgroundColor: c.yellow }]} />
                            </View>
                            <View style={s.nameRow}>
                                <Text style={[s.name, { color: c.text }]}>{option.name}</Text>
                                {selected ? <Ionicons name="checkmark-circle" size={18} color={c.green} /> : null}
                            </View>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    wrap: { gap: 10 },
    heading: { color: t.text, fontSize: 18, fontWeight: "600" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    option: { width: "48%", borderRadius: 12, borderWidth: 2, padding: 10, gap: 8 },
    preview: { flexDirection: "row", gap: 6, borderRadius: 8, padding: 10 },
    dot: { width: 16, height: 16, borderRadius: 8 },
    nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    name: { fontSize: 15, fontWeight: "600" },
});
