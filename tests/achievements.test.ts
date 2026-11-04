import { achievements, achievementValues, TIERS, tierSummary } from "../src/models/Achievements";
import type { LoggedReview } from "../src/models/Stats";

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const NOW = at(2026, 11, 4);

const review = (reviewedAt: number, extra: Partial<LoggedReview> = {}): LoggedReview => ({
    reviewedAt, correct: true, durationMs: 1000, prompt: "learning", ...extra,
});
const many = (count: number, when: number, extra: Partial<LoggedReview> = {}) =>
    Array.from({ length: count }, (_, i) => review(when + i * 1000, extra));
const find = (list: ReturnType<typeof achievements>, id: string) => list.find((a) => a.id === id)!;

describe("achievements", () => {
    test("six tiers, bronze to diamond, with different colours", () => {
        expect(TIERS.map((t) => t.id)).toEqual(["bronze", "silver", "gold", "platinum", "emerald", "diamond"]);
        expect(new Set(TIERS.map((t) => t.color)).size).toBe(6);
    });

    test("every track has six rising targets", () => {
        for (const a of achievements({ reviews: [], cardsAdded: 0, nowMs: NOW })) {
            expect(a.targets).toHaveLength(6);
            expect([...a.targets].sort((x, y) => x - y)).toEqual([...a.targets]);
            expect(new Set(a.targets).size).toBe(6);
        }
    });

    test("with no history nothing is earned and the first goal is shown", () => {
        const list = achievements({ reviews: [], cardsAdded: 0, nowMs: NOW });
        expect(tierSummary(list).earned).toBe(0);
        const reviews = find(list, "reviews");
        expect(reviews).toMatchObject({ tier: 0, value: 0, nextTarget: 10, nextGoal: "Review 10 cards", fraction: 0 });
    });

    test("review tiers: 10 bronze, 100 silver, 1000 gold; progress runs between targets", () => {
        const at10 = find(achievements({ reviews: many(10, NOW), cardsAdded: 0, nowMs: NOW }), "reviews");
        expect(at10).toMatchObject({ tier: 1, nextTarget: 100 });
        const at55 = find(achievements({ reviews: many(55, NOW), cardsAdded: 0, nowMs: NOW }), "reviews");
        expect(at55.tier).toBe(1);
        expect(at55.fraction).toBeCloseTo(0.5, 5); // 45 of the 90 between 10 and 100
        const at100 = find(achievements({ reviews: many(100, NOW), cardsAdded: 0, nowMs: NOW }), "reviews");
        expect(at100).toMatchObject({ tier: 2, nextTarget: 1000 });
    });

    test("the top tier has no next goal and a full bar", () => {
        const list = achievements({ reviews: [], cardsAdded: 5000, nowMs: NOW });
        expect(find(list, "added")).toMatchObject({ tier: 6, nextTarget: null, nextGoal: null, fraction: 1 });
    });

    test("cards added come from the count that is passed in", () => {
        expect(find(achievements({ reviews: [], cardsAdded: 50, nowMs: NOW }), "added").tier).toBe(2);
    });

    test("streak counts the best run ever, even after it broke", () => {
        const days = [1, 2, 3, 4, 5, 6, 7, 8].map((d) => review(at(2026, 10, d)));
        const list = achievements({ reviews: days, cardsAdded: 0, nowMs: NOW });
        expect(achievementValues({ reviews: days, cardsAdded: 0, nowMs: NOW }).streak).toBe(8);
        expect(find(list, "streak").tier).toBe(2); // 3 and 7
        expect(find(list, "days").value).toBe(8);
    });

    test("biggest day, correct answers and prompt types are counted separately", () => {
        const reviews = [
            ...many(20, at(2026, 11, 1), { prompt: "audio" }),
            ...many(5, at(2026, 11, 2), { prompt: "localized" }),
            ...many(3, at(2026, 11, 2), { correct: false, prompt: "audio" }),
        ];
        const v = achievementValues({ reviews, cardsAdded: 0, nowMs: NOW });
        expect(v.bigday).toBe(20);
        expect(v.audio).toBe(20); // wrong answers do not count
        expect(v.localized).toBe(5);
        expect(v.correct).toBe(25);
        expect(v.reviews).toBe(28);
    });

    test("early bird is before 8 am and night owl is 10 pm or later", () => {
        const reviews = [review(at(2026, 11, 1, 7)), review(at(2026, 11, 1, 8)), review(at(2026, 11, 1, 22)), review(at(2026, 11, 1, 23)), review(at(2026, 11, 1, 21))];
        const v = achievementValues({ reviews, cardsAdded: 0, nowMs: NOW });
        expect(v.early).toBe(1);
        expect(v.night).toBe(2);
    });

    test("study time is counted in whole hours", () => {
        const reviews = [review(NOW, { durationMs: 3 * 60 * 60 * 1000 - 1 })];
        expect(achievementValues({ reviews, cardsAdded: 0, nowMs: NOW }).time).toBe(2);
    });

    test("XP and player level follow the same rules as the Progress screen", () => {
        const reviews = many(60, NOW); // 60 x 10 XP = 600 XP: level 4 starts at 600, level 5 at 1000
        const v = achievementValues({ reviews, cardsAdded: 0, nowMs: NOW });
        expect(v.xp).toBe(600);
        expect(v.level).toBe(4);
    });
});
