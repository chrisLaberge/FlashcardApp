import {
    answerSideFor,
    clampLevel,
    initialLevel,
    MASTERED_START_LEVEL,
    MAX_LEVEL,
    nextLevel,
    pickPromptSide,
    promptMix,
} from "@/models/StudyMode";

const levels = Array.from({ length: MAX_LEVEL + 1 }, (_, i) => i);

describe("prompt mix", () => {
    test("every level's probabilities add up to 1, with and without listening", () => {
        for (const level of levels) {
            for (const listening of [true, false]) {
                const mix = promptMix(level, listening);
                expect(mix.learning + mix.localized + mix.audio).toBeCloseTo(1, 10);
            }
        }
    });

    test("level 0 (the first showing) is recognition only; recall is mixed in from level 1", () => {
        expect(promptMix(0, true)).toEqual({ learning: 1, localized: 0, audio: 0 });
        expect(promptMix(1, true).localized).toBeGreaterThanOrEqual(0.3);
        expect(promptMix(3, true).localized).toBeGreaterThan(promptMix(3, true).learning);
    });

    test("recall (meaning first) only grows with the level, recognition only shrinks", () => {
        for (let level = 1; level <= MAX_LEVEL; level++) {
            expect(promptMix(level, true).localized).toBeGreaterThanOrEqual(promptMix(level - 1, true).localized);
            expect(promptMix(level, true).learning).toBeLessThanOrEqual(promptMix(level - 1, true).learning);
        }
        expect(promptMix(MAX_LEVEL, true).localized).toBeGreaterThan(promptMix(MAX_LEVEL, true).learning);
    });

    test("listening only appears from level 4", () => {
        for (const level of [0, 1, 2, 3]) expect(promptMix(level, true).audio).toBe(0);
        for (const level of [4, 5, 6, 7, 8]) expect(promptMix(level, true).audio).toBeGreaterThan(0);
    });

    test("with listening off the sound share goes back to the learning word", () => {
        for (const level of levels) {
            const on = promptMix(level, true);
            const off = promptMix(level, false);
            expect(off.audio).toBe(0);
            expect(off.localized).toBe(on.localized);
            expect(off.learning).toBeCloseTo(on.learning + on.audio, 10);
        }
    });

    test("out-of-range or missing levels are treated safely", () => {
        expect(promptMix(undefined, true)).toEqual(promptMix(0, true));
        expect(promptMix(-3, true)).toEqual(promptMix(0, true));
        expect(promptMix(99, true)).toEqual(promptMix(MAX_LEVEL, true));
        expect(clampLevel(NaN)).toBe(0);
        expect(clampLevel(2.9)).toBe(2);
    });
});

describe("pickPromptSide", () => {
    test("follows the probabilities (deterministic rolls)", () => {
        // level 4: learning .25, localized .65, audio .10
        expect(pickPromptSide(4, true, () => 0.0)).toBe("learning");
        expect(pickPromptSide(4, true, () => 0.24)).toBe("learning");
        expect(pickPromptSide(4, true, () => 0.26)).toBe("localized");
        expect(pickPromptSide(4, true, () => 0.89)).toBe("localized");
        expect(pickPromptSide(4, true, () => 0.91)).toBe("audio");
        expect(pickPromptSide(4, true, () => 0.999)).toBe("audio");
    });

    test("never returns audio when listening is off, and never anything but learning at level 0", () => {
        for (let i = 0; i < 200; i++) {
            const roll = i / 200;
            expect(pickPromptSide(8, false, () => roll)).not.toBe("audio");
            expect(pickPromptSide(0, true, () => roll)).toBe("learning");
        }
    });

    test("over many random picks the share matches the table", () => {
        let seed = 12345;
        const random = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
        const counts = { learning: 0, localized: 0, audio: 0 };
        const n = 20000;
        for (let i = 0; i < n; i++) counts[pickPromptSide(6, true, random)]++;
        expect(counts.learning / n).toBeCloseTo(0.15, 1);
        expect(counts.localized / n).toBeCloseTo(0.65, 1);
        expect(counts.audio / n).toBeCloseTo(0.2, 1);
    });
});

describe("levels move with answers", () => {
    test("right goes up one, left goes down one, within 0..MAX", () => {
        expect(nextLevel(0, "right")).toBe(1);
        expect(nextLevel(3, "left")).toBe(2);
        expect(nextLevel(0, "left")).toBe(0);
        expect(nextLevel(MAX_LEVEL, "right")).toBe(MAX_LEVEL);
        expect(nextLevel(undefined, "right")).toBe(1);
    });

    test("already-mastered cards start mixed, others at the beginning", () => {
        expect(initialLevel(true)).toBe(MASTERED_START_LEVEL);
        expect(initialLevel(false)).toBe(0);
    });
});

describe("answer side", () => {
    test("what you are asked for is the opposite of what is shown; listening asks for the meaning", () => {
        expect(answerSideFor("learning")).toBe("localized");
        expect(answerSideFor("localized")).toBe("learning");
        expect(answerSideFor("audio")).toBe("localized");
    });
});
