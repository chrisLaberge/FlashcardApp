/**
 * What the shop knows about you, and the rules for buying. All pure: the screens read the state
 * and the plans, and services/shop.ts saves a plan.
 */

import { levelProgress } from "./Progression";
import { petLevel } from "./Pet";
import {
    BANNERS, CASE_PRICE, DUPLICATE_REFUND, MAX_STREAK_SAVERS_HELD, STREAK_SAVER_PRICE, freeCasesEarned, gemsEarned, getAccessory, getBanner,
    openCase, type Accessory, type Slot,
} from "./Shop";
import { localDay } from "./Stats";
import { streakWithFreezes } from "./StreakFreeze";

export type LedgerRow = { itemId: string; gems: number; kind: string; at: number };

export type ShopInput = {
    /** XP from reviews plus the bonus XP from achievements. */
    xp: number;
    /** Achievement tiers earned (permanent). */
    unlocks: readonly { tier: number }[];
    ledger: readonly LedgerRow[];
    inventory: readonly string[];
    pet: Readonly<Record<string, string>>;
    /** "YYYY-MM-DD" days with at least one review. */
    studiedDays: readonly string[];
    today: string;
};

export type Equipped = { hat: string | null; glasses: string | null; scarf: string | null };

export type ShopState = {
    xp: number;
    level: number;
    petLevel: number;
    gemsEarned: number;
    gemsSpent: number;
    gems: number;
    freeCasesLeft: number;
    owned: ReadonlySet<string>;
    equipped: Equipped;
    banner: string;
    petName: string | null;
    /** Streak savers bought and not used yet. */
    savers: number;
    saverDays: string[];
    eggsFound: string[];
};

const parseList = (raw: string | undefined): string[] => {
    try {
        const value = JSON.parse(raw ?? "[]");
        return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
    } catch {
        return [];
    }
};

export function shopState(input: ShopInput): ShopState {
    const level = levelProgress(input.xp).level;
    const owned = new Set([...input.inventory, "mist"]);
    const saverDays = input.ledger.filter((l) => l.kind === "saver").map((l) => localDay(l.at));
    const spent = input.ledger.reduce((sum, l) => sum + l.gems, 0);
    const earned = gemsEarned(level, input.unlocks);
    const freeUsed = input.ledger.filter((l) => l.kind === "free_case").length;

    // Only wear what is owned (an item could not be un-owned, but the saved value could be stale).
    const wearing = (slot: Slot): string | null => {
        const id = input.pet[slot];
        const item = getAccessory(id);
        return item && item.slot === slot && owned.has(item.id) ? item.id : null;
    };

    return {
        xp: input.xp,
        level,
        petLevel: petLevel(level),
        gemsEarned: earned,
        gemsSpent: spent,
        gems: Math.max(0, earned - spent),
        freeCasesLeft: Math.max(0, freeCasesEarned(level) - freeUsed),
        owned,
        equipped: { hat: wearing("hat"), glasses: wearing("glasses"), scarf: wearing("scarf") },
        banner: owned.has(input.pet.banner ?? "") ? getBanner(input.pet.banner).id : "mist",
        petName: input.pet.name ?? null,
        savers: streakWithFreezes(input.studiedDays, input.today, saverDays).savers,
        saverDays,
        eggsFound: parseList(input.pet.eggs),
    };
}

export type Plan =
    | { ok: false; error: string }
    | { ok: true; ledger: Omit<LedgerRow, "at">[]; addItem?: string };

export function planBanner(state: ShopState, id: string): Plan {
    const banner = BANNERS.find((b) => b.id === id);
    if (!banner) return { ok: false, error: "That banner does not exist." };
    if (state.owned.has(id)) return { ok: false, error: "You already own that banner." };
    if (state.gems < banner.price) return { ok: false, error: `You need ${banner.price - state.gems} more gems.` };
    return { ok: true, ledger: [{ itemId: id, gems: banner.price, kind: "banner" }], addItem: id };
}

export function planSaver(state: ShopState): Plan {
    if (state.savers >= MAX_STREAK_SAVERS_HELD) return { ok: false, error: `You can hold ${MAX_STREAK_SAVERS_HELD} streak savers at a time.` };
    if (state.gems < STREAK_SAVER_PRICE) return { ok: false, error: `You need ${STREAK_SAVER_PRICE - state.gems} more gems.` };
    return { ok: true, ledger: [{ itemId: "streak_saver", gems: STREAK_SAVER_PRICE, kind: "saver" }] };
}

export type CasePlan = Plan & { item?: Accessory; duplicate?: boolean; refund?: number };

/** Opens a case: a free one if `free`, otherwise for gems. A duplicate gives some gems back. */
export function planCase(state: ShopState, free: boolean, random: () => number = Math.random): CasePlan {
    if (free && state.freeCasesLeft <= 0) return { ok: false, error: "No free cases left. Every 10 levels gives you one." };
    if (!free && state.gems < CASE_PRICE) return { ok: false, error: `You need ${CASE_PRICE - state.gems} more gems.` };

    const item = openCase(random);
    const duplicate = state.owned.has(item.id);
    const refund = duplicate ? DUPLICATE_REFUND[item.rarity] : 0;
    const ledger: Omit<LedgerRow, "at">[] = [{ itemId: "case", gems: free ? 0 : CASE_PRICE, kind: free ? "free_case" : "case" }];
    if (duplicate) ledger.push({ itemId: item.id, gems: -refund, kind: "refund" });
    return { ok: true, ledger, addItem: duplicate ? undefined : item.id, item, duplicate, refund };
}

export const todayKey = (nowMs: number): string => localDay(nowMs);
