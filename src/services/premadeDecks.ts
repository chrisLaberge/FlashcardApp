import { addCard, addDeck, deleteDeck, getCards } from "../database/database";
import { cardKey, type PremadeCard, type PremadeDeck } from "../models/PremadeDecks";
import { getRomanization } from "../utils/romanization";

/** The words a deck already has, ready for `presentIndexes`. */
export async function existingWords(deckId: number): Promise<Set<string>> {
    return new Set((await getCards(deckId)).map((c) => cardKey(c.learningText)));
}

/** Adds cards to a deck, skipping any word it already has. Returns how many were added. */
export async function addPremadeCards(cards: readonly PremadeCard[], language: string, deckId: number): Promise<number> {
    const have = await existingWords(deckId);
    let added = 0;
    for (const card of cards) {
        const key = cardKey(card.learning);
        if (have.has(key)) continue;
        const romanization = (await getRomanization(card.learning, language).catch(() => null)) ?? "";
        await addCard(card.learning, card.meaning, "", romanization, deckId, { logAdd: false });
        have.add(key);
        added += 1;
    }
    return added;
}

/** Adds a starter deck as a new deck of the user's own. Returns the new deck's id. */
export async function installPremadeDeck(deck: PremadeDeck): Promise<number> {
    const deckId = await addDeck(deck.name, deck.language);
    try {
        await addPremadeCards(deck.cards, deck.language, deckId);
    } catch (error) {
        // Never leave a half-filled deck behind.
        await deleteDeck(deckId).catch(() => undefined);
        throw error;
    }
    return deckId;
}
