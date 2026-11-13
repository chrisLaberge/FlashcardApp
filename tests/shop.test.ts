import { TIERS } from "../src/models/Achievements";
import { cleanPetName, isMaxed, MAX_PET_LEVEL, petLevel, petStage, PET_STAGES, stageProgress } from "../src/models/Pet";
import {
    ACCESSORIES, BANNERS, CASE_POOL, freeCasesEarned, gemsForStreak, streakGemsEarned, gemsEarned, GEMS_PER_TIER, getAccessory, getBanner, openCase,
    RARITIES, RARITY_ODDS, rarityForRoll, TIER_COUNT,
} from "../src/models/Shop";
import { streakWithFreezes } from "../src/models/StreakFreeze";

describe("gems", () => {
    test("5 per level gained plus a bonus for every achievement tier", () => {
        expect(gemsEarned(1, [])).toBe(0);
        expect(gemsEarned(11, [])).toBe(50);
        expect(gemsEarned(1, [{ tier: 1 }, { tier: 7 }])).toBe(5 + 500);
    });
    test("one reward per tier, and the tables agree on how many tiers exist", () => {
        expect(GEMS_PER_TIER).toHaveLength(TIERS.length);
        expect(TIER_COUNT).toBe(TIERS.length);
    });
});

describe("pet", () => {
    test("starts as an egg, hatches at 10 and is golden only at level 100", () => {
        expect(petStage(1).id).toBe("egg");
        expect(petStage(9).id).toBe("egg");
        expect(petStage(10).id).toBe("hatchling");
        expect(petStage(99).id).toBe("adult");
        expect(petStage(100).id).toBe("golden");
        expect(isMaxed(99)).toBe(false);
        expect(isMaxed(100)).toBe(true);
    });
    test("levels follow the player's level, between 1 and 100", () => {
        expect(petLevel(0)).toBe(1);
        expect(petLevel(57)).toBe(57);
        expect(petLevel(4000)).toBe(MAX_PET_LEVEL);
        expect(PET_STAGES.map((s) => s.from)).toEqual([...PET_STAGES.map((s) => s.from)].sort((a, b) => a - b));
    });
    test("stage progress goes from 0 to 1", () => {
        expect(stageProgress(1)).toBe(0);
        expect(stageProgress(10)).toBe(0);
        expect(stageProgress(100)).toBe(1);
        expect(stageProgress(17)).toBeGreaterThan(0);
        expect(stageProgress(17)).toBeLessThan(1);
    });
    test("names are cleaned to what the server accepts", () => {
        expect(cleanPetName("  Stompa  ")).toBe("Stompa");
        expect(cleanPetName("<b>Pip</b>")).toBe("bPipb");
        expect(cleanPetName("!!!")).toBe("");
        expect(cleanPetName("x".repeat(40))).toHaveLength(16);
        expect(cleanPetName("Mr  Bean")).toBe("Mr Bean");
    });
});

describe("catalogue and cases", () => {
    test("ids are unique, short lower-case words (the server only accepts those)", () => {
        const ids = [...ACCESSORIES.map((a) => a.id), ...BANNERS.map((b) => b.id)];
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) expect(id).toMatch(/^[a-z0-9_]{1,24}$/);
    });
    test("odds add up to 100 and every rarity has something to win", () => {
        expect(Object.values(RARITY_ODDS).reduce((a, b) => a + b, 0)).toBe(100);
        for (const rarity of RARITIES) expect(CASE_POOL.some((a) => a.rarity === rarity)).toBe(true);
    });
    test("rolls map to rarities by the odds", () => {
        expect(rarityForRoll(0)).toBe("common");
        expect(rarityForRoll(0.59)).toBe("common");
        expect(rarityForRoll(0.6)).toBe("rare");
        expect(rarityForRoll(0.88)).toBe("epic");
        expect(rarityForRoll(0.98)).toBe("legendary");
        expect(rarityForRoll(0.9999)).toBe("legendary");
    });
    test("a case never drops the easter-egg hat, and always drops something", () => {
        let seed = 7;
        const random = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
        for (let i = 0; i < 2000; i++) {
            const item = openCase(random);
            expect(item.id).not.toBe("egghat");
            expect(getAccessory(item.id)).toBe(item);
        }
    });
    test("a free case every time the level goes up", () => {
        expect(freeCasesEarned(1)).toBe(0);
        expect(freeCasesEarned(2)).toBe(1);
        expect(freeCasesEarned(10)).toBe(9);
        expect(freeCasesEarned(250)).toBe(249);
    });
    test("an unknown banner falls back to the plain one", () => {
        expect(getBanner("nope").id).toBe("mist");
        expect(getBanner(null).price).toBe(0);
    });
});

describe("streak savers", () => {
    const days = ["2026-11-01", "2026-11-02", "2026-11-03"]; // then 4th missed, 5th studied
    const studied = [...days, "2026-11-05"];

    test("without a saver the missed day breaks the streak", () => {
        expect(streakWithFreezes(studied, "2026-11-05").current).toBe(1);
    });
    test("a saver bought before the miss covers it, once", () => {
        const run = streakWithFreezes(studied, "2026-11-05", ["2026-11-03"]);
        expect(run.current).toBe(4);
        expect(run.frozenDays).toEqual(["2026-11-04"]);
        expect(run.savers).toBe(0);
    });
    test("a saver bought after the miss cannot rescue a streak that already broke", () => {
        const run = streakWithFreezes(studied, "2026-11-05", ["2026-11-05"]);
        expect(run.current).toBe(1);
        expect(run.savers).toBe(1);
    });
    test("earned freezes are used first, then savers", () => {
        const week = Array.from({ length: 7 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
        const run = streakWithFreezes([...week, "2026-10-10"], "2026-10-10", ["2026-10-01"]); // misses the 8th and 9th
        expect(run.frozenDays).toEqual(["2026-10-08", "2026-10-09"]);
        expect(run.freezes).toBe(0);
        expect(run.savers).toBe(0);
        expect(run.current).toBe(8);
    });
    test("unused savers are counted", () => {
        expect(streakWithFreezes(days, "2026-11-03", ["2026-11-01", "2026-11-02"]).savers).toBe(2);
    });
    test("streak gems grow every week", () => {
        expect(gemsForStreak(6)).toBe(0);
        expect(gemsForStreak(7)).toBe(10);
        expect(gemsForStreak(14)).toBe(30);
        expect(gemsForStreak(21)).toBe(60);
    });
    test("each run of days is paid once, and a gap starts a new run", () => {
        const week = (from: number) => Array.from({ length: 7 }, (_, i) => `2026-03-${String(from + i).padStart(2, "0")}`);
        expect(streakGemsEarned(week(1))).toBe(10);
        expect(streakGemsEarned([...week(1), ...week(10)])).toBe(20); // a gap on the 8th and 9th
        expect(streakGemsEarned([...week(1), ...week(8)])).toBe(30); // no gap: one 14-day streak
        expect(streakGemsEarned([...week(1), ...week(1)])).toBe(10);
    });
});

describe("every accessory can be drawn", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { slotOf } = require("../src/components/pet/Accessories") as typeof import("../src/components/pet/Accessories");
    test("each item has a drawing in the slot the shop says", () => {
        for (const item of ACCESSORIES) expect({ id: item.id, slot: slotOf(item.id) }).toEqual({ id: item.id, slot: item.slot });
    });
});
