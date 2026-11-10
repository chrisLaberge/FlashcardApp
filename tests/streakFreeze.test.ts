import { FREEZE_EVERY_DAYS, MAX_FREEZES, streakWithFreezes } from "../src/models/StreakFreeze";
import { shiftDay } from "../src/models/Stats";

const run = (start: string, length: number) => Array.from({ length }, (_, i) => shiftDay(start, i));

describe("streak freezes", () => {
    test("no history", () => {
        expect(streakWithFreezes([], "2026-11-04")).toEqual({ current: 0, longest: 0, freezes: 0, frozenDays: [], savers: 0, studiedToday: false });
    });

    test("a plain streak, and today not being done yet does not break it", () => {
        const days = run("2026-11-01", 3); // 1st, 2nd, 3rd
        const result = streakWithFreezes(days, "2026-11-04");
        expect(result).toMatchObject({ current: 3, longest: 3, freezes: 0, studiedToday: false });
        expect(streakWithFreezes([...days, "2026-11-04"], "2026-11-04")).toMatchObject({ current: 4, studiedToday: true });
    });

    test("a missed day without a freeze ends the streak", () => {
        const result = streakWithFreezes(["2026-11-01", "2026-11-02", "2026-11-04"], "2026-11-04");
        expect(result).toMatchObject({ current: 1, longest: 2 });
    });

    test("a freeze is earned every 7 days and used automatically on a missed day", () => {
        const week = run("2026-10-20", FREEZE_EVERY_DAYS); // 20..26 -> one freeze
        const days = [...week, ...run("2026-10-28", 3)]; // missed the 27th
        const result = streakWithFreezes(days, "2026-10-30");
        expect(result.frozenDays).toEqual(["2026-10-27"]);
        expect(result.freezes).toBe(0);
        expect(result.current).toBe(10); // the frozen day holds the streak but does not add to it
        expect(result.longest).toBe(10);
    });

    test("only one freeze covers one day: two missed days in a row still break it", () => {
        const days = [...run("2026-10-20", 7), ...run("2026-10-30", 2)]; // missed 27th and 28th and 29th
        const result = streakWithFreezes(days, "2026-10-31");
        expect(result.current).toBe(2);
        expect(result.longest).toBe(7);
    });

    test("at most two freezes are kept", () => {
        const result = streakWithFreezes(run("2026-10-01", 28), "2026-10-28");
        expect(result.freezes).toBe(MAX_FREEZES);
        expect(result.current).toBe(28);
    });

    test("a freeze needs a streak to protect: a long gap after nothing is just a gap", () => {
        const result = streakWithFreezes(["2026-10-01", "2026-11-04"], "2026-11-04");
        expect(result).toMatchObject({ current: 1, longest: 1, frozenDays: [] });
    });

    test("days after today are ignored", () => {
        expect(streakWithFreezes(["2026-11-05", "2026-11-06"], "2026-11-04").current).toBe(0);
    });
});
