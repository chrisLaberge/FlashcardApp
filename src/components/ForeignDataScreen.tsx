import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import Pressable from "./Pressable";
import { signOut } from "../services/auth";
import { eraseLocalData } from "../services/localData";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

/** Shown when a different account signs in on a phone that still holds someone else's cards. */
export default function ForeignDataScreen({ uid, onErased }: { uid: string; onErased: () => void }) {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const [busy, setBusy] = useState(false);

    const erase = () =>
        Alert.alert(
            "Erase the cards on this phone?",
            "The decks, progress, pet and books stored here will be deleted for good. If they matter, sign out and sign back in to the account they belong to, then export a backup first.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Erase",
                    style: "destructive",
                    onPress: () => void (async () => {
                        setBusy(true);
                        try {
                            await eraseLocalData();
                            await AsyncStorage.setItem("data-owner-uid", uid);
                            onErased();
                        } catch (error) {
                            Alert.alert("Could not erase", error instanceof Error ? error.message : String(error));
                        } finally {
                            setBusy(false);
                        }
                    })(),
                },
            ],
        );

    return (
        <View style={s.page}>
            <Text style={s.title}>These cards belong to another account</Text>
            <Text style={s.body}>This phone has decks and progress from a different account. They are not shown here, so they cannot get mixed with this account.</Text>
            <Pressable style={({ pressed }) => [s.button, s.primary, pressed && s.pressed]} onPress={() => void signOut()} disabled={busy} accessibilityRole="button">
                <Text style={s.primaryText}>Sign out and use the other account</Text>
            </Pressable>
            <Pressable onPress={erase} disabled={busy} accessibilityRole="button">
                <Text style={s.danger}>Erase them and start fresh</Text>
            </Pressable>
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    page: { flex: 1, backgroundColor: t.bg, padding: 24, justifyContent: "center", gap: 16 },
    title: { color: t.text, fontSize: 24, fontWeight: "700", textAlign: "center" },
    body: { color: t.muted, fontSize: 16, lineHeight: 23, textAlign: "center" },
    button: { borderRadius: 12, paddingVertical: 15, alignItems: "center" },
    primary: { backgroundColor: t.green },
    primaryText: { color: t.bg, fontSize: 16, fontWeight: "600" },
    danger: { color: t.red, fontSize: 15, textAlign: "center", padding: 8 },
    pressed: { opacity: 0.7 },
});
