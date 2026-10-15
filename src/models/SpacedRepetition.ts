export const REVIEW_INTERVALS = [
    1 * 60 * 1000,           // 1 minute
    3 * 60 * 1000,           // 3 minutes
    30 * 60 * 1000,          // 30 minutes
    2 * 60 * 60 * 1000,      // 2 hours
    8 * 60 * 60 * 1000,      // 8 hours
    24 * 60 * 60 * 1000,     // 1 day
    3 * 24 * 60 * 60 * 1000, // 3 days
    7 * 24 * 60 * 60 * 1000, // 7 days

    14 * 24 * 60 * 60 * 1000,  // 14 days
    30 * 24 * 60 * 60 * 1000,  // 30 days
    60 * 24 * 60 * 60 * 1000,  // 60 days
    120 * 24 * 60 * 60 * 1000, // 120 days
    180 * 24 * 60 * 60 * 1000, // 180 days
];

export function getNextReview(
    reviewCount: number
): {
    reviewCount: number;
    nextReviewAt: number;
    mastered: boolean;
} {
    const newReviewCount = reviewCount + 1;

    const interval =
        REVIEW_INTERVALS[
        Math.min(
            newReviewCount - 1,
            REVIEW_INTERVALS.length - 1
        )
        ];

    return {
        reviewCount: newReviewCount,
        nextReviewAt: Date.now() + interval,
        mastered: newReviewCount >= 8,
    };
}

export function getFailedReview(
    reviewCount: number
): {
    reviewCount: number;
    nextReviewAt: number;
    mastered: boolean;
} {
    return {
        reviewCount: Math.max(0, reviewCount - 2),
        nextReviewAt: Date.now(),
        mastered: false,
    };
}