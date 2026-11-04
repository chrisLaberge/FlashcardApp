import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";
import { getReviewLog } from "../database/database";
import { DEFAULT_GOAL_SETTINGS, parseGoalSettings, reminderTimes, shouldCelebrate, type GoalSettings } from "../models/DailyGoal";
import { localDay } from "../models/Stats";

const KEY = "daily-goal";
const CHANNEL = "study-reminders";

export async function loadGoalSettings(): Promise<GoalSettings> {
    try {
        return parseGoalSettings(await AsyncStorage.getItem(KEY));
    } catch {
        return { ...DEFAULT_GOAL_SETTINGS };
    }
}

export async function saveGoalSettings(settings: GoalSettings): Promise<void> {
    try {
        await AsyncStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
        // not saved; the screen still shows what was chosen until it closes
    }
    void refreshReminders();
}

/** How many cards were reviewed since midnight on this phone. */
export async function reviewedToday(now = new Date()): Promise<number> {
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return (await getReviewLog(midnight)).length;
}

/** Asks Android/iOS for permission to show notifications. Resolves to whether it was given. */
export async function requestReminderPermission(): Promise<boolean> {
    try {
        const current = await Notifications.getPermissionsAsync();
        if (current.granted) return true;
        return (await Notifications.requestPermissionsAsync()).granted;
    } catch {
        return false;
    }
}

/**
 * Makes the scheduled reminders match the settings: the next seven evenings, minus today's if the
 * goal is already met. Cheap to call again whenever something changes.
 */
export async function refreshReminders(): Promise<void> {
    try {
        await Notifications.cancelAllScheduledNotificationsAsync();
        const settings = await loadGoalSettings();
        if (!settings.enabled || !settings.reminder) return;
        if (!(await Notifications.getPermissionsAsync()).granted) return;

        if (Platform.OS === "android") {
            await Notifications.setNotificationChannelAsync(CHANNEL, {
                name: "Study reminders",
                importance: AndroidImportance.DEFAULT,
            });
        }
        const times = reminderTimes(new Date(), settings, await reviewedToday());
        for (const date of times) {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "Time to practice",
                    body: `Your goal today is ${settings.goal} cards. A few minutes keeps your streak going.`,
                },
                trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL },
            });
        }
    } catch (error) {
        // Expo Go cannot create notification channels; real builds can. Reminders just stay off there.
        console.log("Could not schedule reminders:", error);
    }
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Refreshes shortly after the last call, so answering many cards triggers one refresh. */
export function scheduleReminderRefresh(delayMs = 3000): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
        timer = undefined;
        void refreshReminders();
    }, delayMs);
}

/* ------------------------- "goal reached" banner ------------------------- */

const CELEBRATED_KEY = "daily-goal-celebrated";
type GoalListener = (event: { goal: number }) => void;
const goalListeners = new Set<GoalListener>();

/** Calls `listener` when today's goal is reached. Returns the way to stop listening. */
export function onGoalReached(listener: GoalListener): () => void {
    goalListeners.add(listener);
    return () => {
        goalListeners.delete(listener);
    };
}

let celebrating = false;

/** Tells the listeners (once per day) if today's reviews have reached the goal. */
export async function checkGoalReached(): Promise<void> {
    if (celebrating) return;
    celebrating = true;
    try {
        const settings = await loadGoalSettings();
        if (!settings.enabled) return;
        const today = localDay(Date.now());
        const last = await AsyncStorage.getItem(CELEBRATED_KEY).catch(() => null);
        if (!shouldCelebrate(settings, await reviewedToday(), last, today)) return;
        await AsyncStorage.setItem(CELEBRATED_KEY, today).catch(() => undefined);
        goalListeners.forEach((listener) => listener({ goal: settings.goal }));
    } finally {
        celebrating = false;
    }
}

let goalTimer: ReturnType<typeof setTimeout> | undefined;

/** Checks shortly after the last answer. */
export function scheduleGoalCheck(delayMs = 900): void {
    if (goalTimer) clearTimeout(goalTimer);
    goalTimer = setTimeout(() => {
        goalTimer = undefined;
        void checkGoalReached();
    }, delayMs);
}
