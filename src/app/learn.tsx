import NavigationButton from "@/components/NavigationButton";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import CardStack from "../components/CardStack";

import {
  deleteCard,
  getDueCards,
  markCardCorrect,
  markCardIncorrect,
} from "../database/database";
import { Card } from "../models/Card";
import {
  completedDeck,
  deck,
} from "../models/DeckManager";

export default function LearnScreen() {
  const [currentCard, setCurrentCard] =
    useState<Card | undefined>();

  const [nextCard, setNextCard] =
    useState<Card | undefined>();

  const loadCards = useCallback(async () => {
    const cards = await getDueCards();
    deck.clear();

    for (const card of cards) {
      deck.addToBack(card);
    }

    setCurrentCard(deck.getNextCard());
    setNextCard(deck.peekNext());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCards();
    }, [loadCards])
  );

  const advance = () => {
    setCurrentCard(deck.getNextCard());
    setNextCard(deck.peekNext());
  };

  const handleDelete = async () => {
    if (!currentCard?.id) {
      return;
    }

    await deleteCard(currentCard.id);

    advance();
  };

  return (
    <View style={styles.container}>
      {currentCard ? (
        <CardStack
          currentCard={currentCard}
          nextCard={nextCard}
          onSwipe={async (direction) => {
            if (currentCard.id === undefined) {
              return;
            }

            if (direction === "left") {
              await markCardIncorrect(currentCard.id);

              deck.addToBack(currentCard);
            } else {
              await markCardCorrect(currentCard.id);

              completedDeck.addToBack(currentCard);
            }

            advance();
          }}
          onDelete={handleDelete}
        />
      ) : (
        <Text style={styles.doneText}>
          Done!
        </Text>
      )}

      <NavigationButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#282828",
  },

  doneText: {
    color: "#ebdbb2",
    fontSize: 28,
    fontWeight: "bold",
  },
});