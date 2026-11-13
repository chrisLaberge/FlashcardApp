import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import KeyboardInsetView from "./KeyboardInsetView";
import Pressable from "./Pressable";
import { resetPassword, signInWithEmail, signInWithGoogle, signUpWithEmail } from "../services/auth";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";
import { authErrorMessage, isPlausibleEmail } from "../utils/authErrors";

/** The first thing a signed-out person sees. There is no way past it without an account. */
export default function SignInScreen() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
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

    return (
        <KeyboardInsetView style={{ flex: 1, backgroundColor: t.bg }}>
            <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
                <Text style={s.title}>StompaCard</Text>
                <Text style={s.sub}>{mode === "signIn" ? "Sign in to keep going." : "Make an account to start."}</Text>

                <Pressable style={({ pressed }) => [s.button, s.google, pressed && s.pressed]} onPress={() => run(signInWithGoogle)} disabled={busy} accessibilityRole="button">
                    <Text style={s.googleText}>Continue with Google</Text>
                </Pressable>
                <Text style={s.or}>or with email</Text>
                <TextInput style={s.input} placeholder="Email" placeholderTextColor={t.subtle} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
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
                <Pressable style={({ pressed }) => [s.button, s.primary, pressed && s.pressed]} onPress={submit} disabled={busy} accessibilityRole="button">
                    {busy ? <ActivityIndicator color={t.bg} /> : <Text style={s.primaryText}>{mode === "signIn" ? "Sign in" : "Create account"}</Text>}
                </Pressable>
                {message ? <Text style={s.error}>{message}</Text> : null}
                <Pressable onPress={() => { setMode(mode === "signIn" ? "signUp" : "signIn"); setMessage(""); }}>
                    <Text style={s.link}>{mode === "signIn" ? "New here? Create an account" : "Have an account? Sign in"}</Text>
                </Pressable>
                {mode === "signIn" && (
                    <Pressable onPress={forgot}>
                        <Text style={s.link}>Forgot password?</Text>
                    </Pressable>
                )}
            </ScrollView>
        </KeyboardInsetView>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    content: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 12 },
    title: { color: t.text, fontSize: 32, fontWeight: "700", textAlign: "center" },
    sub: { color: t.muted, fontSize: 15, textAlign: "center", marginBottom: 16 },
    input: { backgroundColor: t.surface, color: t.text, borderRadius: 10, padding: 14, fontSize: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: t.surfaceHigh },
    button: { borderRadius: 10, paddingVertical: 14, alignItems: "center" },
    primary: { backgroundColor: t.green },
    primaryText: { color: t.bg, fontSize: 16, fontWeight: "600" },
    google: { backgroundColor: t.text },
    googleText: { color: t.bg, fontSize: 16, fontWeight: "600" },
    or: { color: t.subtle, textAlign: "center", fontSize: 13 },
    link: { color: t.blue, textAlign: "center", fontSize: 14, paddingVertical: 4 },
    error: { color: t.red, textAlign: "center", fontSize: 14 },
    pressed: { opacity: 0.7 },
});
