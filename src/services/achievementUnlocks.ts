import { getAchievementUnlocks, getCardsAdded, getReviewLog, recordAchievementUnlocks } from "../database/database";
import { achievements, bonusXpFor, newlyEarned, TIER_BONUS_XP, TIERS } from "../models/Achievements";
import { levelProgress, totalXp } from "../models/Progression";
import { checkLevelUp } from "./levelUp";
import { syncStats } from "./syncStats";

/** One newly earned tier, ready to show. */
export type UnlockItem = { id: string; title: string; icon: string; tierName: string; color: string; xp: number };
export type UnlockEvent = { items: UnlockItem[]; totalXp: number };

type Listener = (event: UnlockEvent) => void;
const listeners = new Set<Listener>();

/** Calls `listener` whenever tiers are newly earned. Returns the way to stop listening. */
export function onAchievementsUnlocked(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Bonus XP from every tier earned so far. */
export async function getBonusXp(): Promise<number> {
    return bonusXpFor(await getAchievementUnlocks());
}

let running: Promise<UnlockEvent | null> | null = null;

/**
 * Looks for newly earned tiers, records them (so each is awarded once, forever) and tells the
 * listeners so a notification can be shown. Safe to call often: overlapping calls share one run.
 */
export function checkAchievements(): Promise<UnlockEvent | null> {
    if (running) return running;
    running = (async () => {
        const [log, added, recorded] = await Promise.all([getReviewLog(), getCardsAdded(), getAchievementUnlocks()]);
        const list = achievements({ reviews: log, cardsAdded: added.addedAt.length + added.undated, nowMs: Date.now() });
        const fresh = newlyEarned(list, recorded);
        if (fresh.length > 0) await recordAchievementUnlocks(fresh);
        // The level counts the bonus XP of the tiers just recorded.
        await checkLevelUp(levelProgress(totalXp(log) + bonusXpFor(fresh.length > 0 ? await getAchievementUnlocks() : recorded)).level);
        if (fresh.length === 0) return null;

        const items: UnlockItem[] = fresh.flatMap((e) => {
            const a = list.find((x) => x.id === e.track);
            return a
                ? [{ id: `${e.track}:${e.tier}`, title: a.title, icon: a.icon, tierName: TIERS[e.tier - 1].name, color: TIERS[e.tier - 1].color, xp: TIER_BONUS_XP[e.tier - 1] }]
                : [];
        });
        const event = { items, totalXp: items.reduce((sum, i) => sum + i.xp, 0) };
        listeners.forEach((listener) => listener(event));
        void syncStats(true).catch(() => undefined); // so friends see the bonus; fine if signed out
        return event;
    })()
        .catch(() => null)
        .finally(() => {
            running = null;
        });
    return running;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Checks shortly after the last call, so a burst of answers or imported cards triggers one check. */
export function scheduleAchievementCheck(delayMs = 1200): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
        timer = undefined;
        void checkAchievements();
    }, delayMs);
}
