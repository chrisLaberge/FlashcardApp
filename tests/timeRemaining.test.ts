import { formatTimeRemaining } from "../src/utils/timeRemaining";

const NOW = 1_800_000_000_000;
const MIN = 60_000;

describe("formatTimeRemaining", () => {
    test("due now when there is no date or it has passed", () => {
        expect(formatTimeRemaining(undefined, NOW)).toBe("Now");
        expect(formatTimeRemaining(null, NOW)).toBe("Now");
        expect(formatTimeRemaining(NOW - 5 * MIN, NOW)).toBe("Now");
        expect(formatTimeRemaining(NOW, NOW)).toBe("Now");
    });

    test("minutes, hours and days, rounded up", () => {
        expect(formatTimeRemaining(NOW + 1, NOW)).toBe("1 min");
        expect(formatTimeRemaining(NOW + 59 * MIN, NOW)).toBe("59 min");
        expect(formatTimeRemaining(NOW + 61 * MIN, NOW)).toBe("2 hr");
        expect(formatTimeRemaining(NOW + 23 * 60 * MIN, NOW)).toBe("23 hr");
        expect(formatTimeRemaining(NOW + 24 * 60 * MIN + MIN, NOW)).toBe("2 days");
        expect(formatTimeRemaining(NOW + 24 * 60 * MIN, NOW)).toBe("1 day");
        expect(formatTimeRemaining(NOW + 10 * 24 * 60 * MIN, NOW)).toBe("10 days");
    });
});
