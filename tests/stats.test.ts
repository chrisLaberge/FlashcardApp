process.env.TZ = "America/Toronto"; // a zone with daylight saving, to test the day boundaries

import { dailyStats, localDay, shiftDay, streaks, totals, type LoggedReview } from "@/models/Stats";

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const review = (time: number, correct = true, durationMs: number | null = 5000): LoggedReview => ({
    reviewedAt: time,
    correct,
    durationMs,
});

describe("days", () => {
    test("a late-night review belongs to the local day, not the UTC day", () => {
        expect(localDay(at(2026, 11, 3, 23))).toBe("2026-11-03");
        expect(localDay(at(2026, 11, 3, 0))).toBe("2026-11-03");
    });

    test("shiftDay moves by calendar days, also across the daylight-saving change", () => {
        expect(shiftDay("2026-11-01", 1)).toBe("2026-11-02"); // a 25-hour day
        expect(shiftDay("2026-11-02", -1)).toBe("2026-11-01");
        expect(shiftDay("2026-03-08", 1)).toBe("2026-03-09"); // a 23-hour day
        expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
        expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    });
});

describe("dailyStats", () => {
    test("groups by day with counts, correct answers and time, oldest first", () => {
        const days = dailyStats([
            review(at(2026, 11, 2, 9), true, 4000),
            review(at(2026, 11, 1, 20), false, 6000),
            review(at(2026, 11, 2, 22), true, null),
        ]);
        expect(days).toEqual([
            { day: "2026-11-01", reviews: 1, correct: 0, timeMs: 6000 },
            { day: "2026-11-02", reviews: 2, correct: 2, timeMs: 4000 },
        ]);
    });

    test("empty history gives no days", () => {
        expect(dailyStats([])).toEqual([]);
    });
});

describe("streaks", () => {
    const daysOf = (...times: number[]) => dailyStats(times.map((t) => review(t)));

    test("counts consecutive days ending today", () => {
        const days = daysOf(at(2026, 11, 1), at(2026, 11, 2), at(2026, 11, 3));
        expect(streaks(days, at(2026, 11, 3, 18))).toEqual({ current: 3, longest: 3, studiedToday: true });
    });

    test("today not being over yet does not break the streak", () => {
        const days = daysOf(at(2026, 11, 1), at(2026, 11, 2));
        expect(streaks(days, at(2026, 11, 3, 8))).toEqual({ current: 2, longest: 2, studiedToday: false });
    });

    test("a missed day ends the current streak but not the longest", () => {
        const days = daysOf(at(2026, 10, 20), at(2026, 10, 21), at(2026, 10, 22), at(2026, 10, 23), at(2026, 11, 3));
        expect(streaks(days, at(2026, 11, 3))).toEqual({ current: 1, longest: 4, studiedToday: true });
        expect(streaks(days, at(2026, 11, 6))).toEqual({ current: 0, longest: 4, studiedToday: false });
    });

    test("the 25-hour day when the clocks go back does not break or double-count a streak", () => {
        const days = daysOf(at(2026, 10, 31, 23), at(2026, 11, 1, 12), at(2026, 11, 2, 12));
        expect(streaks(days, at(2026, 11, 2, 20)).current).toBe(3);
    });

    test("the 23-hour day when the clocks go forward does not break a streak", () => {
        const days = daysOf(at(2026, 3, 7, 23), at(2026, 3, 8, 12), at(2026, 3, 9, 12));
        expect(streaks(days, at(2026, 3, 9, 20)).current).toBe(3);
    });

    test("no history", () => {
        expect(streaks([], at(2026, 11, 3))).toEqual({ current: 0, longest: 0, studiedToday: false });
    });
});

describe("totals", () => {
    test("adds up reviews, accuracy and time spent", () => {
        const t = totals([review(1, true, 3000), review(2, false, 7000), review(3, true, null), review(4, true, 2000)]);
        expect(t).toEqual({ reviews: 4, correct: 3, accuracy: 75, timeMs: 12000 });
    });

    test("no reviews means zeros, not NaN", () => {
        expect(totals([])).toEqual({ reviews: 0, correct: 0, accuracy: 0, timeMs: 0 });
    });
});
