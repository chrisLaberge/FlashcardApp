/**
 * Achievements: a set of tracks (reviews, streak, time, ...), each with six tiers from bronze to
 * diamond. Everything is computed from the review log and the cards-added count, never stored, so
 * Undo or a restore cannot leave it out of step.
 */

import { levelProgress, totalXp } from "./Progression";
import { dailyStats, streaks, totals, type LoggedReview } from "./Stats";

export const TIERS = [
    { id: "bronze", name: "Bronze", color: "#cd7f32" },
    { id: "silver", name: "Silver", color: "#b8c2cc" },
    { id: "gold", name: "Gold", color: "#ffc933" },
    { id: "platinum", name: "Platinum", color: "#7fd1e0" },
    { id: "emerald", name: "Emerald", color: "#2fbf71" },
    { id: "diamond", name: "Diamond", color: "#b57cff" },
] as const;

const HOUR_MS = 60 * 60 * 1000;

type Track = {
    id: string;
    title: string;
    icon: string;
    /** "Review {n} cards": what the next tier asks for. */
    goal: (n: number) => string;
    /** One target per tier, rising. */
    targets: readonly number[];
};

const n = (value: number) => value.toLocaleString("en-US");

const TRACKS: readonly Track[] = [
    { id: "reviews", title: "Card reviewer", icon: "🃏", goal: (v) => `Review ${n(v)} cards`, targets: [10, 100, 1000, 5000, 10000, 50000] },
    { id: "correct", title: "Sharp mind", icon: "🎯", goal: (v) => `Answer ${n(v)} cards correctly`, targets: [10, 100, 500, 2500, 7500, 25000] },
    { id: "streak", title: "On a roll", icon: "🔥", goal: (v) => `Study ${n(v)} days in a row`, targets: [3, 7, 14, 30, 100, 365] },
    { id: "days", title: "Regular", icon: "📅", goal: (v) => `Study on ${n(v)} different days`, targets: [3, 10, 30, 100, 200, 365] },
    { id: "time", title: "Time well spent", icon: "⏱️", goal: (v) => `Spend ${n(v)} hours in reviews`, targets: [1, 5, 10, 25, 50, 100] },
    { id: "bigday", title: "Marathon", icon: "🏃", goal: (v) => `Review ${n(v)} cards in one day`, targets: [20, 50, 100, 200, 300, 500] },
    { id: "added", title: "Collector", icon: "🗂️", goal: (v) => `Add ${n(v)} cards`, targets: [10, 50, 100, 500, 1000, 2500] },
    { id: "level", title: "Level up", icon: "⭐", goal: (v) => `Reach player level ${n(v)}`, targets: [3, 5, 10, 20, 35, 50] },
    { id: "xp", title: "XP hoarder", icon: "💎", goal: (v) => `Earn ${n(v)} XP`, targets: [100, 1000, 5000, 25000, 100000, 250000] },
    { id: "audio", title: "Good ear", icon: "🎧", goal: (v) => `Answer ${n(v)} listening cards correctly`, targets: [10, 50, 200, 500, 1000, 2500] },
    { id: "localized", title: "Translator", icon: "🌍", goal: (v) => `Answer ${n(v)} translation cards correctly`, targets: [10, 50, 200, 500, 1000, 2500] },
    { id: "early", title: "Early bird", icon: "🌅", goal: (v) => `Review ${n(v)} cards before 8 am`, targets: [10, 50, 100, 250, 500, 1000] },
    { id: "night", title: "Night owl", icon: "🦉", goal: (v) => `Review ${n(v)} cards after 10 pm`, targets: [10, 50, 100, 250, 500, 1000] },
];

export type Achievement = {
    id: string;
    title: string;
    icon: string;
    value: number;
    /** Tiers earned, 0 to 6. */
    tier: number;
    targets: readonly number[];
    /** What the next tier needs, or null once diamond is reached. */
    nextTarget: number | null;
    nextGoal: string | null;
    /** Progress from the last tier's target to the next one, 0 to 1 (1 when finished). */
    fraction: number;
};

export type AchievementInput = {
    reviews: readonly LoggedReview[];
    /** Cards added so far, including ones from before dates were recorded. */
    cardsAdded: number;
    nowMs: number;
};

export function achievementValues({ reviews, cardsAdded, nowMs }: AchievementInput): Record<string, number> {
    const days = dailyStats(reviews);
    const sum = totals(reviews);
    let early = 0;
    let night = 0;
    let audio = 0;
    let localized = 0;
    for (const review of reviews) {
        const hour = new Date(review.reviewedAt).getHours();
        if (hour < 8) early++;
        if (hour >= 22) night++;
        if (review.correct && review.prompt === "audio") audio++;
        if (review.correct && review.prompt === "localized") localized++;
    }
    const xp = totalXp(reviews);
    return {
        reviews: sum.reviews,
        correct: reviews.filter((r) => r.correct).length,
        streak: streaks(days, nowMs).longest,
        days: days.filter((d) => d.reviews > 0).length,
        time: Math.floor(sum.timeMs / HOUR_MS),
        bigday: days.reduce((max, d) => Math.max(max, d.reviews), 0),
        added: cardsAdded,
        level: levelProgress(xp).level,
        xp,
        audio,
        localized,
        early,
        night,
    };
}

export function achievements(input: AchievementInput): Achievement[] {
    const values = achievementValues(input);
    return TRACKS.map((track) => {
        const value = values[track.id] ?? 0;
        const tier = track.targets.filter((target) => value >= target).length;
        const nextTarget = tier < track.targets.length ? track.targets[tier] : null;
        const floor = tier === 0 ? 0 : track.targets[tier - 1];
        const fraction = nextTarget === null ? 1 : Math.min(1, Math.max(0, (value - floor) / (nextTarget - floor)));
        return {
            id: track.id,
            title: track.title,
            icon: track.icon,
            value,
            tier,
            targets: track.targets,
            nextTarget,
            nextGoal: nextTarget === null ? null : track.goal(nextTarget),
            fraction,
        };
    });
}

export function tierSummary(list: readonly Achievement[]): { earned: number; total: number } {
    return { earned: list.reduce((sum, a) => sum + a.tier, 0), total: list.reduce((sum, a) => sum + a.targets.length, 0) };
}
