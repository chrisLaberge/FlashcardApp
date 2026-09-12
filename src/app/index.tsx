import NavigationButton from "@/components/NavigationButton";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import CardStack from "../components/CardStack";
import { completedDeck, deck } from "../models/DeckManager";

export default function HomeScreen() {
  const [currentCard, setCurrentCard] = useState(deck.getNextCard());
  const [nextCard, setNextCard] = useState(deck.peekNext());

  const advance = () => {
    setCurrentCard(deck.getNextCard());
    setNextCard(deck.peekNext());
  };

  return (
    <View style={styles.container}>
      {currentCard ? (
        <CardStack
          currentCard={currentCard}
          nextCard={nextCard}
          onSwipe={(direction) => {
            if (direction === "left") {
              if (deck.size > 0) {
                deck.addToBack(currentCard);
              }
            } else {
              completedDeck.addToBack(currentCard);
            }

            advance();
          }}
        />
      ) : (
        <Text style={styles.doneText}>Done!</Text>
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