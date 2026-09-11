import { Card } from "./Card";

export class Deck {
    cards: Card[];

    constructor(cards: Card[] = []) {
        this.cards = cards;
    }

    getNextCard(): Card | undefined {
        return this.cards.shift();
    }

    addToBack(card: Card): void {
        this.cards.push(card);
    }

    addAtPosition(card: Card, position: number): void {
        this.cards.splice(position, 0, card);
    }

    get size(): number {
        return this.cards.length;
    }
}