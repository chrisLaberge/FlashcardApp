import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import KeyboardInsetView from "./KeyboardInsetView";
import LangBadge from "./LangBadge";
import Pressable from "./Pressable";
import { languages, type Language } from "../constants/languages";
import { addCard, addDeck } from "../database/database";
import { backfillLocalImages } from "../services/localImages";
import { pickAndRestoreBackup } from "../utils/restoreBackup";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

export const ONBOARDED_KEY = "onboarded-v1";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const SLIDES: { icon: IconName; title: string; body: string }[] = [
    { icon: "layers-outline", title: "Study a little each day", body: "Cards come back just before you would forget them. Say it, flip it, and tell the app how it went." },
    { icon: "add-circle-outline", title: "Add words as you meet them", body: "Type a word, or tap one while you read. The meaning, a picture and the sound can come with it." },
    { icon: "document-text-outline", title: "Read real books", body: "Add a PDF in Library. Words you do not know are highlighted, and each page shows how much you already understand." },
    { icon: "trophy-outline", title: "Keep your pet happy", body: "Studying levels up your pet and earns gems for new accessories. A daily streak earns more." },
];

type Props = {
    /** "first" goes on to make a deck and a card; "replay" only shows the slides. */
    mode: "first" | "replay";
    onDone: () => void;
};

/** A short tour, then (the first time) a deck and a first card. Kept to a few big screens. */
export default function Onboarding({ mode, onDone }: Props) {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const [step, setStep] = useState(0); // 0..SLIDES.length-1 slides, then deck, then card
    const [language, setLanguage] = useState<Language | null>(null);
    const [search, setSearch] = useState("");
    const [deckId, setDeckId] = useState<number | null>(null);
    const [word, setWord] = useState("");
    const [meaning, setMeaning] = useState("");
    const [busy, setBusy] = useState(false);

    const deckStep = SLIDES.length;
    const cardStep = SLIDES.length + 1;

    const finish = async () => {
        await AsyncStorage.setItem(ONBOARDED_KEY, "1").catch(() => undefined);
        onDone();
    };

    // For someone moving to a new install: bring the old decks and progress back instead of starting again.
    const restore = async () => {
        if (busy) return;
        setBusy(true);
        try {
            const result = await pickAndRestoreBackup();
            if (!result) return;
            void backfillLocalImages();
            Alert.alert("Backup restored", `${result.decks} deck${result.decks === 1 ? "" : "s"}, ${result.cards} cards and your progress are back.`);
            await finish();
        } catch (error) {
            Alert.alert("Could not restore", error instanceof Error ? error.message : String(error));
        } finally {
            setBusy(false);
        }
    };
    const restoreLink = mode === "first" ? (
        <Pressable onPress={() => void restore()} disabled={busy} accessibilityRole="button">
            <Text style={s.skip}>I have a backup file</Text>
        </Pressable>
    ) : null;

    const lastSlide = () => (mode === "first" ? setStep(deckStep) : void finish());

    const makeDeck = async () => {
        if (!language || busy) return;
        setBusy(true);
        try {
            const id = await addDeck(`${language.name} deck`, language.code);
            await AsyncStorage.setItem("lastDeckId", String(id)).catch(() => undefined);
            setDeckId(id);
            setStep(cardStep);
        } finally {
            setBusy(false);
        }
    };

    const makeCard = async () => {
        if (deckId === null || busy || !word.trim() || !meaning.trim()) return;
        setBusy(true);
        try {
            await addCard(word.trim(), meaning.trim(), "", "", deckId);
            await finish();
        } finally {
            setBusy(false);
        }
    };

    if (step < deckStep) {
        const slide = SLIDES[step];
        return (
            <View style={s.page}>
                <View style={s.top}>
                    <Pressable onPress={() => void finish()} accessibilityRole="button" disabled={mode === "first"} style={mode === "first" ? s.hidden : undefined}>
                        <Text style={s.skip}>Close</Text>
                    </Pressable>
                </View>
                <View style={s.center}>
                    <View style={s.circle}><Ionicons name={slide.icon} size={54} color={t.blue} /></View>
                    <Text style={s.title}>{slide.title}</Text>
                    <Text style={s.body}>{slide.body}</Text>
                </View>
                <View style={s.dots}>
                    {SLIDES.map((_, i) => <View key={i} style={[s.dot, i === step && s.dotOn]} />)}
                </View>
                <Pressable style={({ pressed }) => [s.button, pressed && s.pressed]} onPress={() => (step === deckStep - 1 ? lastSlide() : setStep(step + 1))} accessibilityRole="button">
                    <Text style={s.buttonText}>{step === deckStep - 1 ? (mode === "first" ? "Make my first deck" : "Done") : "Next"}</Text>
                </Pressable>
                {restoreLink}
            </View>
        );
    }

    if (step === deckStep) {
        const q = search.trim().toLowerCase();
        const shown = languages.filter((l) => !q || l.name.toLowerCase().includes(q) || l.nativeName.toLowerCase().includes(q));
        return (
            <KeyboardInsetView style={s.page}>
                <Text style={s.title}>What are you learning?</Text>
                <Text style={s.body}>Pick a language. You can make more decks later.</Text>
                <TextInput style={s.input} placeholder="Search" placeholderTextColor={t.subtle} value={search} onChangeText={setSearch} autoCapitalize="none" />
                <FlatList
                    style={{ flex: 1 }}
                    data={shown}
                    keyExtractor={(l) => l.code}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                        <Pressable style={[s.row, language?.code === item.code && s.rowOn]} onPress={() => setLanguage(item)} accessibilityRole="button">
                            <LangBadge code={item.code} size={26} />
                            <Text style={s.rowText}>{item.name}</Text>
                            <Text style={s.rowSub}>{item.nativeName}</Text>
                        </Pressable>
                    )}
                />
                <Pressable style={({ pressed }) => [s.button, !language && s.disabled, pressed && s.pressed]} onPress={() => void makeDeck()} disabled={!language || busy} accessibilityRole="button">
                    <Text style={s.buttonText}>Continue</Text>
                </Pressable>
                {restoreLink}
            </KeyboardInsetView>
        );
    }

    return (
        <KeyboardInsetView style={s.page}>
            <View style={s.center}>
                <Text style={s.title}>Add your first card</Text>
                <Text style={s.body}>A word you want to remember, and what it means.</Text>
                <TextInput style={s.input} placeholder={`A word in ${language?.name ?? "your language"}`} placeholderTextColor={t.subtle} value={word} onChangeText={setWord} autoCapitalize="none" />
                <TextInput style={s.input} placeholder="What it means" placeholderTextColor={t.subtle} value={meaning} onChangeText={setMeaning} autoCapitalize="none" onSubmitEditing={() => void makeCard()} />
                <Text style={s.tip}>Later, the + button adds cards with a picture, a sound and an example.</Text>
            </View>
            <Pressable style={({ pressed }) => [s.button, (!word.trim() || !meaning.trim()) && s.disabled, pressed && s.pressed]} onPress={() => void makeCard()} disabled={busy || !word.trim() || !meaning.trim()} accessibilityRole="button">
                <Text style={s.buttonText}>Start studying</Text>
            </Pressable>
            <Pressable onPress={() => void finish()} accessibilityRole="button">
                <Text style={s.skip}>Skip for now</Text>
            </Pressable>
        </KeyboardInsetView>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    page: { flex: 1, backgroundColor: t.bg, padding: 24, paddingTop: 56, gap: 14 },
    top: { alignItems: "flex-end" },
    hidden: { opacity: 0 },
    skip: { color: t.muted, fontSize: 14, textAlign: "center", padding: 8 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
    circle: { width: 112, height: 112, borderRadius: 56, backgroundColor: t.surface, alignItems: "center", justifyContent: "center", marginBottom: 10 },
    title: { color: t.text, fontSize: 26, fontWeight: "700", textAlign: "center" },
    body: { color: t.muted, fontSize: 16, lineHeight: 23, textAlign: "center", paddingHorizontal: 8 },
    tip: { color: t.subtle, fontSize: 13, textAlign: "center" },
    dots: { flexDirection: "row", justifyContent: "center", gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.surfaceHigh },
    dotOn: { backgroundColor: t.blue },
    button: { backgroundColor: t.green, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
    buttonText: { color: t.bg, fontSize: 16, fontWeight: "600" },
    disabled: { opacity: 0.4 },
    pressed: { opacity: 0.7 },
    input: { alignSelf: "stretch", backgroundColor: t.surface, color: t.text, borderRadius: 10, padding: 14, fontSize: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: t.surfaceHigh },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10 },
    rowOn: { backgroundColor: t.surface },
    rowText: { color: t.text, fontSize: 16, flex: 1 },
    rowSub: { color: t.subtle, fontSize: 14 },
});
