/**
 * XP and player levels: the "for fun" layer on top of the review log.
 *
 * Everything is derived from the log (never stored), so it cannot drift out of sync and Undo
 * simply takes the XP back. The numbers below are meant to be tuned; nothing else depends on them.
 */

import { dailyStats, localDay, type LoggedReview } from "./Stats";

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
