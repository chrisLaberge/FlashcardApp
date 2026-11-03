/**
 * Study statistics computed from the review log: reviews and time per day, streaks, totals.
 * Everything here is pure (no database, no clock unless passed in) so it can be tested, and so
 * the same numbers can later feed XP, milestones and a leaderboard.
 */

export type LoggedReview = {
    reviewedAt: number;
    correct: boolean;
    durationMs: number | null;
};

export type DayStats = {
    /** Local calendar day, "YYYY-MM-DD". */
    day: string;
    reviews: number;
    correct: number;
    timeMs: number;
};

/** The local calendar day of a moment. Uses the device's time zone, so daylight saving is handled. */
export function localDay(timestampMs: number): string {
    const date = new Date(timestampMs);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

/** The day before/after a "YYYY-MM-DD" day, computed on the calendar (not by adding 24 hours). */
export function shiftDay(day: string, delta: number): string {
    const [year, month, date] = day.split("-").map(Number);
    return localDay(new Date(year, month - 1, date + delta, 12).getTime());
}

/** Reviews, correct answers and time spent for every day that has at least one review, oldest first. */
export function dailyStats(reviews: readonly LoggedReview[]): DayStats[] {
    const days = new Map<string, DayStats>();
    for (const review of reviews) {
        const day = localDay(review.reviewedAt);
        const entry = days.get(day) ?? { day, reviews: 0, correct: 0, timeMs: 0 };
        entry.reviews += 1;
        if (review.correct) entry.correct += 1;
        entry.timeMs += review.durationMs ?? 0;
        days.set(day, entry);
    }
    return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export type Streaks = {
    /** Consecutive days with a review, ending today (or yesterday: today is not over yet). */
    current: number;
    longest: number;
    /** True once today already has a review. */
    studiedToday: boolean;
};

export function streaks(days: readonly DayStats[], nowMs: number): Streaks {
    const studied = new Set(days.filter((d) => d.reviews > 0).map((d) => d.day));
    const today = localDay(nowMs);

    // Current: walk back from today, or from yesterday if today has no review yet.
    let cursor = studied.has(today) ? today : shiftDay(today, -1);
    let current = 0;
    while (studied.has(cursor)) {
        current += 1;
        cursor = shiftDay(cursor, -1);
    }

    // Longest: the longest run of consecutive days anywhere in the history.
    let longest = 0;
    for (const day of studied) {
        if (studied.has(shiftDay(day, -1))) continue; // not the start of a run
        let length = 0;
        for (let d = day; studied.has(d); d = shiftDay(d, 1)) length += 1;
        longest = Math.max(longest, length);
    }

    return { current, longest, studiedToday: studied.has(today) };
}

export type Totals = {
    reviews: number;
    correct: number;
    /** 0-100, or 0 when there are no reviews. */
    accuracy: number;
    timeMs: number;
};

export function totals(reviews: readonly LoggedReview[]): Totals {
    let correct = 0;
    let timeMs = 0;
    for (const review of reviews) {
        if (review.correct) correct += 1;
        timeMs += review.durationMs ?? 0;
    }
    return {
        reviews: reviews.length,
        correct,
        accuracy: reviews.length === 0 ? 0 : Math.round((correct / reviews.length) * 100),
        timeMs,
    };
}
