import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Switch, Text, View } from "react-native";
import Pressable from "./Pressable";
import { clampGoal, DEFAULT_GOAL_SETTINGS, formatTime, GOAL_STEP, type GoalSettings } from "../models/DailyGoal";
import { loadGoalSettings, requestReminderPermission, saveGoalSettings } from "../services/dailyGoal";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

/** Account settings: how many cards a day, and an optional reminder. */
export default function DailyGoalSettings() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const [settings, setSettings] = useState<GoalSettings>(DEFAULT_GOAL_SETTINGS);

    useEffect(() => {
        void loadGoalSettings().then(setSettings);
    }, []);

    const update = (patch: Partial<GoalSettings>) => {
        const next = { ...settings, ...patch };
        setSettings(next);
        void saveGoalSettings(next);
    };

    const toggleReminder = async (on: boolean) => {
        if (!on) return update({ reminder: false });
        if (await requestReminderPermission()) return update({ reminder: true });
        Alert.alert("Notifications are off", "Allow notifications for StompaCard in your phone's settings to get reminders.");
    };

    const shiftTime = (minutes: number) => {
        const total = (settings.hour * 60 + settings.minute + minutes + 24 * 60) % (24 * 60);
        update({ hour: Math.floor(total / 60), minute: total % 60 });
    };

    return (
        <View style={s.wrap}>
            <View style={s.card}>
                <View style={s.row}>
                    <Text style={s.label}>Daily goal</Text>
                    <Switch value={settings.enabled} onValueChange={(enabled) => update({ enabled })} trackColor={{ true: t.green, false: t.surfaceHigh }} />
                </View>

                {settings.enabled ? (
                <>
                <View style={s.row}>
                    <Text style={s.label}>Cards per day</Text>
                    <View style={s.stepper}>
                        <Pressable style={s.step} onPress={() => update({ goal: clampGoal(settings.goal - GOAL_STEP) })} accessibilityLabel="Lower goal"><Text style={s.stepText}>−</Text></Pressable>
                        <Text style={s.value}>{settings.goal}</Text>
                        <Pressable style={s.step} onPress={() => update({ goal: clampGoal(settings.goal + GOAL_STEP) })} accessibilityLabel="Raise goal"><Text style={s.stepText}>+</Text></Pressable>
                    </View>
                </View>

                <View style={s.row}>
                    <Text style={s.label}>Remind me</Text>
                    <Switch value={settings.reminder} onValueChange={toggleReminder} trackColor={{ true: t.green, false: t.surfaceHigh }} />
                </View>

                {settings.reminder ? (
                    <View style={s.row}>
                        <Text style={s.label}>Reminder time</Text>
                        <View style={s.stepper}>
                            <Pressable style={s.step} onPress={() => shiftTime(-30)} accessibilityLabel="Earlier"><Text style={s.stepText}>−</Text></Pressable>
                            <Text style={s.time}>{formatTime(settings.hour, settings.minute)}</Text>
                            <Pressable style={s.step} onPress={() => shiftTime(30)} accessibilityLabel="Later"><Text style={s.stepText}>+</Text></Pressable>
                        </View>
                    </View>
                ) : null}
                </>
                ) : null}
            </View>
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    wrap: { gap: 10 },
    heading: { color: t.text, fontSize: 18, fontWeight: "600" },
    card: { backgroundColor: t.surface, borderRadius: 12, padding: 14, gap: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: t.surfaceHigh },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    label: { color: t.text, fontSize: 15 },
    stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
    step: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.surfaceHigh, alignItems: "center", justifyContent: "center" },
    stepText: { color: t.text, fontSize: 20, lineHeight: 22 },
    value: { color: t.text, fontSize: 18, fontWeight: "600", minWidth: 36, textAlign: "center" },
    time: { color: t.text, fontSize: 16, fontWeight: "600", minWidth: 80, textAlign: "center" },
});
