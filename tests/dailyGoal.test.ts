import { clampGoal, DEFAULT_GOAL_SETTINGS, formatTime, goalFraction, parseGoalSettings, reminderTimes } from "../src/models/DailyGoal";

const on = { goal: 20, reminder: true, hour: 19, minute: 30 };
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m);

describe("daily goal settings", () => {
    test("defaults when nothing is saved or the data is broken", () => {
        expect(parseGoalSettings(null)).toEqual(DEFAULT_GOAL_SETTINGS);
        expect(parseGoalSettings("{nope")).toEqual(DEFAULT_GOAL_SETTINGS);
    });

    test("keeps good values and fixes bad ones one by one", () => {
        expect(parseGoalSettings(JSON.stringify(on))).toEqual(on);
        expect(parseGoalSettings(JSON.stringify({ goal: 5000, reminder: "yes", hour: 25, minute: -1 }))).toEqual({
            goal: 200, reminder: false, hour: 19, minute: 0,
        });
    });

    test("the goal stays between 5 and 200", () => {
        expect(clampGoal(0)).toBe(5);
        expect(clampGoal(12.4)).toBe(12);
        expect(clampGoal(999)).toBe(200);
        expect(clampGoal(Number.NaN)).toBe(20);
    });

    test("progress fraction", () => {
        expect(goalFraction(10, 20)).toBe(0.5);
        expect(goalFraction(50, 20)).toBe(1);
        expect(goalFraction(-3, 20)).toBe(0);
    });

    test("12-hour clock labels", () => {
        expect(formatTime(0, 5)).toBe("12:05 AM");
        expect(formatTime(12, 0)).toBe("12:00 PM");
        expect(formatTime(19, 30)).toBe("7:30 PM");
    });
});

describe("reminderTimes", () => {
    test("nothing when reminders are off", () => {
        expect(reminderTimes(at(4, 9), { ...on, reminder: false }, 0)).toEqual([]);
    });

    test("the next 7 evenings, starting today when the time is still ahead", () => {
        const times = reminderTimes(at(4, 9), on, 0);
        expect(times).toHaveLength(7);
        expect(times[0]).toEqual(at(4, 19, 30));
        expect(times[6]).toEqual(at(10, 19, 30));
    });

    test("today is skipped once the time has passed", () => {
        const times = reminderTimes(at(4, 21), on, 0);
        expect(times[0]).toEqual(at(5, 19, 30));
        expect(times).toHaveLength(6);
    });

    test("today is skipped once the goal is met, tomorrow still reminds", () => {
        const times = reminderTimes(at(4, 9), on, 20);
        expect(times[0]).toEqual(at(5, 19, 30));
        expect(reminderTimes(at(4, 9), on, 19)[0]).toEqual(at(4, 19, 30));
    });

    test("a reminder a few seconds away is not scheduled", () => {
        expect(reminderTimes(at(4, 19, 30), on, 0)[0]).toEqual(at(5, 19, 30));
    });

    test("month ends roll over", () => {
        const times = reminderTimes(new Date(2026, 10, 29, 9), on, 0);
        expect(times[2]).toEqual(new Date(2026, 11, 1, 19, 30));
    });
});
