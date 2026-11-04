import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useUser } from "../../hooks/useUser";
import { resetPassword, signInWithEmail, signInWithGoogle, signOut, signUpWithEmail } from "../../services/auth";
import { authErrorMessage, isPlausibleEmail } from "../../utils/authErrors";

export default function AccountScreen() {
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

    if (user === undefined) {
        return <View style={[s.container, s.center]}><ActivityIndicator color="#83a598" /></View>;
    }

    if (user) {
        return (
            <View style={s.container}>
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
            </View>
        );
    }

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
                <Text style={s.title}>{mode === "signIn" ? "Sign in" : "Create account"}</Text>
                <Text style={s.muted}>The app works without an account. Sign in for friends and the leaderboard.</Text>

                <Pressable style={({ pressed }) => [s.button, s.google, pressed && s.pressed]} onPress={() => run(signInWithGoogle)} disabled={busy}>
                    <Text style={s.googleText}>Continue with Google</Text>
                </Pressable>

                <Text style={s.or}>or with email</Text>

                <TextInput
                    style={s.input}
                    placeholder="Email"
                    placeholderTextColor="#7c6f64"
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                />
                <TextInput
                    style={s.input}
                    placeholder="Password"
                    placeholderTextColor="#7c6f64"
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                    value={password}
                    onChangeText={setPassword}
                    onSubmitEditing={submit}
                />

                {message ? <Text style={s.error}>{message}</Text> : null}

                <Pressable style={({ pressed }) => [s.button, s.primary, pressed && s.pressed]} onPress={submit} disabled={busy}>
                    {busy ? <ActivityIndicator color="#282828" /> : <Text style={s.primaryText}>{mode === "signIn" ? "Sign in" : "Create account"}</Text>}
                </Pressable>

                <Pressable onPress={() => { setMode(mode === "signIn" ? "signUp" : "signIn"); setMessage(""); }}>
                    <Text style={s.link}>{mode === "signIn" ? "New here? Create an account" : "Have an account? Sign in"}</Text>
                </Pressable>
                {mode === "signIn" && (
                    <Pressable onPress={forgot}>
                        <Text style={s.link}>Forgot password?</Text>
                    </Pressable>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#282828", padding: 20 },
    content: { gap: 14, alignItems: "stretch" },
    center: { alignItems: "center", justifyContent: "center" },
    title: { color: "#ebdbb2", fontSize: 24, fontWeight: "bold", textAlign: "center", marginTop: 10 },
    heading: { color: "#ebdbb2", fontSize: 18, fontWeight: "600" },
    email: { color: "#83a598", fontSize: 17 },
    muted: { color: "#a89984", fontSize: 13, textAlign: "center" },
    card: { backgroundColor: "#3c3836", borderRadius: 14, padding: 16, gap: 8, marginBottom: 16 },
    input: { backgroundColor: "#3c3836", color: "#ebdbb2", borderRadius: 10, padding: 14, fontSize: 16 },
    button: { borderRadius: 10, paddingVertical: 14, alignItems: "center" },
    primary: { backgroundColor: "#b8bb26" },
    primaryText: { color: "#282828", fontSize: 16, fontWeight: "bold" },
    secondary: { backgroundColor: "#504945" },
    secondaryText: { color: "#ebdbb2", fontSize: 16, fontWeight: "600" },
    google: { backgroundColor: "#ebdbb2" },
    googleText: { color: "#282828", fontSize: 16, fontWeight: "bold" },
    or: { color: "#7c6f64", textAlign: "center", fontSize: 13 },
    link: { color: "#83a598", textAlign: "center", fontSize: 14, paddingVertical: 4 },
    error: { color: "#fb4934", textAlign: "center", fontSize: 14 },
    pressed: { opacity: 0.7 },
});
