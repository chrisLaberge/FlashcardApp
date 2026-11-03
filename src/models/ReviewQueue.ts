import { REVIEW_BATCH_SIZE } from "../config";
import { Card } from "./Card";

/** Where a card answered "Again" comes back in the session: this many cards later (or at the end). */
export const REINSERT_POSITION = 10;

/** The database calls the queue needs, injected so the logic can be tested without React or SQLite. */
export type DueSource = {
    getDueCardIds(deckId: number, limit: number): Promise<number[]>;
    getCardsByIds(ids: number[]): Promise<Card[]>;
};

/**
 * The cards of one learning session: the card on screen plus the ones waiting behind it.
 *
 * The queue's job is to guarantee that a card is never in it twice. It remembers the id of every
 * card it holds (`known`), so a card that is already queued or on screen is never added again,
 * while a card that was answered "Good" is forgotten and can return when it falls due again.
 *
 * Because the database is read asynchronously, an answer can be saved while a read is in
 * flight. `version` changes on every answer/undo/delete and `hasPendingWrites` is true while
 * one is being saved, so a read that started before such a change can be recognised as stale
 * and thrown away instead of resurrecting a card that was just answered.
 */
export class ReviewQueue {
    deckId?: number;
    /** The card on screen. */
    current?: Card;

    private upcoming: Card[] = [];
    private known = new Set<number>(); // ids of `current` + `upcoming`
    private changeCounter = 0;
    private writesInFlight = 0;

    /* ------------------------------- Inspection ------------------------------ */

    get version(): number {
        return this.changeCounter;
    }

    get hasPendingWrites(): boolean {
        return this.writesInFlight > 0;
    }

    get upcomingCount(): number {
        return this.upcoming.length;
    }

    get knownCount(): number {
        return this.known.size;
    }

    peekNext(): Card | undefined {
        return this.upcoming[0];
    }

    has(id: number): boolean {
        return this.known.has(id);
    }

    /** Ids of every card in the queue, on screen first. */
    queuedIds(): number[] {
        const ids = this.upcoming.flatMap((card) => (card.id === undefined ? [] : [card.id]));
        return this.current?.id === undefined ? ids : [this.current.id, ...ids];
    }

    /* -------------------------------- Lifecycle ------------------------------ */

    /** Starts a fresh session for a deck. Duplicate cards in `cards` are ignored. */
    start(deckId: number, cards: Card[]): void {
        this.deckId = deckId;
        this.current = undefined;
        this.upcoming = [];
        this.known.clear();
        for (const card of cards) this.enqueue(card);
        this.changeCounter++;
        this.advance();
    }

    /** Puts the next waiting card on screen (leaves `current` empty when nothing is waiting). */
    advance(): Card | undefined {
        this.current = this.upcoming.shift();
        return this.current;
    }

    /** Makes sure a card is on screen if one is waiting. Returns true if it had to put one there. */
    ensureCurrent(): boolean {
        if (this.current) return false;
        return this.advance() !== undefined;
    }

    /* --------------------------------- Answers -------------------------------- */

    /**
     * The card on screen was answered. "left" (Again) keeps it in the session, a few cards
     * back; "right" (Good) removes it, so it can return once it is due again.
     */
    answer(direction: "left" | "right"): void {
        const card = this.current;
        if (!card || card.id === undefined) return;

        if (direction === "left") {
            this.upcoming.splice(Math.min(REINSERT_POSITION, this.upcoming.length), 0, card);
        } else {
            this.known.delete(card.id);
        }

        this.changeCounter++;
        this.advance();
    }

    /** Undo: brings an answered card back on screen, whatever the answer did with it. */
    undo(card: Card): void {
        this.upcoming = this.upcoming.filter((queued) => queued.id !== card.id);
        if (this.current && this.current.id !== card.id) this.upcoming.unshift(this.current);
        this.current = card;
        if (card.id !== undefined) this.known.add(card.id);
        this.changeCounter++;
    }

    /** The card on screen was deleted. */
    discardCurrent(): void {
        if (this.current?.id !== undefined) this.known.delete(this.current.id);
        this.changeCounter++;
        this.advance();
    }

    /* ------------------------------- Write guard ------------------------------ */

    /** Call before saving an answer, undo or delete, and `endWrite` when it is done. */
    beginWrite(): void {
        this.writesInFlight++;
        this.changeCounter++;
    }

    endWrite(): void {
        this.writesInFlight = Math.max(0, this.writesInFlight - 1);
        this.changeCounter++;
    }

    /* ----------------------------- Merging database data ---------------------- */

    /** Appends cards that are not already queued. Returns how many were added. */
    addDue(cards: Card[]): number {
        let added = 0;
        for (const card of cards) if (this.enqueue(card)) added++;
        return added;
    }

    /** Replaces queued cards with fresh copies from the database (e.g. after an edit), keeping their place. */
    refreshCards(fresh: Card[]): void {
        const byId = new Map(fresh.flatMap((card) => (card.id === undefined ? [] : [[card.id, card] as const])));
        if (this.current?.id !== undefined) this.current = byId.get(this.current.id) ?? this.current;
        this.upcoming = this.upcoming.map((card) => (card.id === undefined ? card : (byId.get(card.id) ?? card)));
    }

    /**
     * Drops cards that were asked about but no longer exist (deleted on another screen).
     * Returns true if the card on screen was one of them (and the next card is now on screen).
     */
    dropMissing(requestedIds: number[], foundIds: Set<number>): boolean {
        const missing = new Set(requestedIds.filter((id) => !foundIds.has(id)));
        if (missing.size === 0) return false;

        for (const id of missing) this.known.delete(id);
        this.upcoming = this.upcoming.filter((card) => card.id === undefined || !missing.has(card.id));

        const currentGone = this.current?.id !== undefined && missing.has(this.current.id);
        if (currentGone) this.advance();
        this.changeCounter++;
        return currentGone;
    }

    private enqueue(card: Card): boolean {
        if (card.id === undefined || this.known.has(card.id)) return false;
        this.known.add(card.id);
        this.upcoming.push(card);
        return true;
    }
}

/* -------------------------------------------------------------------------- */
/*                       Reading the database into the queue                   */
/* -------------------------------------------------------------------------- */

/** Starts a session for a deck with its first batch of due cards. */
export async function loadQueue(
    queue: ReviewQueue,
    deckId: number,
    source: DueSource,
    batchSize: number = REVIEW_BATCH_SIZE,
): Promise<void> {
    const ids = await source.getDueCardIds(deckId, batchSize);
    const cards = await source.getCardsByIds(ids);
    queue.start(deckId, cards);
}

/**
 * Adds cards that have become due since the session started. Cheap by design: it first asks for
 * ids only, and fetches full rows only for ids the queue does not already hold.
 *
 * Returns how many cards were added. Does nothing (and returns 0) when an answer is being saved,
 * when the queue is already full, or when the queue changed while the database was being read:
 * that result may describe a card that has just been answered, so it is discarded and the next
 * poll tries again.
 */
export async function pollDueCards(
    queue: ReviewQueue,
    source: DueSource,
    batchSize: number = REVIEW_BATCH_SIZE,
): Promise<number> {
    const deckId = queue.deckId;
    if (deckId === undefined || queue.hasPendingWrites || queue.upcomingCount >= batchSize) return 0;

    const version = queue.version;
    const isStale = () => queue.version !== version || queue.deckId !== deckId;

    // Ask for enough ids to see past the cards we already hold.
    const ids = await source.getDueCardIds(deckId, queue.knownCount + batchSize);
    if (isStale()) return 0;

    const fresh = ids.filter((id) => !queue.has(id)).slice(0, batchSize);
    if (fresh.length === 0) return 0;

    const cards = await source.getCardsByIds(fresh);
    if (isStale()) return 0;

    return queue.addDue(cards);
}

/**
 * Picks up edits and deletions made on other screens: replaces queued cards with their current
 * database versions in place (the order of the queue does not change) and drops deleted ones.
 * Returns true if the card on screen was deleted.
 */
export async function refreshQueuedCards(queue: ReviewQueue, source: DueSource): Promise<boolean> {
    const requested = queue.queuedIds();
    if (requested.length === 0) return false;

    const cards = await source.getCardsByIds(requested);
    queue.refreshCards(cards);
    return queue.dropMissing(
        requested,
        new Set(cards.flatMap((card) => (card.id === undefined ? [] : [card.id]))),
    );
}
