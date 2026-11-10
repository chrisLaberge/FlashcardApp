/**
 * The shop: gems, accessories, banners and streak savers.
 *
 * Gems are never stored as a balance. What you have earned (player levels and achievement tiers)
 * comes from the review log, so Undo or a restore cannot invent or lose any; the only stored part is
 * what you spent (see the purchases table), and a balance is earned minus spent.
 */

import { TIER_BONUS_XP } from "./Achievements";

/* ----------------------------------- gems ----------------------------------- */

export const GEMS_PER_LEVEL = 5;
/** Gems for earning each achievement tier, bronze first (the last is the pink "God" tier). */
export const GEMS_PER_TIER = [5, 10, 20, 40, 80, 160, 500] as const;

export function gemsEarned(level: number, earnedTiers: readonly { tier: number }[]): number {
    const fromLevels = Math.max(0, Math.floor(level) - 1) * GEMS_PER_LEVEL;
    const fromTiers = earnedTiers.reduce((sum, e) => sum + (GEMS_PER_TIER[e.tier - 1] ?? 0), 0);
    return fromLevels + fromTiers;
}

// Keeps the two tables the same length: a tier added to one must be added to the other.
export const TIER_COUNT = TIER_BONUS_XP.length;

/* ------------------------------- the catalogue ------------------------------- */

export type Rarity = "common" | "rare" | "epic" | "legendary";
export type Slot = "hat" | "glasses" | "scarf";

export type Accessory = { id: string; name: string; slot: Slot; rarity: Rarity; emoji: string };

export const RARITY_COLOR: Record<Rarity, string> = { common: "#9aa7b5", rare: "#4f9dff", epic: "#b25cff", legendary: "#ff4fa3" };
export const RARITIES: readonly Rarity[] = ["common", "rare", "epic", "legendary"];

export const ACCESSORIES: readonly Accessory[] = [
    { id: "cap", name: "Baseball cap", slot: "hat", rarity: "common", emoji: "🧢" },
    { id: "beanie", name: "Beanie", slot: "hat", rarity: "common", emoji: "🧶" },
    { id: "party", name: "Party hat", slot: "hat", rarity: "common", emoji: "🎉" },
    { id: "tophat", name: "Top hat", slot: "hat", rarity: "rare", emoji: "🎩" },
    { id: "wizard", name: "Wizard hat", slot: "hat", rarity: "rare", emoji: "🧙" },
    { id: "viking", name: "Viking helmet", slot: "hat", rarity: "epic", emoji: "🪖" },
    { id: "halo", name: "Halo", slot: "hat", rarity: "epic", emoji: "😇" },
    { id: "crown", name: "Crown", slot: "hat", rarity: "legendary", emoji: "👑" },
    { id: "round", name: "Round glasses", slot: "glasses", rarity: "common", emoji: "👓" },
    { id: "shades", name: "Sunglasses", slot: "glasses", rarity: "common", emoji: "🕶️" },
    { id: "hearts", name: "Heart glasses", slot: "glasses", rarity: "rare", emoji: "😍" },
    { id: "monocle", name: "Monocle", slot: "glasses", rarity: "rare", emoji: "🧐" },
    { id: "visor", name: "Space visor", slot: "glasses", rarity: "epic", emoji: "🥽" },
    { id: "stars", name: "Star glasses", slot: "glasses", rarity: "legendary", emoji: "🤩" },
    { id: "scarfred", name: "Red scarf", slot: "scarf", rarity: "common", emoji: "🧣" },
    { id: "scarfblue", name: "Blue scarf", slot: "scarf", rarity: "common", emoji: "🧣" },
    { id: "stripes", name: "Striped scarf", slot: "scarf", rarity: "rare", emoji: "🧣" },
    { id: "rainbow", name: "Rainbow scarf", slot: "scarf", rarity: "epic", emoji: "🌈" },
    { id: "goldscarf", name: "Golden scarf", slot: "scarf", rarity: "legendary", emoji: "🏅" },
    // Never in a case: given for finding the easter eggs.
    { id: "egghat", name: "Golden egg hat", slot: "hat", rarity: "legendary", emoji: "🥚" },
];

/** Items a case can drop (everything but the easter-egg reward). */
export const CASE_POOL: readonly Accessory[] = ACCESSORIES.filter((a) => a.id !== "egghat");

export const getAccessory = (id: string | null | undefined): Accessory | undefined => ACCESSORIES.find((a) => a.id === id);

export type Banner = { id: string; name: string; price: number; colors: readonly [string, string, string] };

export const BANNERS: readonly Banner[] = [
    { id: "mist", name: "Mist", price: 0, colors: ["#3b4252", "#4c566a", "#5b6783"] },
    { id: "ocean", name: "Ocean", price: 120, colors: ["#0b3d6b", "#1479b8", "#36c4e8"] },
    { id: "meadow", name: "Meadow", price: 120, colors: ["#0f4d3a", "#1f8f63", "#7be0a8"] },
    { id: "blossom", name: "Blossom", price: 150, colors: ["#7a1f55", "#d9468f", "#ffb3d6"] },
    { id: "midnight", name: "Midnight", price: 200, colors: ["#0a0a23", "#2b1b6b", "#5b3fd1"] },
    { id: "aurora", name: "Aurora", price: 300, colors: ["#0e3b5a", "#2ee6a6", "#b25cff"] },
    { id: "galaxy", name: "Galaxy", price: 450, colors: ["#050514", "#4b1d8f", "#ff4fa3"] },
    { id: "gold", name: "Pure gold", price: 1000, colors: ["#8a6a10", "#f2c94c", "#fff3b0"] },
];

export const getBanner = (id: string | null | undefined): Banner => BANNERS.find((b) => b.id === id) ?? BANNERS[0];

export const STREAK_SAVER_PRICE = 60;
export const MAX_STREAK_SAVERS_HELD = 3;
export const CASE_PRICE = 40;
/** Gems back when a case drops something you already own. */
export const DUPLICATE_REFUND: Record<Rarity, number> = { common: 10, rare: 20, epic: 40, legendary: 80 };

/* ----------------------------------- cases ----------------------------------- */

/** Chance of each rarity, in percent. Sums to 100. */
export const RARITY_ODDS: Record<Rarity, number> = { common: 60, rare: 28, epic: 10, legendary: 2 };

/** Which rarity a roll in [0, 1) lands on. */
export function rarityForRoll(roll: number): Rarity {
    let edge = 0;
    for (const rarity of RARITIES) {
        edge += RARITY_ODDS[rarity] / 100;
        if (roll < edge) return rarity;
    }
    return "legendary";
}

/** What a case drops. `random` is Math.random in the app; tests pass fixed rolls. */
export function openCase(random: () => number = Math.random): Accessory {
    const rarity = rarityForRoll(random());
    const pool = CASE_POOL.filter((a) => a.rarity === rarity);
    return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

/** A free case at every 10 pet levels (10, 20 ... 100). */
export const FREE_CASE_EVERY_LEVELS = 10;
export const freeCasesEarned = (level: number): number => Math.floor(Math.min(level, 100) / FREE_CASE_EVERY_LEVELS);
