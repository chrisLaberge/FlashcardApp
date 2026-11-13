import { useState, useMemo } from "react";
import KeyboardInsetView from "@/components/KeyboardInsetView";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import Pressable from "../../components/Pressable";
import { deleteAccount } from "../../services/account";
import { useUser } from "../../hooks/useUser";
import { signOut } from "../../services/auth";
import { authErrorMessage } from "../../utils/authErrors";
import ProgressSection from "../../components/ProgressSection";
import DailyGoalSettings from "../../components/DailyGoalSettings";
import ThemePicker from "../../components/ThemePicker";
import { useTheme } from "../../theme/ThemeProvider";
import type { Palette } from "../../theme/themes";

export default function AccountScreen() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const user = useUser();
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");

    const run = async (action: () => Promise<unknown>) => {
        if (busy) return;
        setBusy(true);
        setMessage("");
        try {
            await action();
        } catch (error) {
            setMessage(authErrorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    const confirmDelete = () =>
        Alert.alert(
            "Delete account?",
            "This permanently deletes your sign-in account, username, friends and uploaded stats from the server. Your decks and progress on this phone are kept.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => void run(deleteAccount) },
            ],
        );

    if (user === undefined) {
        return <View style={[s.container, s.center]}><ActivityIndicator color={t.blue} /></View>;
    }

    return (
        <KeyboardInsetView style={{ flex: 1 }}>
            <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
                <ProgressSection />

                <Text style={s.section}>Account</Text>
                <View style={s.card}>
                    <Text style={s.email}>{user?.email ?? user?.displayName ?? "Your account"}</Text>
                    <Text style={s.hint}>Your decks and progress stay on this phone.</Text>
                    <Pressable style={({ pressed }) => [s.button, s.secondary, pressed && s.pressed]} onPress={() => run(signOut)} disabled={busy}>
                        <Text style={s.secondaryText}>Sign out</Text>
                    </Pressable>
                </View>
                {message ? <Text style={s.error}>{message}</Text> : null}

                <DailyGoalSettings />
                <ThemePicker />
                <Pressable onPress={confirmDelete} disabled={busy}>
                    <Text style={s.danger}>Delete account</Text>
                </Pressable>
            </ScrollView>
        </KeyboardInsetView>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg, padding: 20 },
    scroll: { flex: 1, backgroundColor: t.bg },
    scrollContent: { padding: 20, paddingBottom: 80, gap: 14 },
    content: { gap: 14, alignItems: "stretch" },
    center: { alignItems: "center", justifyContent: "center" },
    title: { color: t.text, fontSize: 24, fontWeight: "600", textAlign: "center", marginTop: 10 },
    heading: { color: t.text, fontSize: 18, fontWeight: "600" },
    email: { color: t.blue, fontSize: 17 },
    muted: { color: t.muted, fontSize: 13, textAlign: "center" },
    section: { color: t.muted, fontSize: 13, fontWeight: "600", marginTop: 10, marginBottom: -4 },
    hint: { color: t.muted, fontSize: 13 },
    card: { backgroundColor: t.surface, borderRadius: 12, padding: 16, gap: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: t.surfaceHigh },
    input: { backgroundColor: t.surface, color: t.text, borderRadius: 10, padding: 14, fontSize: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: t.surfaceHigh },
    button: { borderRadius: 10, paddingVertical: 14, alignItems: "center" },
    primary: { backgroundColor: t.green },
    primaryText: { color: t.bg, fontSize: 16, fontWeight: "600" },
    secondary: { backgroundColor: t.surfaceHigh },
    secondaryText: { color: t.text, fontSize: 16, fontWeight: "600" },
    google: { backgroundColor: t.text },
    googleText: { color: t.bg, fontSize: 16, fontWeight: "600" },
    or: { color: t.subtle, textAlign: "center", fontSize: 13 },
    link: { color: t.blue, textAlign: "center", fontSize: 14, paddingVertical: 4 },
    danger: { color: t.red, textAlign: "center", fontSize: 14, paddingVertical: 12 },
    error: { color: t.red, textAlign: "center", fontSize: 14 },
    pressed: { opacity: 0.7 },
});
