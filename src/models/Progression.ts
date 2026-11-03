/**
 * XP, player levels and milestones: the "for fun" layer on top of the review log.
 *
 * Everything is derived from the log (never stored), so it cannot drift out of sync and Undo
 * simply takes the XP back. The numbers below are meant to be tuned; nothing else depends on them.
 */

import { dailyStats, localDay, streaks, totals, type DayStats, type LoggedReview } from "./Stats";

/* ----------------------------------- XP ----------------------------------- */

/** XP for a right answer, by what the front showed: harder ways of being asked are worth more. */
export const XP_CORRECT = { learning: 10, localized: 15, audio: 20 } as const;
/** XP for a wrong answer: trying still counts for something. */
export const XP_WRONG = 2;

export function xpForReview(review: Pick<LoggedReview, "correct" | "prompt">): number {
    if (!review.correct) return XP_WRONG;
    const prompt = review.prompt;
    return prompt === "localized" || prompt === "audio" ? XP_CORRECT[prompt] : XP_CORRECT.learning;
}

export function totalXp(reviews: readonly LoggedReview[]): number {
    let xp = 0;
    for (const review of reviews) xp += xpForReview(review);
    return xp;
}

/* ---------------------------------- Levels --------------------------------- */

/** Moving from level n to n + 1 costs 100 * n XP, so each level takes a little longer than the last. */
export const xpToNextLevel = (level: number): number => 100 * level;

/** Total XP needed to reach a level (level 1 needs none). */
export const xpToReachLevel = (level: number): number => 50 * level * (level - 1);

export type LevelProgress = {
    level: number;
    /** XP earned since reaching this level. */
    xpIntoLevel: number;
    /** XP needed to get from this level to the next. */
    xpForNext: number;
    /** 0-1, for a progress bar. */
    fraction: number;
};

export function levelProgress(xp: number): LevelProgress {
    const safeXp = Math.max(0, Math.floor(xp));
    let level = 1;
    while (xpToReachLevel(level + 1) <= safeXp) level++;
    const xpIntoLevel = safeXp - xpToReachLevel(level);
    const xpForNext = xpToNextLevel(level);
    return { level, xpIntoLevel, xpForNext, fraction: xpIntoLevel / xpForNext };
}

/* -------------------------------- Milestones -------------------------------- */

export type Milestone = {
    id: string;
    title: string;
    /** What it takes, e.g. "Review 1,000 cards". */
    description: string;
    value: number;
    target: number;
    achieved: boolean;
};

const HOUR_MS = 60 * 60 * 1000;

type Ladder = { id: string; title: (target: number) => string; description: (target: number) => string; targets: number[] };

const LADDERS: Ladder[] = [
    {
        id: "reviews",
        title: (n) => `${n.toLocaleString("en-US")} reviews`,
        description: (n) => `Review ${n.toLocaleString("en-US")} cards`,
        targets: [100, 500, 1000, 5000, 10000, 50000],
    },
    {
        id: "streak",
        title: (n) => `${n}-day streak`,
        description: (n) => `Study ${n} days in a row`,
        targets: [3, 7, 14, 30, 100, 365],
    },
    {
        id: "time",
        title: (n) => `${n} hours`,
        description: (n) => `Spend ${n} hours in reviews`,
        targets: [1, 5, 10, 50, 100],
    },
    {
        id: "level",
        title: (n) => `Level ${n}`,
        description: (n) => `Reach player level ${n}`,
        targets: [5, 10, 25, 50],
    },
];

/** Every milestone with how far along it is. The streak counts the best run ever, so it is never lost. */
export function milestones(reviews: readonly LoggedReview[], days: readonly DayStats[], nowMs: number): Milestone[] {
    const sum = totals(reviews);
    const values: Record<string, number> = {
        reviews: sum.reviews,
        streak: streaks(days, nowMs).longest,
        time: Math.floor(sum.timeMs / HOUR_MS),
        level: levelProgress(totalXp(reviews)).level,
    };
    return LADDERS.flatMap((ladder) =>
        ladder.targets.map((target) => ({
            id: `${ladder.id}-${target}`,
            title: ladder.title(target),
            description: ladder.description(target),
            value: values[ladder.id],
            target,
            achieved: values[ladder.id] >= target,
        })),
    );
}

/** The next milestone to aim for in each category (the first one not yet achieved). */
export function nextMilestones(all: readonly Milestone[]): Milestone[] {
    const seen = new Set<string>();
    const next: Milestone[] = [];
    for (const milestone of all) {
        const category = milestone.id.split("-")[0];
        if (!milestone.achieved && !seen.has(category)) {
            seen.add(category);
            next.push(milestone);
        }
    }
    return next;
}

/* ------------------------------ upload to the server ------------------------------ */

const DAY_MS = 24 * 60 * 60 * 1000;
/** The server accepts at most this many days per upload. */
export const MAX_UPLOAD_DAYS = 400;

export type UploadDay = { day: string; reviews: number; correct: number; timeMs: number; xp: number };

/**
 * One summary per day for the leaderboard: the most recent days only, with every number kept
 * inside what the server accepts (e.g. a day can never claim more than 24 hours).
 */
export function daysForUpload(reviews: readonly LoggedReview[]): UploadDay[] {
    const xpByDay = new Map<string, number>();
    for (const review of reviews) {
        const day = localDay(review.reviewedAt);
        xpByDay.set(day, (xpByDay.get(day) ?? 0) + xpForReview(review));
    }
    return dailyStats(reviews)
        .slice(-MAX_UPLOAD_DAYS)
        .map((d) => ({
            day: d.day,
            reviews: d.reviews,
            correct: d.correct,
            timeMs: Math.min(DAY_MS, Math.max(0, Math.round(d.timeMs))),
            xp: xpByDay.get(d.day) ?? 0,
        }));
}
