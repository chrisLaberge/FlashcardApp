import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import Pressable from "./Pressable";
import { onLevelUp } from "../services/levelUp";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

/** Shown in the middle of the screen when the player reaches a new level; the free spin is waiting in the pet tab. */
export default function LevelUpPopup() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const [level, setLevel] = useState<number | null>(null);

    useEffect(() => onLevelUp(setLevel), []);

    const close = () => setLevel(null);
    return (
        <Modal visible={level !== null} transparent animationType="fade" onRequestClose={close}>
            <View style={s.backdrop}>
                <View style={s.card}>
                    <Text style={s.small}>New level</Text>
                    <Text style={s.level}>{level}</Text>
                    <Text style={s.text}>You earned a free spin.</Text>
                    <Pressable style={s.primary} onPress={() => { close(); router.push("/pet"); }} accessibilityRole="button">
                        <Text style={s.primaryText}>Spin now</Text>
                    </Pressable>
                    <Pressable style={s.later} onPress={close} accessibilityRole="button">
                        <Text style={s.laterText}>Later</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 24 },
    card: { width: "100%", maxWidth: 320, backgroundColor: t.surface, borderRadius: 20, padding: 24, alignItems: "center", gap: 6 },
    small: { color: t.muted, fontSize: 14, fontWeight: "600" },
    level: { color: t.blue, fontSize: 64, fontWeight: "700", lineHeight: 72 },
    text: { color: t.text, fontSize: 16, marginBottom: 14 },
    primary: { alignSelf: "stretch", backgroundColor: t.blue, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
    primaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    later: { alignSelf: "stretch", paddingVertical: 12, alignItems: "center" },
    laterText: { color: t.muted, fontSize: 15, fontWeight: "600" },
});
