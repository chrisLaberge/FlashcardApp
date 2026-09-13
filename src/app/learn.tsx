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
  const [sessionStart] = useState(Date.now());

  const [currentCard, setCurrentCard] =
    useState<Card | undefined>();

  const [nextCard, setNextCard] =
    useState<Card | undefined>();

  const [noCardsDue, setNoCardsDue] = useState(false);

  const loadCards = useCallback(async () => {
    const cards = await getDueCards();
    deck.clear();

    for (const card of cards) {
      deck.addToBack(card);
    }

    if (deck.size === 0) {
      setNoCardsDue(true);
      return;
    }

    setNoCardsDue(false);



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

  const [reviewedCount, setReviewedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);

  return (
    <View style={styles.container}>
      {noCardsDue ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>
            🎉 You're caught up!
          </Text>

          <Text style={styles.emptySubtitle}>
            Come back when your next cards are ready.
          </Text>
        </View>
      ) : currentCard ? (
        <>
          <CardStack
            currentCard={currentCard}
            nextCard={nextCard}
            onSwipe={async (direction) => {
              if (currentCard.id === undefined) {
                return;
              }

              setReviewedCount((count) => count + 1);

              if (direction === "left") {
                setIncorrectCount((count) => count + 1);

                await markCardIncorrect(currentCard.id);
                deck.addToBack(currentCard);
              } else {
                setCorrectCount((count) => count + 1);

                await markCardCorrect(currentCard.id);
                completedDeck.addToBack(currentCard);
              }

              advance();
            }}
            onDelete={handleDelete}
          />

          <NavigationButton />
        </>
      ) : (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>
            Session Complete
          </Text>

          <Text style={styles.resultsSubtitle}>
            Nice work. Here's how you did.
          </Text>

          <View style={styles.mainStatCard}>
            <Text style={styles.mainStatNumber}>
              {reviewedCount === 0
                ? 0
                : Math.round(
                  (correctCount / reviewedCount) * 100
                )}
              %
            </Text>

            <Text style={styles.mainStatLabel}>
              Accuracy
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {formatStudyTime(Date.now() - sessionStart)}
              </Text>

              <Text style={styles.statLabel}>
                Time Spent
              </Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {reviewedCount}
              </Text>

              <Text style={styles.statLabel}>
                Total Reviews
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function formatStudyTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#282828",
  },
  resultsContainer: {
    width: "90%",
    alignItems: "center",
  },

  resultsTitle: {
    color: "#ebdbb2",
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 6,
  },

  resultsSubtitle: {
    color: "#a89984",
    fontSize: 16,
    marginBottom: 30,
  },

  mainStatCard: {
    width: "100%",
    backgroundColor: "#3c3836",
    borderWidth: 1,
    borderColor: "#504945",
    borderRadius: 15,
    paddingVertical: 25,
    alignItems: "center",
    marginBottom: 12,
  },

  mainStatNumber: {
    color: "#d79921",
    fontSize: 48,
    fontWeight: "bold",
  },

  mainStatLabel: {
    color: "#a89984",
    fontSize: 15,
    marginTop: 4,
  },

  statsRow: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#3c3836",
    borderWidth: 1,
    borderColor: "#504945",
    borderRadius: 15,
    paddingVertical: 20,
    alignItems: "center",
  },

  statNumber: {
    color: "#ebdbb2",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 5,
  },

  statLabel: {
    color: "#a89984",
    fontSize: 13,
    textAlign: "center",
  },

  emptyContainer: {
    width: "90%",
    alignItems: "center",
  },

  emptyTitle: {
    color: "#ebdbb2",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },

  emptySubtitle: {
    color: "#a89984",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
});