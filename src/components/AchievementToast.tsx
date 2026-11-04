import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { onGoalReached } from "../services/dailyGoal";
import { onAchievementsUnlocked, type UnlockEvent, type UnlockItem } from "../services/achievementUnlocks";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

const SHOW_MS = 3800;
/** More than this at once (e.g. the first time after an update) become one summary. */
const MAX_SEPARATE = 3;

type Message = { id: string; icon: string; title: string; subtitle: string; color: string; xp?: number; to?: "/achievements" };

function messagesFor(event: UnlockEvent): Message[] {
    if (event.items.length > MAX_SEPARATE) {
        return [{ id: event.items.map((i) => i.id).join(","), icon: "🏆", title: `${event.items.length} achievements unlocked`, subtitle: "Tap to see them", color: "#ffc933", xp: event.totalXp, to: "/achievements" }];
    }
    return event.items.map((i: UnlockItem) => ({ id: i.id, icon: i.icon, title: i.title, subtitle: `${i.tierName} unlocked`, color: i.color, xp: i.xp, to: "/achievements" as const }));
}

/** Slides a banner in from the top when an achievement is earned. Tap it to open the achievements. */
export default function AchievementToast() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const insets = useSafeAreaInsets();
    const [queue, setQueue] = useState<Message[]>([]);
    const [slide] = useState(() => new Animated.Value(0));
    const current = queue[0];
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => onAchievementsUnlocked((event) => setQueue((q) => [...q, ...messagesFor(event)])), []);
    useEffect(
        () => onGoalReached(({ goal }) => setQueue((q) => [...q, { id: `goal-${Date.now()}`, icon: "🎯", title: "Daily goal reached!", subtitle: `${goal} cards done today`, color: "#2fbf71" }])),
        [],
    );

    const dismiss = () => {
        if (timer.current) clearTimeout(timer.current);
        Animated.timing(slide, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setQueue((q) => q.slice(1)));
    };

    useEffect(() => {
        if (!current) return;
        Animated.timing(slide, { toValue: 1, duration: 250, useNativeDriver: true }).start();
        timer.current = setTimeout(dismiss, SHOW_MS);
        return () => {
            if (timer.current) clearTimeout(timer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [current?.id]);

    if (!current) return null;

    return (
        <Animated.View
            pointerEvents="box-none"
            style={[s.wrap, { top: insets.top + 8, opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) }] }]}
        >
            <Pressable style={[s.banner, { borderColor: current.color }]} onPress={() => { dismiss(); if (current.to) router.push(current.to); }}>
                <Text style={s.icon}>{current.icon}</Text>
                <View style={{ flex: 1 }}>
                    <Text style={s.title}>{current.title}</Text>
                    <Text style={[s.subtitle, { color: current.color }]}>{current.subtitle}</Text>
                </View>
                {current.xp !== undefined ? <Text style={s.xp}>+{current.xp} XP</Text> : null}
            </Pressable>
        </Animated.View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    wrap: { position: "absolute", left: 12, right: 12, zIndex: 100 },
    banner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.surface, borderWidth: 2, borderRadius: 14, padding: 12, elevation: 8 },
    icon: { fontSize: 28 },
    title: { color: t.text, fontSize: 16, fontWeight: "700" },
    subtitle: { fontSize: 13, fontWeight: "600" },
    xp: { color: t.green, fontSize: 16, fontWeight: "bold" },
});
