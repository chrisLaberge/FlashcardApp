import { useState, useMemo } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { deleteAccount } from "../../services/account";
import { useUser } from "../../hooks/useUser";
import { resetPassword, signInWithEmail, signInWithGoogle, signOut, signUpWithEmail } from "../../services/auth";
import { authErrorMessage, isPlausibleEmail } from "../../utils/authErrors";
import DailyGoalSettings from "../../components/DailyGoalSettings";
import ThemePicker from "../../components/ThemePicker";
import { useTheme } from "../../theme/ThemeProvider";
import type { Palette } from "../../theme/themes";

export default function AccountScreen() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const user = useUser();
    const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
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

    const submit = () => {
        if (!isPlausibleEmail(email)) return setMessage(authErrorMessage({ code: "auth/invalid-email" }));
        if (password.length < 6) return setMessage(authErrorMessage({ code: "auth/weak-password" }));
        void run(() => (mode === "signUp" ? signUpWithEmail(email, password) : signInWithEmail(email, password)));
    };

    const forgot = () => {
        if (!isPlausibleEmail(email)) return setMessage("Type your email above first, then tap this again.");
        void run(async () => {
            await resetPassword(email);
            Alert.alert("Check your email", "If an account exists for that address, a reset link is on its way.");
        });
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

    if (user) {
        return (
            <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
                <View style={s.card}>
                    <Text style={s.heading}>Signed in</Text>
                    <Text style={s.email}>{user.email ?? user.displayName ?? "Your account"}</Text>
                    <Text style={s.muted}>
                        Your decks and progress stay on this phone. Signing in will be used for friends and the leaderboard.
                    </Text>
                </View>
                <Pressable style={({ pressed }) => [s.button, s.secondary, pressed && s.pressed]} onPress={() => run(signOut)} disabled={busy}>
                    <Text style={s.secondaryText}>Sign out</Text>
                </Pressable>
                {message ? <Text style={s.error}>{message}</Text> : null}
                <DailyGoalSettings />
                <ThemePicker />
                <Pressable onPress={confirmDelete} disabled={busy}>
                    <Text style={s.danger}>Delete account</Text>
                </Pressable>
            </ScrollView>
        );
    }

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
                <Text style={s.title}>{mode === "signIn" ? "Sign in" : "Create account"}</Text>
                <Text style={s.muted}>The app works without an account. Sign in for friends and the leaderboard.</Text>

                <Pressable style={({ pressed }) => [s.button, s.google, pressed && s.pressed]} onPress={() => run(signInWithGoogle)} disabled={busy}>
                    <Text style={s.googleText}>Continue with Google</Text>
                </Pressable>

                <Text style={s.or}>or with email</Text>

                <TextInput
                    style={s.input}
                    placeholder="Email"
                    placeholderTextColor={t.subtle}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                />
                <TextInput
                    style={s.input}
                    placeholder="Password"
                    placeholderTextColor={t.subtle}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                    value={password}
                    onChangeText={setPassword}
                    onSubmitEditing={submit}
                />

                {message ? <Text style={s.error}>{message}</Text> : null}

                <Pressable style={({ pressed }) => [s.button, s.primary, pressed && s.pressed]} onPress={submit} disabled={busy}>
                    {busy ? <ActivityIndicator color={t.bg} /> : <Text style={s.primaryText}>{mode === "signIn" ? "Sign in" : "Create account"}</Text>}
                </Pressable>

                <Pressable onPress={() => { setMode(mode === "signIn" ? "signUp" : "signIn"); setMessage(""); }}>
                    <Text style={s.link}>{mode === "signIn" ? "New here? Create an account" : "Have an account? Sign in"}</Text>
                </Pressable>
                {mode === "signIn" && (
                    <Pressable onPress={forgot}>
                        <Text style={s.link}>Forgot password?</Text>
                    </Pressable>
                )}
                <DailyGoalSettings />
                <ThemePicker />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg, padding: 20 },
    scroll: { flex: 1, backgroundColor: t.bg },
    scrollContent: { padding: 20, paddingBottom: 80, gap: 14 },
    content: { gap: 14, alignItems: "stretch" },
    center: { alignItems: "center", justifyContent: "center" },
    title: { color: t.text, fontSize: 24, fontWeight: "bold", textAlign: "center", marginTop: 10 },
    heading: { color: t.text, fontSize: 18, fontWeight: "600" },
    email: { color: t.blue, fontSize: 17 },
    muted: { color: t.muted, fontSize: 13, textAlign: "center" },
    card: { backgroundColor: t.surface, borderRadius: 14, padding: 16, gap: 8, marginBottom: 16 },
    input: { backgroundColor: t.surface, color: t.text, borderRadius: 10, padding: 14, fontSize: 16 },
    button: { borderRadius: 10, paddingVertical: 14, alignItems: "center" },
    primary: { backgroundColor: t.green },
    primaryText: { color: t.bg, fontSize: 16, fontWeight: "bold" },
    secondary: { backgroundColor: t.surfaceHigh },
    secondaryText: { color: t.text, fontSize: 16, fontWeight: "600" },
    google: { backgroundColor: t.text },
    googleText: { color: t.bg, fontSize: 16, fontWeight: "bold" },
    or: { color: t.subtle, textAlign: "center", fontSize: 13 },
    link: { color: t.blue, textAlign: "center", fontSize: 14, paddingVertical: 4 },
    danger: { color: t.red, textAlign: "center", fontSize: 14, paddingVertical: 12 },
    error: { color: t.red, textAlign: "center", fontSize: 14 },
    pressed: { opacity: 0.7 },
});
