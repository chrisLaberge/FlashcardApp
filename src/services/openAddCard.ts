import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Alert } from "react-native";
import { getLanguage } from "../constants/languages";
import { getDecks } from "../database/database";
import { targetDeckFor } from "../models/PremadeDecks";

/** Opens the add-card screen for a word of `language`, in your deck for that language (the one you last used, else the first). */
export async function openAddCard(language: string, params: { text: string; meaning?: string; example?: string }): Promise<void> {
    const [decks, last] = await Promise.all([getDecks(), AsyncStorage.getItem("lastDeckId")]);
    const deck = targetDeckFor(decks, language, last ? Number(last) : null);
    if (!deck) {
        Alert.alert(`No ${getLanguage(language)?.name ?? "matching"} deck`, "Create a deck for this language first.");
        return;
    }
    router.push({ pathname: "/addCard", params: { ...params, deckId: String(deck.id) } });
}
