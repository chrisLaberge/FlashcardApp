import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import Pressable from "./Pressable";
import { useTheme, useThemeControls } from "../theme/ThemeProvider";
import { THEMES, type Palette } from "../theme/themes";

/** A dropdown for the colour theme. The list previews each theme's own colours. */
export default function ThemePicker() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const { theme, setThemeId } = useThemeControls();
    const [open, setOpen] = useState(false);

    const dots = (c: Palette) => (
        <View style={s.dots}>
            {[c.green, c.blue, c.yellow].map((color, i) => <View key={i} style={[s.dot, { backgroundColor: color }]} />)}
        </View>
    );

    return (
        <View style={s.wrap}>
            <Text style={s.heading}>Theme</Text>
            <Pressable style={({ pressed }) => [s.button, pressed && { opacity: 0.7 }]} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Theme: ${theme.name}. Change theme`}>
                {dots(theme.colors)}
                <Text style={s.buttonText}>{theme.name}</Text>
                <Text style={s.arrow}>▼</Text>
            </Pressable>

            <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
                <Pressable style={s.backdrop} dim={false} onPress={() => setOpen(false)}>
                    <View style={s.menu}>
                        {THEMES.map((option) => {
                            const selected = option.id === theme.id;
                            return (
                                <Pressable
                                    key={option.id}
                                    style={[s.row, { backgroundColor: option.colors.bg }, selected && { borderColor: t.yellow }]}
                                    onPress={() => { setThemeId(option.id); setOpen(false); }}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected }}
                                    accessibilityLabel={`${option.name} theme`}
                                >
                                    {dots(option.colors)}
                                    <Text style={[s.name, { color: option.colors.text }]}>{option.name}</Text>
                                    {selected ? <Ionicons name="checkmark-circle" size={20} color={option.colors.green} /> : null}
                                </Pressable>
                            );
                        })}
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    wrap: { gap: 10 },
    heading: { color: t.text, fontSize: 18, fontWeight: "600" },
    button: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: t.surface, borderWidth: 1, borderColor: t.surfaceHigh, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14 },
    buttonText: { flex: 1, color: t.text, fontSize: 16, fontWeight: "600" },
    arrow: { color: t.muted, fontSize: 10 },
    dots: { flexDirection: "row", gap: 4 },
    dot: { width: 14, height: 14, borderRadius: 7 },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 28 },
    menu: { backgroundColor: t.surface, borderRadius: 12, padding: 8, gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: t.surfaceHigh },
    row: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 10, borderWidth: 2, borderColor: "transparent", paddingVertical: 12, paddingHorizontal: 14 },
    name: { flex: 1, fontSize: 16, fontWeight: "600" },
});
