import { getReviewLog } from "../database/database";
import { daysForUpload } from "../models/Progression";
import { uploadDays, type Profile } from "./social";

let lastSync = 0;
let running: Promise<Profile | null> | null = null;
const MIN_GAP_MS = 20_000;

/**
 * Sends the daily summaries to the server so friends see up-to-date numbers.
 * Safe to call often: calls that overlap share one upload and very recent ones are skipped.
 * Returns the profile the server computed, or null when nothing was sent.
 */
export function syncStats(force = false): Promise<Profile | null> {
    if (running) return running;
    if (!force && Date.now() - lastSync < MIN_GAP_MS) return Promise.resolve(null);

    running = (async () => {
        const days = daysForUpload(await getReviewLog());
        if (days.length === 0) return null;
        const profile = await uploadDays(days);
        lastSync = Date.now();
        return profile;
    })().finally(() => {
        running = null;
    });
    return running;
}
