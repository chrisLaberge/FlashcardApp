/** The daily goal (cards to review per day) and when the reminder notifications should fire. */

export const GOAL_MIN = 5;
export const GOAL_MAX = 200;
export const GOAL_STEP = 5;

export type GoalSettings = {
    /** The whole daily goal (bar and reminders) can be switched off. */
    enabled: boolean;
    /** Cards to review each day. */
    goal: number;
    reminder: boolean;
    /** Reminder time of day, 24-hour clock. */
    hour: number;
    minute: number;
};

export const DEFAULT_GOAL_SETTINGS: GoalSettings = { enabled: true, goal: 20, reminder: false, hour: 19, minute: 0 };

export const clampGoal = (value: number): number => {
    if (!Number.isFinite(value)) return DEFAULT_GOAL_SETTINGS.goal;
    return Math.min(GOAL_MAX, Math.max(GOAL_MIN, Math.round(value)));
};

/** Reads saved settings, ignoring anything that is missing or does not make sense. */
export function parseGoalSettings(raw: string | null): GoalSettings {
    if (!raw) return { ...DEFAULT_GOAL_SETTINGS };
    try {
        const data = JSON.parse(raw) as Record<string, unknown>;
        const whole = (v: unknown, min: number, max: number, fallback: number) =>
            typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : fallback;
        return {
            enabled: data.enabled !== false,
            goal: typeof data.goal === "number" ? clampGoal(data.goal) : DEFAULT_GOAL_SETTINGS.goal,
            reminder: data.reminder === true,
            hour: whole(data.hour, 0, 23, DEFAULT_GOAL_SETTINGS.hour),
            minute: whole(data.minute, 0, 59, DEFAULT_GOAL_SETTINGS.minute),
        };
    } catch {
        return { ...DEFAULT_GOAL_SETTINGS };
    }
}

/** 0 to 1, for a progress bar. */
export const goalFraction = (reviewedToday: number, goal: number): number =>
    goal <= 0 ? 1 : Math.min(1, Math.max(0, reviewedToday / goal));

/**
 * When the next reminders should fire: the reminder time on each of the next `days` days.
 * Today's is left out once the goal is met (or its time has already passed), so someone who has
 * done their cards is not nagged.
 */
export function reminderTimes(now: Date, settings: GoalSettings, reviewedToday: number, days = 7): Date[] {
    if (!settings.enabled || !settings.reminder) return [];
    const times: Date[] = [];
    for (let i = 0; i < days; i++) {
        const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, settings.hour, settings.minute, 0, 0);
        if (at.getTime() <= now.getTime() + 60_000) continue; // already passed (or about to)
        if (i === 0 && reviewedToday >= settings.goal) continue;
        times.push(at);
    }
    return times;
}

export function formatTime(hour: number, minute: number): string {
    const suffix = hour >= 12 ? "PM" : "AM";
    const h = hour % 12 === 0 ? 12 : hour % 12;
    return `${h}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** True the first time today's reviews reach the goal (once per day, and never while the goal is off). */
export function shouldCelebrate(settings: GoalSettings, reviewedToday: number, lastCelebratedDay: string | null, today: string): boolean {
    return settings.enabled && reviewedToday >= settings.goal && lastCelebratedDay !== today;
}
