/**
 * How often the home and learn screens re-check which cards have become due.
 * Override at build time with EXPO_PUBLIC_REVIEW_REFRESH_MS (milliseconds).
 */
const configuredRefresh = Number(process.env.EXPO_PUBLIC_REVIEW_REFRESH_MS);
export const REVIEW_REFRESH_MS =
    Number.isFinite(configuredRefresh) && configuredRefresh >= 1000 ? configuredRefresh : 10_000;

/** How many due cards the learn screen keeps queued at a time (more are fetched as the queue runs low). */
export const REVIEW_BATCH_SIZE = 100;
