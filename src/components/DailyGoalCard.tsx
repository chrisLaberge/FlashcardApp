import Mark from "./Mark";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DEFAULT_GOAL_SETTINGS, goalFraction } from "../models/DailyGoal";
import { loadGoalSettings, reviewedToday } from "../services/dailyGoal";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

/** A small chip: today's progress towards the daily goal, with a thin bar under it. Hidden when the goal is off. */
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
        <View style={s.chip} accessibilityLabel={`Daily goal: ${state.done} of ${state.goal} cards`}>
            <Text style={s.count}>{state.done}/{state.goal}</Text>{reached ? <Mark kind="check" size={14} color={t.yellow} /> : null}
            <View style={s.track}>
                <View style={[s.fill, { width: `${Math.round(goalFraction(state.done, state.goal) * 100)}%`, backgroundColor: reached ? t.yellow : t.green }]} />
            </View>
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    chip: { backgroundColor: t.surface, borderWidth: 1, borderColor: t.surfaceHigh, borderRadius: 8, paddingHorizontal: 10, paddingTop: 5, paddingBottom: 6, gap: 3 },
    count: { color: t.text, fontSize: 12, fontWeight: "600" },
    track: { height: 3, borderRadius: 2, backgroundColor: t.surfaceHigh, overflow: "hidden" },
    fill: { height: 3, borderRadius: 2 },
});
