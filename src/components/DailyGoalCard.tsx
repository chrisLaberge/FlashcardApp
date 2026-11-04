import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DEFAULT_GOAL_SETTINGS, goalFraction } from "../models/DailyGoal";
import { loadGoalSettings, reviewedToday } from "../services/dailyGoal";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

/** A slim line at the top of the Study screen: today's progress towards the daily goal. Hidden when the goal is off. */
export default function DailyGoalCard() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const [state, setState] = useState({ done: 0, goal: DEFAULT_GOAL_SETTINGS.goal, enabled: DEFAULT_GOAL_SETTINGS.enabled });

    useFocusEffect(
        useCallback(() => {
            let active = true;
            Promise.all([loadGoalSettings(), reviewedToday()]).then(([settings, done]) => {
                if (active) setState({ done, goal: settings.goal, enabled: settings.enabled });
            });
            return () => {
                active = false;
            };
        }, []),
    );

    if (!state.enabled) return null;

    const reached = state.done >= state.goal;
    return (
        <View style={s.row} accessibilityLabel={`Daily goal: ${state.done} of ${state.goal} cards`}>
            <View style={s.track}>
                <View style={[s.fill, { width: `${Math.round(goalFraction(state.done, state.goal) * 100)}%`, backgroundColor: reached ? t.yellow : t.green }]} />
            </View>
            <Text style={s.count}>{reached ? "🎉 " : ""}{state.done}/{state.goal}</Text>
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
    track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: t.surfaceHigh, overflow: "hidden" },
    fill: { height: 4, borderRadius: 2 },
    count: { color: t.muted, fontSize: 12 },
});
