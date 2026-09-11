import { useState } from "react";
import { Button, Text, View } from "react-native";
import CardComponent from "../components/CardComponent";
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

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Check if there are more cards in the deck */}
      {currentCard ? (
        <>
          {/* Current Card Component */}
          <CardComponent
            cardData={currentCard}
            onSwipe={(direction) => {
              if (direction === "left") {
                deck.addToBack(currentCard);
              } else {
                completedDeck.addToBack(currentCard);
              }

              setCurrentCard(deck.getNextCard());
            }}
          />

          <Button
            title="Next"
            onPress={() => setCurrentCard(deck.getNextCard())}
          />
        </>
      ) : (
        <Text>Done!</Text>
      )}
    </View>
  );
}