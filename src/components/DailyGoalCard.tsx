import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DEFAULT_GOAL_SETTINGS, goalFraction } from "../models/DailyGoal";
import { loadGoalSettings, reviewedToday } from "../services/dailyGoal";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

/** Today's progress towards the daily goal, on the Study screen. */
export default function DailyGoalCard() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const [state, setState] = useState({ done: 0, goal: DEFAULT_GOAL_SETTINGS.goal });

    useFocusEffect(
        useCallback(() => {
            let active = true;
            Promise.all([loadGoalSettings(), reviewedToday()]).then(([settings, done]) => {
                if (active) setState({ done, goal: settings.goal });
            });
            return () => {
                active = false;
            };
        }, []),
    );

    const reached = state.done >= state.goal;
    return (
        <View style={s.card}>
            <View style={s.top}>
                <Text style={s.title}>{reached ? "Daily goal reached 🎉" : "Daily goal"}</Text>
                <Text style={s.count}>{state.done} / {state.goal}</Text>
            </View>
            <View style={s.track}>
                <View style={[s.fill, { width: `${Math.round(goalFraction(state.done, state.goal) * 100)}%`, backgroundColor: reached ? t.yellow : t.green }]} />
            </View>
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    card: { backgroundColor: t.surface, borderRadius: 12, padding: 14, gap: 8, marginTop: 16 },
    top: { flexDirection: "row", justifyContent: "space-between" },
    title: { color: t.text, fontSize: 15, fontWeight: "600" },
    count: { color: t.muted, fontSize: 15 },
    track: { height: 8, borderRadius: 4, backgroundColor: t.bg, overflow: "hidden" },
    fill: { height: 8, borderRadius: 4 },
});
