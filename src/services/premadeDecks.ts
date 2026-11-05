import { addCard, addDeck, deleteDeck } from "../database/database";
import type { PremadeDeck } from "../models/PremadeDecks";
import { getRomanization } from "../utils/romanization";

/** Adds a starter deck as a new deck of the user's own. Returns the new deck's id. */
export async function installPremadeDeck(deck: PremadeDeck): Promise<number> {
    const deckId = await addDeck(deck.name, deck.language);
    try {
        for (const card of deck.cards) {
            const romanization = (await getRomanization(card.learning, deck.language).catch(() => null)) ?? "";
            await addCard(card.learning, card.meaning, "", romanization, deckId, { logAdd: false });
        }
    } catch (error) {
        // Never leave a half-filled deck behind.
        await deleteDeck(deckId).catch(() => undefined);
        throw error;
    }
    return deckId;
}
