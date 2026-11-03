/**
 * Tests against a scheduling-only snapshot of a real flashcards.db export
 * (tests/fixtures/dev-progress-2026-11-03.json, built by scripts/make-progress-fixture.mjs).
 * The snapshot mixes 171 legacy (pre-FSRS) rows with 19 FSRS rows, which is exactly
 * the situation the migration code has to handle.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deserializeFsrsCard, migrateLegacyFsrsCard, scheduleFsrsReview } from "@/models/FsrsScheduler";
import { REVIEW_INTERVALS } from "@/models/SpacedRepetition";
import { DAY, freezeTime, rawDb, seedCard, startApp, stopApp, unfreezeTime } from "./helpers/testDb";

type FixtureRow = {
    card_id: number;
    deck_id: number;
    review_count: number;
    next_review_at: number | null;
    mastered: number;
    fsrs_card: string | null;
    last_review_at: number | null;
};
const fixture = JSON.parse(readFileSync(join(__dirname, "fixtures/dev-progress-2026-11-03.json"), "utf8")) as {
    exportedAt: number;
    cards: FixtureRow[];
};
const NOW = fixture.exportedAt;
const legacyRows = fixture.cards.filter((r) => r.fsrs_card === null);
const fsrsRows = fixture.cards.filter((r) => r.fsrs_card !== null);
const isDue = (r: FixtureRow) => r.next_review_at === null || r.next_review_at <= NOW;

beforeEach(() => freezeTime(NOW));
afterEach(() => {
    stopApp();
    unfreezeTime();
});

async function loadSnapshot() {
    const db = startApp();
    await db.getDecks(); // initialise schema
    const raw = rawDb();
    raw.exec("BEGIN");
    for (const deckId of new Set(fixture.cards.map((r) => r.deck_id))) {
        raw.prepare("INSERT INTO decks (id, name, language) VALUES (?, ?, ?)").run(deckId, `Snapshot deck ${deckId}`, "zh");
    }
    for (const r of fixture.cards) seedCard(raw, r.deck_id, r.card_id, r);
    raw.exec("COMMIT");
    return { db, deckId: fixture.cards[0].deck_id };
}

describe("dev snapshot: data shape", () => {
    test("has the expected mix of legacy and FSRS rows", () => {
        expect(fixture.cards).toHaveLength(190);
        expect(legacyRows).toHaveLength(171);
        expect(fsrsRows).toHaveLength(19);
        expect(fixture.cards.filter((r) => r.mastered === 1)).toHaveLength(93);
    });

    test("every stored FSRS card parses and its due date matches next_review_at", () => {
        for (const row of fsrsRows) {
            const card = deserializeFsrsCard(row.fsrs_card!);
            expect(card.due.getTime()).toBe(row.next_review_at);
        }
    });

    test("'mastered' is exactly 'review_count >= 8' for every row (it carries no extra information)", () => {
        for (const row of fixture.cards) expect(row.mastered === 1).toBe(row.review_count >= 8);
    });
});

describe("dev snapshot: what the app shows at export time", () => {
    test("the learn queue holds 120 due cards, 23 of them mastered", async () => {
        const { db, deckId } = await loadSnapshot();
        const queue = await db.getDueCards(deckId);
        expect(queue).toHaveLength(120);
        expect(new Set(queue.map((c) => c.id)).size).toBe(120); // no duplicates
        const masteredInQueue = fixture.cards.filter((r) => isDue(r) && r.mastered === 1).length;
        expect(masteredInQueue).toBe(23);
    });

    test("the home screen currently counts 97 due cards, hiding the 23 mastered ones", async () => {
        const { db, deckId } = await loadSnapshot();
        expect((await db.getProgressCounts(deckId)).due).toBe(97);
    });

    test.failing("KNOWN BUG: home due count equals the learn queue length on real data", async () => {
        const { db, deckId } = await loadSnapshot();
        expect((await db.getProgressCounts(deckId)).due).toBe((await db.getDueCards(deckId)).length);
    });
});

describe("dev snapshot: migrating legacy progress", () => {
    // A legacy card with review count n was last scheduled REVIEW_INTERVALS[n - 1] ahead.
    const oldIntervalDays = (rc: number) => REVIEW_INTERVALS[Math.min(rc - 1, REVIEW_INTERVALS.length - 1)] / DAY;

    const reviewGood = (row: FixtureRow) => {
        const migrated = migrateLegacyFsrsCard(row.review_count, row.next_review_at ?? undefined, new Date(NOW));
        return scheduleFsrsReview(migrated, "right", new Date(NOW)).card;
    };

    test("every legacy row can be migrated and reviewed without error", () => {
        for (const row of legacyRows) {
            const next = reviewGood(row);
            expect(Number.isFinite(next.due.getTime())).toBe(true);
            expect(next.due.getTime()).toBeGreaterThan(NOW);
        }
    });

    test.failing("KNOWN BUG: answering Good on a due legacy card does not shrink an interval of a week or more", () => {
        const longCards = legacyRows.filter((r) => isDue(r) && r.review_count >= 8); // old interval >= 7 days
        expect(longCards.length).toBeGreaterThan(0);
        for (const row of longCards) {
            const newDays = (reviewGood(row).due.getTime() - NOW) / DAY;
            expect(newDays).toBeGreaterThanOrEqual(oldIntervalDays(row.review_count) * 0.5);
        }
    });
});
