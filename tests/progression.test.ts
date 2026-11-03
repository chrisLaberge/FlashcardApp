process.env.TZ = "America/Toronto";

import {
    levelProgress,
    milestones,
    nextMilestones,
    totalXp,
    XP_CORRECT,
    XP_WRONG,
    xpForReview,
    xpToNextLevel,
    xpToReachLevel,
} from "@/models/Progression";
import { dailyStats, type LoggedReview } from "@/models/Stats";

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const review = (time: number, correct = true, prompt: string | null = "learning", durationMs: number | null = 5000): LoggedReview => ({
    reviewedAt: time,
    correct,
    durationMs,
    prompt,
});

describe("xp", () => {
    test("harder ways of being asked are worth more", () => {
        expect(xpForReview({ correct: true, prompt: "learning" })).toBe(XP_CORRECT.learning);
        expect(xpForReview({ correct: true, prompt: "localized" })).toBe(XP_CORRECT.localized);
        expect(xpForReview({ correct: true, prompt: "audio" })).toBe(XP_CORRECT.audio);
        expect(XP_CORRECT.learning).toBeLessThan(XP_CORRECT.localized);
        expect(XP_CORRECT.localized).toBeLessThan(XP_CORRECT.audio);
    });

    test("a wrong answer still earns a little, whatever the prompt", () => {
        expect(xpForReview({ correct: false, prompt: "audio" })).toBe(XP_WRONG);
        expect(XP_WRONG).toBeGreaterThan(0);
        expect(XP_WRONG).toBeLessThan(XP_CORRECT.learning);
    });

    test("answers without a recorded prompt count as the easiest kind", () => {
        expect(xpForReview({ correct: true, prompt: null })).toBe(XP_CORRECT.learning);
        expect(xpForReview({ correct: true })).toBe(XP_CORRECT.learning);
        expect(xpForReview({ correct: true, prompt: "something-new" })).toBe(XP_CORRECT.learning);
    });

    test("total XP adds up, and removing a review (undo) takes its XP back", () => {
        const list = [review(1, true, "learning"), review(2, true, "audio"), review(3, false, "localized")];
        expect(totalXp(list)).toBe(10 + 20 + 2);
        expect(totalXp(list.slice(0, 2))).toBe(30);
        expect(totalXp([])).toBe(0);
    });
});

describe("levels", () => {
    test("the first level needs no XP and each level costs a little more than the last", () => {
        expect(xpToReachLevel(1)).toBe(0);
        expect(xpToReachLevel(2)).toBe(100);
        expect(xpToReachLevel(3)).toBe(300);
        expect(xpToReachLevel(4)).toBe(600);
        for (let n = 1; n < 30; n++) {
            expect(xpToReachLevel(n + 1) - xpToReachLevel(n)).toBe(xpToNextLevel(n));
            expect(xpToNextLevel(n + 1)).toBeGreaterThan(xpToNextLevel(n));
        }
    });

    test("level and progress inside the level", () => {
        expect(levelProgress(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNext: 100, fraction: 0 });
        expect(levelProgress(99)).toMatchObject({ level: 1, xpIntoLevel: 99 });
        expect(levelProgress(100)).toEqual({ level: 2, xpIntoLevel: 0, xpForNext: 200, fraction: 0 });
        expect(levelProgress(250)).toEqual({ level: 2, xpIntoLevel: 150, xpForNext: 200, fraction: 0.75 });
        expect(levelProgress(300).level).toBe(3);
    });

    test("every XP value lands in exactly the level whose range contains it", () => {
        for (const xp of [0, 1, 99, 100, 299, 300, 599, 600, 12345, 99999]) {
            const { level, xpIntoLevel, xpForNext } = levelProgress(xp);
            expect(xpToReachLevel(level) + xpIntoLevel).toBe(xp);
            expect(xpIntoLevel).toBeGreaterThanOrEqual(0);
            expect(xpIntoLevel).toBeLessThan(xpForNext);
        }
    });

    test("negative or fractional XP is handled safely", () => {
        expect(levelProgress(-50).level).toBe(1);
        expect(levelProgress(100.9).level).toBe(2);
    });
});

describe("milestones", () => {
    const now = at(2026, 11, 3, 18);

    test("progress and achievement for each ladder", () => {
        const list: LoggedReview[] = [];
        for (let i = 0; i < 120; i++) list.push(review(at(2026, 11, 3, 9) + i * 1000, true, "learning", 40_000));
        const all = milestones(list, dailyStats(list), now);

        const reviews100 = all.find((m) => m.id === "reviews-100")!;
        expect(reviews100).toMatchObject({ value: 120, target: 100, achieved: true });
        expect(all.find((m) => m.id === "reviews-500")).toMatchObject({ value: 120, achieved: false });
        // 120 answers x 40 s = 80 minutes: one whole hour so far
        expect(all.find((m) => m.id === "time-1")).toMatchObject({ value: 1, achieved: true });
        expect(all.find((m) => m.id === "time-5")).toMatchObject({ achieved: false });
        expect(all.find((m) => m.id === "streak-3")).toMatchObject({ value: 1, achieved: false });
        // 120 x 10 xp = 1200 -> level 5 (xpToReachLevel(5) = 1000)
        expect(all.find((m) => m.id === "level-5")).toMatchObject({ value: 5, achieved: true });
        expect(all.find((m) => m.id === "level-10")).toMatchObject({ achieved: false });
    });

    test("the streak milestone remembers the best run even after the streak broke", () => {
        const list = [at(2026, 10, 1), at(2026, 10, 2), at(2026, 10, 3), at(2026, 10, 4)].map((t) => review(t));
        const all = milestones(list, dailyStats(list), now);
        expect(all.find((m) => m.id === "streak-3")).toMatchObject({ value: 4, achieved: true });
    });

    test("nothing is achieved with no history", () => {
        const all = milestones([], [], now);
        expect(all.every((m) => !m.achieved || m.id === "level-1")).toBe(true);
        expect(all.filter((m) => m.achieved)).toEqual([]);
    });

    test("nextMilestones gives the first unachieved one of each kind", () => {
        const list = Array.from({ length: 150 }, (_, i) => review(at(2026, 11, 3, 9) + i * 1000));
        const next = nextMilestones(milestones(list, dailyStats(list), now));
        expect(next.map((m) => m.id)).toEqual(["reviews-500", "streak-3", "time-1", "level-10"].filter((id) => next.some((m) => m.id === id)));
        expect(next.find((m) => m.id.startsWith("reviews"))!.target).toBe(500);
        expect(new Set(next.map((m) => m.id.split("-")[0])).size).toBe(next.length);
    });
});
