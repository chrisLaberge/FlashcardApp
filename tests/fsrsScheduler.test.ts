import {
    createNewFsrsCard,
    deserializeFsrsCard,
    isMastered,
    legacyIntervalDays,
    migrateLegacyFsrsCard,
    scheduleFsrsReview,
    serializeFsrsCard,
} from "@/models/FsrsScheduler";
import { REVIEW_INTERVALS } from "@/models/SpacedRepetition";
import { Rating, State } from "ts-fsrs";
import { DAY, MINUTE, T0 } from "./helpers/testDb";

const now = new Date(T0);

describe("FSRS scheduler: answers and learning steps", () => {
    test("a new card starts in the New state and is due immediately", () => {
        const card = createNewFsrsCard(now);
        expect(card.state).toBe(State.New);
        expect(card.due.getTime()).toBe(T0);
        expect(card.reps).toBe(0);
    });

    test("swipe left is Again and swipe right is Good", () => {
        const card = createNewFsrsCard(now);
        expect(scheduleFsrsReview(card, "left", now).log.rating).toBe(Rating.Again);
        expect(scheduleFsrsReview(card, "right", now).log.rating).toBe(Rating.Good);
    });

    test("Again on a new card goes to Learning and returns in 1 minute", () => {
        const { card } = scheduleFsrsReview(createNewFsrsCard(now), "left", now);
        expect(card.state).toBe(State.Learning);
        expect(card.due.getTime() - T0).toBe(1 * MINUTE);
    });

    test("Good on a new card moves to the second learning step (10 minutes)", () => {
        const { card } = scheduleFsrsReview(createNewFsrsCard(now), "right", now);
        expect(card.state).toBe(State.Learning);
        expect(card.due.getTime() - T0).toBe(10 * MINUTE);
    });

    test("Good twice graduates a new card to Review with a multi-day interval", () => {
        const first = scheduleFsrsReview(createNewFsrsCard(now), "right", now).card;
        const secondTime = first.due;
        const second = scheduleFsrsReview(first, "right", secondTime).card;
        expect(second.state).toBe(State.Review);
        expect(second.due.getTime() - secondTime.getTime()).toBeGreaterThanOrEqual(DAY);
    });

    test("Again on a Review card lapses it into Relearning, due in 10 minutes", () => {
        const first = scheduleFsrsReview(createNewFsrsCard(now), "right", now).card;
        const review = scheduleFsrsReview(first, "right", first.due).card;
        const lapseTime = review.due;
        const lapsed = scheduleFsrsReview(review, "left", lapseTime).card;
        expect(lapsed.state).toBe(State.Relearning);
        expect(lapsed.lapses).toBe(1);
        expect(lapsed.due.getTime() - lapseTime.getTime()).toBe(10 * MINUTE);
    });
});

describe("FSRS scheduler: persistence round trip", () => {
    test("serialize + deserialize preserves every field and restores Dates", () => {
        const { card } = scheduleFsrsReview(createNewFsrsCard(now), "right", now);
        const restored = deserializeFsrsCard(serializeFsrsCard(card));
        expect(restored.due).toBeInstanceOf(Date);
        expect(restored.last_review).toBeInstanceOf(Date);
        expect(restored.due.getTime()).toBe(card.due.getTime());
        expect(restored.stability).toBe(card.stability);
        expect(restored.difficulty).toBe(card.difficulty);
        expect(restored.state).toBe(card.state);
        expect(restored.reps).toBe(card.reps);
    });

    test("a restored card schedules exactly like the original", () => {
        const { card } = scheduleFsrsReview(createNewFsrsCard(now), "right", now);
        const restored = deserializeFsrsCard(serializeFsrsCard(card));
        const when = card.due;
        const a = scheduleFsrsReview(card, "right", when).card;
        const b = scheduleFsrsReview(restored, "right", when).card;
        expect(b.due.getTime()).toBe(a.due.getTime());
        expect(b.stability).toBe(a.stability);
    });

    test("deserialize tolerates a missing last_review", () => {
        const json = JSON.stringify({ ...createNewFsrsCard(now), last_review: null });
        expect(deserializeFsrsCard(json).last_review).toBeUndefined();
    });
});

describe("migrateLegacyFsrsCard (old fixed-ladder progress -> FSRS)", () => {
    // The old ladder is still in SpacedRepetition.ts, so the interval a legacy card was given
    // is recoverable: a card with review count n was last scheduled REVIEW_INTERVALS[n-1].
    const ladderDays = (reviewCount: number) =>
        REVIEW_INTERVALS[Math.min(reviewCount - 1, REVIEW_INTERVALS.length - 1)] / DAY;

    test("review count 0 stays a New card and keeps any existing due date", () => {
        const card = migrateLegacyFsrsCard(0, T0 - DAY, now);
        expect(card.state).toBe(State.New);
        expect(card.due.getTime()).toBe(T0 - DAY);
    });

    test("legacyIntervalDays follows the old ladder and caps at its last rung", () => {
        expect(legacyIntervalDays(1)).toBeCloseTo(1 / 1440, 6); // 1 minute
        expect(legacyIntervalDays(6)).toBe(1);
        expect(legacyIntervalDays(8)).toBe(7);
        expect(legacyIntervalDays(11)).toBe(60);
        expect(legacyIntervalDays(13)).toBe(180);
        expect(legacyIntervalDays(40)).toBe(180);
    });

    test("a legacy card becomes a Review card whose stability is the interval it was given", () => {
        const card = migrateLegacyFsrsCard(9, T0 + 10 * DAY, now); // 14-day card, 10 days left
        expect(card.state).toBe(State.Review);
        expect(card.reps).toBe(9);
        expect(card.stability).toBeCloseTo(14, 5);
        expect(card.due.getTime()).toBe(T0 + 10 * DAY);
        expect(card.last_review?.getTime()).toBe(T0 + 10 * DAY - 14 * DAY); // due minus interval
    });

    test.each([8, 9, 10, 11, 12, 13])(
        "an overdue legacy card keeps its interval (review count %i)",
        (reviewCount) => {
            const card = migrateLegacyFsrsCard(reviewCount, T0 - 1 * DAY, now);
            expect(card.stability).toBeCloseTo(ladderDays(reviewCount), 5);
        },
    );

    test("a card reviewed exactly when due keeps its interval too", () => {
        expect(migrateLegacyFsrsCard(11, T0, now).stability).toBeCloseTo(60, 5);
    });

    test("cards whose old interval was under a day get a small floor, not zero", () => {
        const card = migrateLegacyFsrsCard(2, T0 - DAY, now); // 3 minutes
        expect(card.stability).toBeCloseTo(0.1, 5);
        expect(card.last_review!.getTime()).toBeLessThanOrEqual(T0);
    });

    test("last_review is never in the future", () => {
        const card = migrateLegacyFsrsCard(11, T0 + 100 * DAY, now);
        expect(card.last_review!.getTime()).toBeLessThanOrEqual(T0);
    });

    test("a 60-day legacy card answered Good is not rescheduled to a couple of days", () => {
        const migrated = migrateLegacyFsrsCard(11, T0 - 1 * DAY, now);
        const next = scheduleFsrsReview(migrated, "right", now).card;
        expect((next.due.getTime() - T0) / DAY).toBeGreaterThanOrEqual(30);
    });

    test("answering Again on a long legacy card lapses it into Relearning, not back to New", () => {
        const migrated = migrateLegacyFsrsCard(11, T0 - 1 * DAY, now);
        const lapsed = scheduleFsrsReview(migrated, "left", now).card;
        expect(lapsed.state).toBe(State.Relearning);
        expect(lapsed.lapses).toBe(1);
    });

    test("converted cards survive the save/load round trip", () => {
        const migrated = migrateLegacyFsrsCard(10, T0 - DAY, now);
        const restored = deserializeFsrsCard(serializeFsrsCard(migrated));
        expect(restored.stability).toBe(migrated.stability);
        expect(restored.last_review?.getTime()).toBe(migrated.last_review?.getTime());
    });
});

describe("isMastered", () => {
    const review = (stability: number, state: State = State.Review) =>
        ({ ...createNewFsrsCard(now), state, stability });

    test("needs the Review state and 21+ days of stability", () => {
        expect(isMastered(review(21))).toBe(true);
        expect(isMastered(review(20.9))).toBe(false);
        expect(isMastered(review(200, State.Relearning))).toBe(false);
        expect(isMastered(review(200, State.Learning))).toBe(false);
        expect(isMastered(createNewFsrsCard(now))).toBe(false);
    });
});
