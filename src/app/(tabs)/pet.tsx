import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import BannerView from "../../components/pet/BannerView";
import CaseSpin from "../../components/pet/CaseSpin";
import PetView from "../../components/pet/PetView";
import KeyboardInsetView from "../../components/KeyboardInsetView";
import { DEFAULT_PET_NAME, isMaxed, PET_NAME_MAX, petStage } from "../../models/Pet";
import { levelProgress } from "../../models/Progression";
import {
    ACCESSORIES, BANNERS, CASE_PRICE, MAX_STREAK_SAVERS_HELD, RARITY_COLOR, STREAK_SAVER_PRICE, type Accessory, type Slot,
} from "../../models/Shop";
import type { CasePlan, ShopState } from "../../models/ShopState";
import {
    buyBanner, buySaver, chooseBanner, EGGS, findEgg, loadShop, openCaseNow, renamePet, syncLook, wear, type EggId,
} from "../../services/shop";
import { useTheme } from "../../theme/ThemeProvider";
import type { Palette } from "../../theme/themes";

const SLOTS: { slot: Slot; title: string }[] = [
    { slot: "hat", title: "Hats" },
    { slot: "glasses", title: "Glasses" },
    { slot: "scarf", title: "Scarves" },
];

const EGG_NOTES: Record<EggId, string> = {
    tap: "Okay, okay. He's dizzy now. Secret found!",
    wait: "Shh. He's not ready yet. Secret found!",
    name: "Oh, you know why he's called that. Secret found!",
    night: "Why are you awake? Secret found!",
};

export default function PetScreen() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const [state, setState] = useState<ShopState | null>(null);
    const [prize, setPrize] = useState<(CasePlan & { ok: true; item: Accessory }) | null>(null);
    const [renaming, setRenaming] = useState(false);
    const [draft, setDraft] = useState("");
    const [note, setNote] = useState<string | null>(null);
    const taps = useRef<number[]>([]);
    const eggTaps = useRef(0);
    const busy = useRef(false);

    const say = useCallback((text: string) => {
        setNote(text);
        setTimeout(() => setNote((current) => (current === text ? null : current)), 4500);
    }, []);

    const found = useCallback(
        async (id: EggId) => {
            const result = await findEgg(id);
            if (!result.isNew) return;
            say(result.foundAll ? `${EGG_NOTES[id]} That's all ${EGGS.length}: you got the golden egg hat!` : EGG_NOTES[id]);
            setState(await loadShop());
        },
        [say],
    );

    const reload = useCallback(async () => {
        const next = await loadShop();
        setState(next);
        return next;
    }, []);

    useFocusEffect(
        useCallback(() => {
            let alive = true;
            reload()
                .then((next) => {
                    if (!alive) return;
                    // Keep friends' view of the pet in step with this phone (quietly).
                    void syncLook(next);
                    const hour = new Date().getHours();
                    if (hour >= 2 && hour < 5) void found("night");
                })
                .catch(() => undefined);
            return () => {
                alive = false;
            };
        }, [reload, found]),
    );

    // Runs a shop action once at a time and refreshes the screen after it.
    const act = async (action: () => Promise<void>) => {
        if (busy.current) return;
        busy.current = true;
        try {
            await action();
        } catch (error) {
            Alert.alert("Something went wrong", error instanceof Error ? error.message : String(error));
        } finally {
            busy.current = false;
            await reload().catch(() => undefined);
        }
    };

    const onPetTap = () => {
        if (!state) return;
        const now = Date.now();
        if (state.petLevel < 10) {
            eggTaps.current += 1;
            if (eggTaps.current >= 7) void found("wait");
            return;
        }
        taps.current = [...taps.current.filter((at) => now - at < 6000), now];
        if (taps.current.length >= 10) {
            taps.current = [];
            void found("tap");
        }
    };

    const openCase = (free: boolean) =>
        act(async () => {
            const plan = await openCaseNow(free);
            if (!plan.ok) return Alert.alert("Can't open it", plan.error);
            if (plan.item) setPrize({ ...plan, ok: true, item: plan.item });
        });

    const buy = (label: string, run: () => Promise<{ ok: boolean; error?: string }>) =>
        act(async () => {
            const plan = await run();
            if (!plan.ok) Alert.alert(label, plan.error ?? "Not now.");
        });

    const submitName = async () => {
        const raw = draft;
        setRenaming(false);
        await act(async () => {
            const name = await renamePet(raw);
            if (name.toLowerCase() === "lil stompa") await found("name");
        });
    };

    if (!state) return <View style={s.container} />;

    const progress = levelProgress(state.xp);
    const stage = petStage(state.petLevel);
    const maxed = isMaxed(state.petLevel);
    const name = state.petName ?? DEFAULT_PET_NAME;
    const hatched = state.petLevel >= 10;

    return (
        <View style={s.container}>
            <ScrollView contentContainerStyle={s.content}>
                {/* pet */}
                <BannerView id={state.banner} style={s.hero}>
                    <View style={s.gems}>
                        <Text style={s.gemsText}>💎 {state.gems}</Text>
                    </View>
                    <View style={s.petWrap}>
                        <PetView level={state.petLevel} look={state.equipped} size={170} onPress={onPetTap} />
                    </View>
                </BannerView>

                <Pressable onPress={() => { setDraft(name); setRenaming(true); }} accessibilityRole="button" accessibilityLabel="Rename your pet">
                    <Text style={s.name}>{name}  ✎</Text>
                </Pressable>
                <Text style={s.stage}>{maxed ? "Golden Pukeko · Level 100 (max)" : `${stage.name} · Level ${state.petLevel}`}</Text>
                {!maxed ? (
                    <View style={s.barWrap}>
                        <View style={s.bar}><View style={[s.barFill, { width: `${Math.round(progress.fraction * 100)}%` }]} /></View>
                        <Text style={s.barText}>{progress.xpIntoLevel} / {progress.xpForNext} XP to level {progress.level + 1}</Text>
                    </View>
                ) : null}
                {note ? <Text style={s.note}>{note}</Text> : null}
                {!hatched ? <Text style={s.hint}>He hatches at level 10. Then he can wear things.</Text> : null}
                <Text style={s.hint}>Gems come from leveling up (5 each) and achievements.</Text>

                {/* cases */}
                <Text style={s.heading}>Accessory case</Text>
                <View style={s.card}>
                    <Text style={s.cardText}>Spin for a hat, glasses or scarf. A free case at every 10 levels.</Text>
                    <View style={s.row}>
                        <Pressable style={[s.button, state.freeCasesLeft === 0 && s.buttonOff]} disabled={state.freeCasesLeft === 0} onPress={() => openCase(true)} accessibilityRole="button">
                            <Text style={s.buttonText}>Free spin ({state.freeCasesLeft})</Text>
                        </Pressable>
                        <Pressable style={[s.button, state.gems < CASE_PRICE && s.buttonOff]} disabled={state.gems < CASE_PRICE} onPress={() => openCase(false)} accessibilityRole="button">
                            <Text style={s.buttonText}>Spin · 💎 {CASE_PRICE}</Text>
                        </Pressable>
                    </View>
                </View>

                {/* wardrobe */}
                <Text style={s.heading}>Wardrobe</Text>
                {SLOTS.map(({ slot, title }) => {
                    const owned = ACCESSORIES.filter((a) => a.slot === slot && state.owned.has(a.id));
                    return (
                        <View key={slot} style={s.card}>
                            <Text style={s.cardTitle}>{title}</Text>
                            {owned.length === 0 ? <Text style={s.muted}>None yet.</Text> : (
                                <View style={s.chips}>
                                    {owned.map((item) => {
                                        const on = state.equipped[slot] === item.id;
                                        return (
                                            <Pressable
                                                key={item.id}
                                                style={[s.chip, { borderColor: RARITY_COLOR[item.rarity] }, on && { backgroundColor: `${RARITY_COLOR[item.rarity]}33` }]}
                                                onPress={() => act(() => wear(slot, on ? null : item.id))}
                                                accessibilityRole="button"
                                                accessibilityState={{ selected: on }}
                                            >
                                                <Text style={s.chipEmoji}>{item.emoji}</Text>
                                                <Text style={s.chipText}>{item.name}</Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    );
                })}

                {/* shop */}
                <Text style={s.heading}>Shop</Text>
                <View style={s.card}>
                    <View style={s.shopRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.cardTitle}>🧊 Streak saver</Text>
                            <Text style={s.muted}>Covers one missed day. Buy it before you miss. You have {state.savers} (up to {MAX_STREAK_SAVERS_HELD}).</Text>
                        </View>
                        <Pressable
                            style={[s.button, (state.gems < STREAK_SAVER_PRICE || state.savers >= MAX_STREAK_SAVERS_HELD) && s.buttonOff]}
                            disabled={state.gems < STREAK_SAVER_PRICE || state.savers >= MAX_STREAK_SAVERS_HELD}
                            onPress={() => buy("Streak saver", buySaver)}
                            accessibilityRole="button"
                        >
                            <Text style={s.buttonText}>💎 {STREAK_SAVER_PRICE}</Text>
                        </Pressable>
                    </View>
                </View>

                <Text style={s.subheading}>Profile banners</Text>
                {BANNERS.map((banner) => {
                    const owned = state.owned.has(banner.id);
                    const using = state.banner === banner.id;
                    return (
                        <View key={banner.id} style={s.bannerRow}>
                            <BannerView id={banner.id} style={s.bannerPreview}>
                                <Text style={s.bannerName}>{banner.name}</Text>
                            </BannerView>
                            <Pressable
                                style={[s.button, s.bannerButton, (using || (!owned && state.gems < banner.price)) && s.buttonOff]}
                                disabled={using || (!owned && state.gems < banner.price)}
                                onPress={() => (owned ? act(() => chooseBanner(banner.id)) : buy(banner.name, () => buyBanner(banner.id)))}
                                accessibilityRole="button"
                            >
                                <Text style={s.buttonText}>{using ? "Using" : owned ? "Use" : `💎 ${banner.price}`}</Text>
                            </Pressable>
                        </View>
                    );
                })}

                <Text style={s.hint}>Secrets found: {state.eggsFound.length} / {EGGS.length}</Text>
            </ScrollView>

            {prize ? (
                <CaseSpin
                    prize={prize.item}
                    duplicate={prize.duplicate === true}
                    refund={prize.refund ?? 0}
                    onClose={() => {
                        setPrize(null);
                        void reload();
                    }}
                />
            ) : null}

            <Modal visible={renaming} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setRenaming(false)}>
                <KeyboardInsetView style={s.modalBackdrop}>
                    <View style={s.modalCard}>
                        <Text style={s.cardTitle}>Name your pet</Text>
                        <TextInput
                            style={s.input}
                            value={draft}
                            onChangeText={setDraft}
                            maxLength={PET_NAME_MAX}
                            autoFocus
                            placeholder={DEFAULT_PET_NAME}
                            placeholderTextColor={t.subtle}
                            onSubmitEditing={submitName}
                            returnKeyType="done"
                        />
                        <View style={s.row}>
                            <Pressable style={[s.button, s.quiet]} onPress={() => setRenaming(false)} accessibilityRole="button"><Text style={s.quietText}>Cancel</Text></Pressable>
                            <Pressable style={s.button} onPress={submitName} accessibilityRole="button"><Text style={s.buttonText}>Save</Text></Pressable>
                        </View>
                    </View>
                </KeyboardInsetView>
            </Modal>
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, paddingBottom: 60, gap: 10 },
    hero: { height: 230, borderRadius: 20, alignItems: "center", justifyContent: "flex-end" },
    petWrap: { marginBottom: 4 },
    gems: { position: "absolute", top: 12, right: 12, backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
    gemsText: { color: "#ffffff", fontWeight: "bold", fontSize: 15 },
    name: { color: t.text, fontSize: 26, fontWeight: "800", textAlign: "center", marginTop: 6 },
    stage: { color: t.muted, fontSize: 14, textAlign: "center", fontWeight: "600" },
    barWrap: { gap: 4, marginTop: 4 },
    bar: { height: 8, borderRadius: 4, backgroundColor: t.surface, overflow: "hidden" },
    barFill: { height: 8, borderRadius: 4, backgroundColor: t.green },
    barText: { color: t.muted, fontSize: 12, textAlign: "center" },
    note: { color: t.blue, textAlign: "center", fontWeight: "600" },
    hint: { color: t.muted, fontSize: 12, textAlign: "center" },
    heading: { color: t.text, fontSize: 18, fontWeight: "700", marginTop: 14 },
    subheading: { color: t.muted, fontSize: 14, fontWeight: "600", marginTop: 8 },
    card: { backgroundColor: t.surface, borderRadius: 14, padding: 14, gap: 10 },
    cardTitle: { color: t.text, fontSize: 16, fontWeight: "700" },
    cardText: { color: t.muted, fontSize: 13 },
    muted: { color: t.muted, fontSize: 13 },
    row: { flexDirection: "row", gap: 10 },
    button: { flex: 1, backgroundColor: t.green, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
    buttonOff: { opacity: 0.4 },
    buttonText: { color: t.bg, fontWeight: "bold", fontSize: 14 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 2, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10 },
    chipEmoji: { fontSize: 18 },
    chipText: { color: t.text, fontSize: 13, fontWeight: "600" },
    shopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    bannerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    bannerPreview: { flex: 1, height: 54, borderRadius: 12, justifyContent: "center", paddingHorizontal: 14 },
    bannerName: { color: "#ffffff", fontWeight: "800", fontSize: 15 },
    bannerButton: { flex: 0, minWidth: 92 },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 24 },
    modalCard: { backgroundColor: t.bg, borderRadius: 18, padding: 18, gap: 14, borderWidth: 1, borderColor: t.surfaceHigh },
    input: { color: t.text, backgroundColor: t.surface, borderRadius: 12, padding: 12, fontSize: 18 },
    quiet: { backgroundColor: t.surface },
    quietText: { color: t.text, fontWeight: "600" },
});
