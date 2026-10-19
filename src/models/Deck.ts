import { Card } from "./Card";

const REINSERT_POSITION = 10;

export class Deck {
    cards: Card[];

    constructor(cards: Card[] = []) {
        this.cards = cards;
    }

    /** Removes and returns the first card. */
    getNextCard(): Card | undefined {
        return this.cards.shift();
    }

    /** Looks at the first card without removing it. */
    peekNext(): Card | undefined {
        return this.cards[0];
    }

    /** Puts a card 10 places back, or at the very back if the deck is shorter. */
    reinsertCard(card: Card): void {
        const position = Math.min(REINSERT_POSITION, this.cards.length);
        this.cards.splice(position, 0, card);
    }

    /** Puts a card at the very front. */
    addToFront(card: Card): void {
        this.cards.unshift(card);
    }

    removeById(id?: number): void {
        const index = this.cards.findIndex((c) => c.id === id);
        if (index !== -1) this.cards.splice(index, 1);
    }

    clear(): void {
        this.cards = [];
    }

    addAtPosition(card: Card, position: number): void {
        this.cards.splice(position, 0, card);
    }

    get size(): number {
        return this.cards.length;
    }
}