import {
    getAchievementUnlocks, getInventory, getLedger, getPetState, getReviewLog, recordShopAction, setPetState,
} from "../database/database";
import { bonusXpFor } from "../models/Achievements";
import { cleanPetName, DEFAULT_PET_NAME } from "../models/Pet";
import { totalXp } from "../models/Progression";
import { getAccessory, type Slot } from "../models/Shop";
import { planBanner, planCase, planSaver, shopState, todayKey, type CasePlan, type Plan, type ShopState } from "../models/ShopState";
import { localDay } from "../models/Stats";
import { saveLook } from "./social";

export const EGGS = ["tap", "wait", "name", "night"] as const;
export type EggId = (typeof EGGS)[number];

/** What you have, can wear and can afford right now. */
export async function loadShop(nowMs = Date.now()): Promise<ShopState> {
    const [log, unlocks, ledger, inventory, pet] = await Promise.all([
        getReviewLog(), getAchievementUnlocks(), getLedger(), getInventory(), getPetState(),
    ]);
    const studiedDays = [...new Set(log.map((r) => localDay(r.reviewedAt)))];
    return shopState({ xp: totalXp(log) + bonusXpFor(unlocks), unlocks, ledger, inventory, pet, studiedDays, today: todayKey(nowMs) });
}

/** Sends the pet and banner to the server for friends and the leaderboard. Failures are fine: the next change retries. */
export async function syncLook(state?: ShopState): Promise<void> {
    const current = state ?? (await loadShop());
    try {
        await saveLook(
            { name: current.petName ?? DEFAULT_PET_NAME, hat: current.equipped.hat, glasses: current.equipped.glasses, scarf: current.equipped.scarf },
            current.banner,
        );
    } catch {
        // offline or signed out
    }
}

async function run(plan: Plan): Promise<void> {
    if (plan.ok) await recordShopAction({ ledger: plan.ledger, addItem: plan.addItem });
}

export async function buyBanner(id: string): Promise<Plan> {
    const plan = planBanner(await loadShop(), id);
    await run(plan);
    return plan;
}

export async function buySaver(): Promise<Plan> {
    const plan = planSaver(await loadShop());
    await run(plan);
    return plan;
}

/** Decides and saves a case's prize. The screen then plays the spin and lands on `item`. */
export async function openCaseNow(free: boolean): Promise<CasePlan> {
    const plan = planCase(await loadShop(), free);
    await run(plan);
    return plan;
}

export async function wear(slot: Slot, id: string | null): Promise<void> {
    if (id !== null) {
        const state = await loadShop();
        const item = getAccessory(id);
        if (!item || item.slot !== slot || !state.owned.has(id)) return;
    }
    await setPetState(slot, id);
    void syncLook(); // friends are told in the background; the screen never waits for the network
}

export async function chooseBanner(id: string): Promise<void> {
    const state = await loadShop();
    if (!state.owned.has(id)) return;
    await setPetState("banner", id);
    void syncLook();
}

export async function renamePet(input: string): Promise<string> {
    const name = cleanPetName(input) || DEFAULT_PET_NAME;
    await setPetState("name", name);
    void syncLook();
    return name;
}

/** Records an easter egg. Finding all of them gives the golden egg hat. */
export async function findEgg(id: EggId): Promise<{ isNew: boolean; foundAll: boolean }> {
    const state = await loadShop();
    if (state.eggsFound.includes(id)) return { isNew: false, foundAll: false };
    const found = [...state.eggsFound, id];
    await setPetState("eggs", JSON.stringify(found));
    const foundAll = EGGS.every((egg) => found.includes(egg));
    if (foundAll) await recordShopAction({ ledger: [], addItem: "egghat" });
    return { isNew: true, foundAll };
}

/** The days (YYYY-MM-DD) streak savers were bought. A saver only covers misses from its purchase day on. */
export async function loadSaverDays(): Promise<string[]> {
    const ledger = await getLedger();
    return ledger.filter((l) => l.kind === "saver").map((l) => localDay(l.at));
}
