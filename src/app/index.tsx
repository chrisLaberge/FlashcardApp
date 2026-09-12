import { useState } from "react";
import { Text, View } from "react-native";
import CardStack from "../components/CardStack";
import { Card } from "../models/Card";
import { Deck } from "../models/Deck";

const deck = new Deck([
  new Card("你好", "Hello"),
  new Card("谢谢", "Thank you"),
  new Card("再见", "Goodbye"),
]);

const completedDeck = new Deck();

export default function HomeScreen() {
  const [currentCard, setCurrentCard] = useState(deck.getNextCard());
  const [nextCard, setNextCard] = useState(deck.peekNext());

  const advance = () => {
    setCurrentCard(deck.getNextCard());
    if (deck.size === 0) {
      setNextCard(undefined);
    } else {
      setNextCard(deck.peekNext());
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      {currentCard ? (
        <CardStack
          currentCard={currentCard}
          nextCard={nextCard}
          onSwipe={(direction) => {
            if (direction === "left") {
              deck.addToBack(currentCard);
            } else {
              completedDeck.addToBack(currentCard);
            }
            advance();
          }}
        />
      ) : (
        <Text>Done!</Text>
      )}
    </View>
  );
}