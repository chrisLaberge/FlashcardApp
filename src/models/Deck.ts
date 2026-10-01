import { Card } from "./Card";

export class Deck {
    cards: Card[];
    constructor(cards: Card[] = []) {
        this.cards = cards;
    }

    getNextCard(): Card | undefined {
        return this.cards.shift();
    }

    peekNext(): Card | undefined {
        return this.cards[0];
    }

    addToBack(card: Card): void {
        this.cards.push(card);
    }

    addToFront(card: Card): void {
    this.cards.unshift(card);
}

removeById(id?: number): void {
    const i = this.cards.findIndex((c) => c.id === id);
    if (i !== -1) this.cards.splice(i, 1);
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