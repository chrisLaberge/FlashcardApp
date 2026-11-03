/**
 * The fixed intervals of the original scheduler. Only used to convert old cards to FSRS and to
 * read old CSV exports; new reviews are scheduled by FSRS (see FsrsScheduler).
 */
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
