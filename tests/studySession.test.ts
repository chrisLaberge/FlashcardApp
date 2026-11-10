import { formatStudyTime, latestSession, MAX_ANSWER_MS, SESSION_GAP_MS, type LoggedReview } from "../src/models/Stats";

const MIN = 60_000;
const NOW = new Date(2026, 10, 10, 12, 0, 0).getTime();
const r = (minutesAgo: number, correct = true, durationMs: number | null = 5000): LoggedReview => ({
    reviewedAt: NOW - minutesAgo * MIN,
    correct,
    durationMs,
});

describe("latestSession", () => {
    test("no reviews, or none recently, means no session", () => {
        expect(latestSession([], NOW)).toBeNull();
        expect(latestSession([r(SESSION_GAP_MS / MIN + 1)], NOW)).toBeNull();
    });

    test("counts the answers, the right ones and the time actually spent", () => {
        const session = latestSession([r(10), r(9, false, 8000), r(8)], NOW)!;
        expect(session).toMatchObject({ reviews: 3, correct: 2, timeMs: 5000 + 8000 + 5000 });
        expect(session.startedAt).toBe(NOW - 10 * MIN);
        expect(session.lastAt).toBe(NOW - 8 * MIN);
    });

    test("leaving for a while inside the same session does not restart it", () => {
        // Studied, left for 20 minutes, came back: still one session.
        const session = latestSession([r(40), r(39), r(19), r(18), r(17)], NOW)!;
        expect(session.reviews).toBe(5);
    });

    test("a gap longer than the limit starts a new session, and only the latest run counts", () => {
        const session = latestSession([r(300), r(299), r(298), r(12), r(11)], NOW)!;
        expect(session.reviews).toBe(2);
    });

    test("a card left on screen does not inflate the time, and unknown times count as zero", () => {
        const session = latestSession([r(5, true, 60 * MIN), r(4, true, null)], NOW)!;
        expect(session.timeMs).toBe(MAX_ANSWER_MS);
    });

    test("input order does not matter", () => {
        expect(latestSession([r(1), r(3), r(2)], NOW)!.startedAt).toBe(NOW - 3 * MIN);
    });
});

describe("formatStudyTime", () => {
    test("seconds, minutes and hours", () => {
        expect(formatStudyTime(38_000)).toBe("38s");
        expect(formatStudyTime(4 * MIN + 12_000)).toBe("4m 12s");
        expect(formatStudyTime(125 * MIN)).toBe("2h 5m");
        expect(formatStudyTime(-5)).toBe("0s");
    });
});
