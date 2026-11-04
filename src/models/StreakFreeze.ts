/**
 * Streak freezes: a safety net for a missed day.
 *
 * You earn one for every 7 days in a row (up to two kept at a time). When a day passes with no
 * reviews, a freeze is used automatically and the streak carries on. It is all worked out from the
 * list of days you studied, so it never needs saving and cannot drift.
 */

import { shiftDay } from "./Stats";

export const FREEZE_EVERY_DAYS = 7;
export const MAX_FREEZES = 2;

export type StreakWithFreezes = {
    /** Streak counted today. Today not being studied yet does not break it. */
    current: number;
    longest: number;
    /** Freezes you have left. */
    freezes: number;
    /** The days a freeze covered (they count towards the streak for friends too). */
    frozenDays: string[];
    studiedToday: boolean;
};

/** `studiedDays` are "YYYY-MM-DD" days with at least one review; `today` is "YYYY-MM-DD". */
export function streakWithFreezes(studiedDays: Iterable<string>, today: string): StreakWithFreezes {
    const studied = new Set(studiedDays);
    const first = [...studied].filter((d) => d <= today).sort()[0];
    if (first === undefined) return { current: 0, longest: 0, freezes: 0, frozenDays: [], studiedToday: false };

    let streak = 0;
    let longest = 0;
    let freezes = 0;
    const frozenDays: string[] = [];

    for (let day = first; day <= today; day = shiftDay(day, 1)) {
        if (studied.has(day)) {
            streak++;
            if (streak % FREEZE_EVERY_DAYS === 0 && freezes < MAX_FREEZES) freezes++;
            longest = Math.max(longest, streak);
        } else if (day < today) {
            if (freezes > 0 && streak > 0) {
                freezes--;
                frozenDays.push(day);
            } else {
                streak = 0;
            }
        }
        // Today with no reviews yet: the day is not over, so nothing breaks.
    }
    return { current: streak, longest, freezes, frozenDays, studiedToday: studied.has(today) };
}
