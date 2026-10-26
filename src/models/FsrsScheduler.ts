import {
    createEmptyCard,
    fsrs,
    Rating,
    type Card as FsrsCard,
} from "ts-fsrs";

export const FSRS_RETENTION = 0.9;
const DAY_MS = 24 * 60 * 60 * 1000;

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

/**
 * Legacy progress has no complete review history, so this is an estimate.
 * It keeps the old due date and review count rather than treating every
 * existing card as entirely new. FSRS becomes authoritative after this review.
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

    const remainingDays = nextReviewAt === undefined
        ? 1
        : Math.max(0.1, (nextReviewAt - now.getTime()) / DAY_MS);

    return {
        ...card,
        due: nextReviewAt === undefined ? now : new Date(nextReviewAt),
        stability: remainingDays,
        difficulty: 5,
        elapsed_days: 0,
        scheduled_days: remainingDays,
        reps: reviewCount,
        lapses: 0,
        state: 2 as FsrsCard["state"],
        last_review: now,
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
