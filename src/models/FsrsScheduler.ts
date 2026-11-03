import {
    createEmptyCard,
    fsrs,
    Rating,
    State,
    type Card as FsrsCard,
} from "ts-fsrs";
import { REVIEW_INTERVALS } from "./SpacedRepetition";

export const FSRS_RETENTION = 0.9;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A card counts as mastered once it is in the Review state with memory stability of 3+ weeks (Anki's "mature" cutoff). */
export const MASTERED_MIN_STABILITY_DAYS = 21;

/** Floor for converted legacy cards whose old interval was under a day (the old ladder started at 1 minute). */
const MIN_LEGACY_STABILITY_DAYS = 0.1;

const scheduler = fsrs({
    request_retention: FSRS_RETENTION,
    maximum_interval: 36500,
    enable_fuzz: true,
    enable_short_term: true,
    learning_steps: ["1m", "10m"],
    relearning_steps: ["10m"],
});

export type ReviewDirection = "left" | "right";

export function createNewFsrsCard(now: Date = new Date()): FsrsCard {
    return createEmptyCard(now);
}

/** True when FSRS considers the card well learned: Review state and stability of at least 21 days. */
export function isMastered(card: FsrsCard): boolean {
    return card.state === State.Review && card.stability >= MASTERED_MIN_STABILITY_DAYS;
}

/**
 * The interval (in days) the old fixed-ladder scheduler gave a card with this review count.
 * A card with review count n was last scheduled REVIEW_INTERVALS[n - 1] ahead.
 */
export function legacyIntervalDays(reviewCount: number): number {
    const index = Math.min(Math.max(reviewCount, 1) - 1, REVIEW_INTERVALS.length - 1);
    return REVIEW_INTERVALS[index] / DAY_MS;
}

/**
 * Converts legacy (pre-FSRS) progress into an FSRS card. There is no review history, so this
 * is an estimate, but it is anchored on what the old scheduler actually promised:
 *  - stability  = the interval the old ladder gave the card (never the time left until it is
 *                 due, which is zero or negative for any card that is actually being reviewed),
 *  - last_review = due date minus that interval,
 * so a card the old scheduler had at 60 days is still a 60-day card when it comes due.
 * FSRS becomes authoritative from the first review onwards.
 */
export function migrateLegacyFsrsCard(
    reviewCount: number,
    nextReviewAt?: number,
    now: Date = new Date(),
): FsrsCard {
    const card = createEmptyCard(now);
    if (reviewCount <= 0) {
        if (nextReviewAt !== undefined) card.due = new Date(nextReviewAt);
        return card;
    }

    const intervalDays = Math.max(MIN_LEGACY_STABILITY_DAYS, legacyIntervalDays(reviewCount));
    const dueMs = nextReviewAt ?? now.getTime();
    const lastReview = new Date(Math.min(dueMs - intervalDays * DAY_MS, now.getTime()));

    return {
        ...card,
        due: new Date(dueMs),
        stability: intervalDays,
        difficulty: 5,
        elapsed_days: Math.max(0, Math.floor((now.getTime() - lastReview.getTime()) / DAY_MS)),
        scheduled_days: Math.round(intervalDays),
        reps: reviewCount,
        lapses: 0,
        state: State.Review,
        last_review: lastReview,
    };
}

export function serializeFsrsCard(card: FsrsCard): string {
    return JSON.stringify(card);
}

export function deserializeFsrsCard(value: string): FsrsCard {
    const parsed = JSON.parse(value) as FsrsCard & {
        due: string | Date;
        last_review?: string | Date | null;
    };
    return {
        ...parsed,
        due: new Date(parsed.due),
        last_review: parsed.last_review ? new Date(parsed.last_review) : undefined,
    } as FsrsCard;
}

export function scheduleFsrsReview(
    card: FsrsCard,
    direction: ReviewDirection,
    now: Date = new Date(),
) {
    const rating = direction === "left" ? Rating.Again : Rating.Good;
    return scheduler.next(card, now, rating);
}
