import NavigationButton from "@/components/NavigationButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CardStack from "../components/CardStack";

import {
  deleteCard,
  getDueCards,
  markCardCorrect,
  markCardIncorrect,
} from "../database/database";
import { Card } from "../models/Card";
import { completedDeck, deck } from "../models/DeckManager";

export default function LearnScreen() {
  const insets = useSafeAreaInsets();

  const [sessionStart] = useState(Date.now());

  const [currentCard, setCurrentCard] = useState<Card | undefined>();
  const [nextCard, setNextCard] = useState<Card | undefined>();
  const [noCardsDue, setNoCardsDue] = useState(false);

  const [reviewedCount, setReviewedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const [selectedDeckId, setSelectedDeckId] = useState<string | undefined>();

  /* --------------------------------- Loading -------------------------------- */


  const advance = () => {
    setCurrentCard(deck.getNextCard());
    setNextCard(deck.peekNext());
  };

  const loadCards = useCallback(async () => {
    const lastDeckId =
      await AsyncStorage.getItem("lastDeckId");

    if (!lastDeckId) {
      setNoCardsDue(true);
      return;
    }

    setSelectedDeckId(lastDeckId);

    const cards = await getDueCards(
      Number(lastDeckId)
    );

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
  /* -------------------------------- Handlers -------------------------------- */

  const handleSwipe = async (direction: "left" | "right") => {
    if (currentCard?.id === undefined) return;

    setReviewedCount((count) => count + 1);

    if (direction === "left") {
      await markCardIncorrect(currentCard.id);
      deck.addToBack(currentCard);
    } else {
      setCorrectCount((count) => count + 1);
      await markCardCorrect(currentCard.id);
      completedDeck.addToBack(currentCard);
    }

    advance();
  };

  const handleDelete = async () => {
    if (!currentCard?.id) return;

    await deleteCard(currentCard.id);
    advance();
  };

  const handleEdit = () => {
    if (!currentCard) return;

    router.push({
      pathname: "/editCard",
      params: { id: String(currentCard.id) },
    });
  };

  /* --------------------------------- Screens -------------------------------- */

  if (noCardsDue) {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.messageContainer}>
          <Text style={styles.emptyTitle}>🎉 You're caught up!</Text>

          <Text style={styles.emptySubtitle}>
            Come back when your next cards are ready.
          </Text>
        </View>

        <NavigationButton deckId={selectedDeckId} />
      </View>
    );
  }

  if (!currentCard) {
    const accuracy =
      reviewedCount === 0
        ? 0
        : Math.round((correctCount / reviewedCount) * 100);

    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.messageContainer}>
          <Text style={styles.resultsTitle}>
            Session Complete
          </Text>

          <Text style={styles.resultsSubtitle}>
            Nice work. Here's how you did.
          </Text>

          <View style={styles.mainStatCard}>
            <Text style={styles.mainStatNumber}>
              {accuracy}%
            </Text>

            <Text style={styles.mainStatLabel}>
              Accuracy
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {formatStudyTime(
                  Date.now() - sessionStart
                )}
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

        <NavigationButton deckId={selectedDeckId} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 16,
        },
      ]}
    >
      <View style={styles.cardArea}>
        <CardStack
          currentCard={currentCard}
          nextCard={nextCard}
          onSwipe={handleSwipe}
          onDelete={handleDelete}
        />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.editButton,
          pressed && styles.editButtonPressed,
        ]}
        hitSlop={8}
        onPress={handleEdit}
      >
        <Text style={styles.editText}>
          Edit card
        </Text>
      </Pressable>

      <NavigationButton deckId={selectedDeckId} />
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

const COLORS = {
  background: "#282828",
  surface: "#3c3836",
  border: "#504945",
  text: "#ebdbb2",
  muted: "#a89984",
  accent: "#d79921",
  link: "#83a598",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  centered: {
    justifyContent: "center",
    alignItems: "center",
  },

  messageContainer: {
    width: "90%",
    alignItems: "center",
  },

  cardArea: {
    flex: 1,
    marginHorizontal: 20,
  },

  editButton: {
    alignSelf: "center",
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  editButtonPressed: {
    opacity: 0.5,
  },

  editText: {
    color: COLORS.link,
    fontSize: 14,
    fontWeight: "500",
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },

  emptySubtitle: {
    color: COLORS.muted,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },

  resultsTitle: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 6,
  },

  resultsSubtitle: {
    color: COLORS.muted,
    fontSize: 16,
    marginBottom: 30,
  },

  mainStatCard: {
    width: "100%",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    paddingVertical: 25,
    alignItems: "center",
    marginBottom: 12,
  },

  mainStatNumber: {
    color: COLORS.accent,
    fontSize: 48,
    fontWeight: "bold",
  },

  mainStatLabel: {
    color: COLORS.muted,
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
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    paddingVertical: 20,
    alignItems: "center",
  },

  statNumber: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 5,
  },

  statLabel: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: "center",
  },
});