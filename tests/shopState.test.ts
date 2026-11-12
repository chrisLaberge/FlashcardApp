import { CASE_PRICE, STREAK_SAVER_PRICE, MAX_STREAK_SAVERS_HELD } from "../src/models/Shop";
import { planBanner, planCase, planSaver, shopState, type ShopInput } from "../src/models/ShopState";
import { xpToReachLevel } from "../src/models/Progression";

const base = (over: Partial<ShopInput> = {}): ShopInput => ({
    xp: xpToReachLevel(21), // level 21: 100 gems from levels
    unlocks: [],
    ledger: [],
    inventory: [],
    pet: {},
    studiedDays: ["2026-11-01", "2026-11-02"],
    today: "2026-11-03",
    ...over,
});

describe("shopState", () => {
    test("gems are earned (levels + tiers) minus what was spent, refunds counting back", () => {
        const state = shopState(base({
            unlocks: [{ tier: 1 }, { tier: 2 }],
            ledger: [{ itemId: "case", gems: 40, kind: "case", at: 1 }, { itemId: "cap", gems: -10, kind: "refund", at: 1 }],
        }));
        expect(state.level).toBe(21);
        expect(state.gemsEarned).toBe(100 + 5 + 10);
        expect(state.gemsSpent).toBe(30);
        expect(state.gems).toBe(85);
    });

    test("a free case for every level gained, minus the ones opened", () => {
        const level = shopState(base()).level;
        expect(shopState(base()).freeCasesLeft).toBe(level - 1);
        expect(shopState(base({ ledger: [{ itemId: "case", gems: 0, kind: "free_case", at: 1 }] })).freeCasesLeft).toBe(level - 2);
    });

    test("only owned things are worn; the plain banner is always owned", () => {
        const state = shopState(base({ inventory: ["cap"], pet: { hat: "cap", glasses: "shades", scarf: "cap", banner: "aurora", name: "Pip" } }));
        expect(state.equipped).toEqual({ hat: "cap", glasses: null, scarf: null });
        expect(state.banner).toBe("mist");
        expect(state.petName).toBe("Pip");
        expect(shopState(base({ inventory: ["aurora"], pet: { banner: "aurora" } })).banner).toBe("aurora");
    });

    test("bought savers show up until a missed day uses one", () => {
        const bought = [{ itemId: "streak_saver", gems: 60, kind: "saver", at: new Date(2026, 10, 2, 9).getTime() }];
        expect(shopState(base({ ledger: bought })).savers).toBe(1);
        // Missed Nov 3, studied Nov 4: the saver (bought Nov 2) covers it.
        expect(shopState(base({ ledger: bought, studiedDays: ["2026-11-01", "2026-11-02", "2026-11-04"], today: "2026-11-04" })).savers).toBe(0);
    });

    test("found easter eggs are read back, bad data is ignored", () => {
        expect(shopState(base({ pet: { eggs: '["tap","name"]' } })).eggsFound).toEqual(["tap", "name"]);
        expect(shopState(base({ pet: { eggs: "nope" } })).eggsFound).toEqual([]);
    });
});

describe("buying", () => {
    test("banners: must exist, not be owned, and be affordable", () => {
        const rich = shopState(base());
        expect(planBanner(rich, "nope")).toMatchObject({ ok: false });
        expect(planBanner(rich, "mist")).toMatchObject({ ok: false });
        expect(planBanner(shopState(base({ xp: 0 })), "ocean")).toMatchObject({ ok: false });
        const plan = planBanner(shopState(base({ xp: xpToReachLevel(40) })), "ocean");
        expect(plan).toEqual({ ok: true, ledger: [{ itemId: "ocean", gems: 120, kind: "banner" }], addItem: "ocean" });
    });

    test("streak savers: cost gems and at most 3 can be held", () => {
        expect(planSaver(shopState(base({ xp: 0 })))).toMatchObject({ ok: false });
        expect(planSaver(shopState(base()))).toMatchObject({ ok: true, ledger: [{ gems: STREAK_SAVER_PRICE, kind: "saver" }] });
        const held = Array.from({ length: MAX_STREAK_SAVERS_HELD }, () => ({ itemId: "streak_saver", gems: 60, kind: "saver", at: new Date(2026, 10, 1).getTime() }));
        expect(planSaver(shopState(base({ xp: xpToReachLevel(100), ledger: held })))).toMatchObject({ ok: false });
    });

    test("cases: paid ones need gems, free ones need a free case; a duplicate refunds gems and adds nothing", () => {
        expect(planCase(shopState(base({ xp: 0 })), false)).toMatchObject({ ok: false });
        expect(planCase(shopState(base({ xp: 0 })), true)).toMatchObject({ ok: false });

        const paid = planCase(shopState(base()), false, () => 0.1);
        expect(paid).toMatchObject({ ok: true, duplicate: false, ledger: [{ gems: CASE_PRICE, kind: "case" }] });
        expect(paid.ok && paid.addItem).toBe(paid.item!.id);

        const owned = shopState(base({ inventory: [planCase(shopState(base()), false, () => 0.1).item!.id] }));
        const dup = planCase(owned, true, () => 0.1);
        expect(dup).toMatchObject({ ok: true, duplicate: true, addItem: undefined, ledger: [{ kind: "free_case", gems: 0 }, { kind: "refund" }] });
        expect(dup.refund).toBeGreaterThan(0);
    });
});
