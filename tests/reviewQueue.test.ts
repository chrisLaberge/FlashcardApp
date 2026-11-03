import { Card } from "@/models/Card";
import {
    DueSource,
    loadQueue,
    pollDueCards,
    refreshQueuedCards,
    REINSERT_POSITION,
    ReviewQueue,
} from "@/models/ReviewQueue";

const card = (id: number, text = `front ${id}`) => new Card(text, `back ${id}`, "", "", id);
const cards = (...ids: number[]) => ids.map((id) => card(id));
const idsOf = (queue: ReviewQueue) => queue.queuedIds();

/** A fake database: `due` is the list of due ids (in review order), `stored` the card rows. */
function fakeSource(due: number[], stored: Card[] = due.map((id) => card(id))) {
    const state = { due: [...due], stored: [...stored] };
    const calls = { ids: [] as number[], rows: [] as number[][] };
    const source: DueSource = {
        async getDueCardIds(_deckId, limit) {
            calls.ids.push(limit);
            return state.due.slice(0, limit);
        },
        async getCardsByIds(ids) {
            calls.rows.push(ids);
            return ids.flatMap((id) => state.stored.filter((c) => c.id === id));
        },
    };
    return { state, calls, source };
}

describe("ReviewQueue: starting and answering", () => {
    test("starts with the first card on screen and ignores duplicate cards", () => {
        const queue = new ReviewQueue();
        queue.start(1, [...cards(1, 2, 3), card(2), card(1)]);
        expect(queue.current?.id).toBe(1);
        expect(idsOf(queue)).toEqual([1, 2, 3]);
        expect(queue.peekNext()?.id).toBe(2);
    });

    test("Good removes the card from the session", () => {
        const queue = new ReviewQueue();
        queue.start(1, cards(1, 2, 3));
        queue.answer("right");
        expect(queue.current?.id).toBe(2);
        expect(queue.has(1)).toBe(false);
        expect(idsOf(queue)).toEqual([2, 3]);
    });

    test("Again puts the card back at the end of a short queue", () => {
        const queue = new ReviewQueue();
        queue.start(1, cards(1, 2, 3));
        queue.answer("left");
        expect(idsOf(queue)).toEqual([2, 3, 1]);
        expect(queue.has(1)).toBe(true);
    });

    test(`Again puts the card ${REINSERT_POSITION} places back in a long queue`, () => {
        const queue = new ReviewQueue();
        queue.start(1, cards(...Array.from({ length: 30 }, (_, i) => i + 1)));
        queue.answer("left");
        const upcoming = idsOf(queue);
        expect(upcoming.indexOf(1)).toBe(REINSERT_POSITION);
        expect(new Set(upcoming).size).toBe(upcoming.length);
    });

    test("Again on the only card shows it again straight away, once", () => {
        const queue = new ReviewQueue();
        queue.start(1, cards(1));
        queue.answer("left");
        expect(queue.current?.id).toBe(1);
        expect(idsOf(queue)).toEqual([1]);
    });

    test("answering the last card leaves nothing on screen", () => {
        const queue = new ReviewQueue();
        queue.start(1, cards(1));
        queue.answer("right");
        expect(queue.current).toBeUndefined();
        expect(queue.queuedIds()).toEqual([]);
    });

    test("deleting the card on screen moves on without it", () => {
        const queue = new ReviewQueue();
        queue.start(1, cards(1, 2));
        queue.discardCurrent();
        expect(queue.current?.id).toBe(2);
        expect(queue.has(1)).toBe(false);
    });
});

describe("ReviewQueue: undo", () => {
    test("undoing Good brings the card back and pushes the current card to the front of the line", () => {
        const queue = new ReviewQueue();
        queue.start(1, cards(1, 2, 3));
        const answered = queue.current!;
        queue.answer("right");
        queue.undo(answered);
        expect(queue.current?.id).toBe(1);
        expect(idsOf(queue)).toEqual([1, 2, 3]);
    });

    test("undoing Again takes the card back out of its later position", () => {
        const queue = new ReviewQueue();
        queue.start(1, cards(1, 2, 3));
        const answered = queue.current!;
        queue.answer("left");
        queue.undo(answered);
        expect(idsOf(queue)).toEqual([1, 2, 3]);
    });

    test("undoing Again when the card came straight back does not duplicate it", () => {
        const queue = new ReviewQueue();
        queue.start(1, cards(1));
        const answered = queue.current!;
        queue.answer("left");
        queue.undo(answered);
        expect(idsOf(queue)).toEqual([1]);
    });

    test("after undoing Good, the card cannot be added a second time", () => {
        const queue = new ReviewQueue();
        queue.start(1, cards(1, 2));
        const answered = queue.current!;
        queue.answer("right");
        queue.undo(answered);
        expect(queue.addDue([card(1)])).toBe(0);
    });
});

describe("ReviewQueue: adding newly due cards", () => {
    test("cards already on screen or waiting are never added again", () => {
        const queue = new ReviewQueue();
        queue.start(1, cards(1, 2));
        expect(queue.addDue(cards(1, 2, 3))).toBe(1);
        expect(idsOf(queue)).toEqual([1, 2, 3]);
    });

    test("a card answered Good can come back when it is due again", () => {
        const queue = new ReviewQueue();
        queue.start(1, cards(1, 2));
        queue.answer("right");
        expect(queue.addDue(cards(1))).toBe(1);
        expect(idsOf(queue)).toEqual([2, 1]);
    });

    test("a finished session picks the new card up", () => {
        const queue = new ReviewQueue();
        queue.start(1, cards(1));
        queue.answer("right");
        expect(queue.current).toBeUndefined();
        queue.addDue(cards(1));
        expect(queue.ensureCurrent()).toBe(true);
        expect(queue.current?.id).toBe(1);
        expect(queue.ensureCurrent()).toBe(false);
    });
});

describe("pollDueCards", () => {
    test("fetches full rows only for ids the queue does not already hold", async () => {
        const { source, calls } = fakeSource([1, 2, 3, 4, 5]);
        const queue = new ReviewQueue();
        queue.start(1, cards(1, 2, 3));
        expect(await pollDueCards(queue, source)).toBe(2);
        expect(calls.rows).toEqual([[4, 5]]);
        expect(idsOf(queue)).toEqual([1, 2, 3, 4, 5]);
    });

    test("does no row query at all when nothing new is due", async () => {
        const { source, calls } = fakeSource([1, 2, 3]);
        const queue = new ReviewQueue();
        queue.start(1, cards(1, 2, 3));
        expect(await pollDueCards(queue, source)).toBe(0);
        expect(calls.rows).toEqual([]);
        expect(calls.ids).toHaveLength(1);
    });

    test("polling over and over never duplicates a card", async () => {
        const { source } = fakeSource([1, 2, 3, 4]);
        const queue = new ReviewQueue();
        queue.start(1, cards(1, 2));
        for (let i = 0; i < 5; i++) await pollDueCards(queue, source);
        expect(idsOf(queue)).toEqual([1, 2, 3, 4]);
    });

    test("does nothing before a session has started", async () => {
        const { source, calls } = fakeSource([1]);
        expect(await pollDueCards(new ReviewQueue(), source)).toBe(0);
        expect(calls.ids).toEqual([]);
    });

    test("does nothing while an answer is being saved", async () => {
        const { source, calls } = fakeSource([1, 2, 3]);
        const queue = new ReviewQueue();
        queue.start(1, cards(1));
        queue.beginWrite();
        expect(await pollDueCards(queue, source)).toBe(0);
        expect(calls.ids).toEqual([]);
        queue.endWrite();
        expect(await pollDueCards(queue, source)).toBe(2);
    });

    test("does nothing when the queue already holds a full batch", async () => {
        const { source, calls } = fakeSource([1, 2, 3, 4]);
        const queue = new ReviewQueue();
        queue.start(1, cards(1, 2, 3, 4));
        expect(await pollDueCards(queue, source, 3)).toBe(0);
        expect(calls.ids).toEqual([]);
    });

    test("asks for enough ids to see past the cards it already holds, and adds at most one batch", async () => {
        const due = Array.from({ length: 50 }, (_, i) => i + 1);
        const { source, calls } = fakeSource(due);
        const queue = new ReviewQueue();
        queue.start(1, cards(1, 2, 3));
        expect(await pollDueCards(queue, source, 10)).toBe(10);
        expect(calls.ids).toEqual([3 + 10]);
        expect(idsOf(queue)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
    });

    test("RACE: an answer saved while the ids are being read cannot bring that card back", async () => {
        // The poll reads the database BEFORE the answer is saved, so its result still lists card 1 as due.
        let releaseRead!: (ids: number[]) => void;
        const slowRead = new Promise<number[]>((resolve) => (releaseRead = resolve));
        const source: DueSource = {
            getDueCardIds: () => slowRead,
            getCardsByIds: async (ids) => ids.map((id) => card(id)),
        };

        const queue = new ReviewQueue();
        queue.start(1, cards(1, 2));
        const poll = pollDueCards(queue, source);

        // Meanwhile the user answers card 1 "Good" and it is saved.
        queue.beginWrite();
        queue.answer("right");
        queue.endWrite();

        releaseRead([1, 2, 3]); // stale: card 1 is no longer due
        expect(await poll).toBe(0);
        expect(idsOf(queue)).toEqual([2]); // card 1 is NOT back, card 3 waits for the next poll
    });

    test("RACE: an answer saved between the id read and the row read also discards the result", async () => {
        let queue!: ReviewQueue;
        const source: DueSource = {
            getDueCardIds: async () => [1, 2, 3],
            getCardsByIds: async (ids) => {
                queue.beginWrite();
                queue.answer("right"); // user swipes while rows are loading
                queue.endWrite();
                return ids.map((id) => card(id));
            },
        };
        queue = new ReviewQueue();
        queue.start(1, cards(1, 2));
        expect(await pollDueCards(queue, source)).toBe(0);
        expect(queue.has(3)).toBe(false);
        expect(queue.has(1)).toBe(false);
    });

    test("a poll started for one deck is discarded if the session switches deck", async () => {
        let releaseRead!: (ids: number[]) => void;
        const source: DueSource = {
            getDueCardIds: () => new Promise((resolve) => (releaseRead = resolve)),
            getCardsByIds: async (ids) => ids.map((id) => card(id)),
        };
        const queue = new ReviewQueue();
        queue.start(1, cards(1));
        const poll = pollDueCards(queue, source);
        queue.start(2, cards(50));
        releaseRead([7, 8]);
        expect(await poll).toBe(0);
        expect(idsOf(queue)).toEqual([50]);
    });
});

describe("loadQueue", () => {
    test("loads only the first batch of a large backlog", async () => {
        const due = Array.from({ length: 250 }, (_, i) => i + 1);
        const { source, calls } = fakeSource(due);
        const queue = new ReviewQueue();
        await loadQueue(queue, 1, source, 100);
        expect(calls.ids).toEqual([100]);
        expect(queue.knownCount).toBe(100);
        expect(queue.current?.id).toBe(1);
    });

    test("refills as the queue runs low, without gaps or repeats", async () => {
        const due = Array.from({ length: 250 }, (_, i) => i + 1);
        const { source, state } = fakeSource(due);
        const queue = new ReviewQueue();
        await loadQueue(queue, 1, source, 100);

        const seen: number[] = [];
        while (queue.current) {
            const answered = queue.current.id!;
            seen.push(answered);
            queue.beginWrite();
            state.due = state.due.filter((id) => id !== answered); // saved: no longer due
            queue.answer("right");
            queue.endWrite();
            if (queue.upcomingCount < 20) await pollDueCards(queue, source, 100);
            queue.ensureCurrent();
        }
        expect(seen).toEqual(due);
    });
});

describe("refreshQueuedCards (edits and deletions made on other screens)", () => {
    test("replaces text in place without changing the order", async () => {
        const { source, state } = fakeSource([1, 2, 3]);
        const queue = new ReviewQueue();
        queue.start(1, cards(1, 2, 3));
        state.stored = [card(1), card(2, "EDITED"), card(3)];
        const currentGone = await refreshQueuedCards(queue, source);
        expect(currentGone).toBe(false);
        expect(idsOf(queue)).toEqual([1, 2, 3]);
        expect(queue.peekNext()?.learningText).toBe("EDITED");
    });

    test("an edit to the card on screen keeps it on screen", async () => {
        const { source, state } = fakeSource([1, 2]);
        const queue = new ReviewQueue();
        queue.start(1, cards(1, 2));
        state.stored = [card(1, "EDITED"), card(2)];
        await refreshQueuedCards(queue, source);
        expect(queue.current?.id).toBe(1);
        expect(queue.current?.learningText).toBe("EDITED");
    });

    test("a deleted card disappears; deleting the one on screen advances to the next", async () => {
        const { source, state } = fakeSource([1, 2, 3]);
        const queue = new ReviewQueue();
        queue.start(1, cards(1, 2, 3));
        state.stored = [card(2), card(3)];
        expect(await refreshQueuedCards(queue, source)).toBe(true);
        expect(queue.current?.id).toBe(2);
        expect(idsOf(queue)).toEqual([2, 3]);
        expect(queue.has(1)).toBe(false);
    });

    test("an empty queue needs no database read", async () => {
        const { source, calls } = fakeSource([]);
        expect(await refreshQueuedCards(new ReviewQueue(), source)).toBe(false);
        expect(calls.rows).toEqual([]);
    });
});
