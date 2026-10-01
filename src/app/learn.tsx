import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CardStack from "../components/CardStack";

import { getTTSLanguageCode } from "@/constants/languages";
import {
  deleteCard,
  getCardProgress,
  getDecks,
  getDueCards,
  markCardCorrect,
  markCardIncorrect,
  updateCardProgress,
} from "../database/database";
import { Card } from "../models/Card";
import { CardProgress } from "../models/CardProgress";
import { completedDeck, deck } from "../models/DeckManager";

type HistoryEntry = {
  card: Card;
  direction: "left" | "right";
  previousProgress?: CardProgress;
};

export default function LearnScreen() {
  const insets = useSafeAreaInsets();

  const [sessionStart] = useState(Date.now());

  const [currentCard, setCurrentCard] = useState<Card | undefined>();
  const [nextCard, setNextCard] = useState<Card | undefined>();
  const [noCardsDue, setNoCardsDue] = useState(false);

  const [reviewedCount, setReviewedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const [selectedDeckId, setSelectedDeckId] = useState<string | undefined>();
  const [ttsCode, setTtsCode] = useState<string | undefined>();

  // Bumped whenever the visible card changes so CardStack remounts cleanly
  const [cardKey, setCardKey] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const isProcessing = useRef(false);

  /* --------------------------------- Loading -------------------------------- */

  const advance = () => {
    setCurrentCard(deck.getNextCard());
    setNextCard(deck.peekNext());
    setCardKey((k) => k + 1);
    isProcessing.current = false;
  };

  const loadCards = useCallback(async () => {
    const lastDeckId = await AsyncStorage.getItem("lastDeckId");

    if (!lastDeckId) {
      setNoCardsDue(true);
      return;
    }

    setSelectedDeckId(lastDeckId);

    const cards = await getDueCards(Number(lastDeckId));

    deck.clear();
    completedDeck.clear();

    for (const card of cards) {
      deck.addToBack(card);
    }

    if (deck.size === 0) {
      setNoCardsDue(true);
      return;
    }
  const decks = await getDecks();

  const selectedDeck = decks.find(
      (d) => d.id === Number(lastDeckId)
  );

  const ttsCode = getTTSLanguageCode(selectedDeck?.language ?? "");
    
    setTtsCode(ttsCode);
    setNoCardsDue(false);
    setHistory([]);
    isProcessing.current = false;
    setCardKey((k) => k + 1);
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
    isProcessing.current = true;

    // Snapshot progress so the swipe can be undone
    const previousProgress = await getCardProgress(currentCard.id);
    setHistory((h) => [
      ...h,
      { card: currentCard, direction, previousProgress },
    ]);

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

  const handleUndo = async () => {
    if (isProcessing.current) return;

    const last = history[history.length - 1];
    if (!last) return;

    isProcessing.current = true;
    setHistory((h) => h.slice(0, -1));

    const { card, direction, previousProgress } = last;

    // Restore the DB progress to what it was before the swipe
    if (card.id !== undefined && previousProgress) {
      await updateCardProgress(
        card.id,
        previousProgress.reviewCount,
        previousProgress.nextReviewAt,
        previousProgress.mastered
      );
    }

    // Take the card back out of wherever the swipe put it
    if (direction === "left") {
      deck.removeById(card.id);
    } else {
      completedDeck.removeById(card.id);
      setCorrectCount((c) => c - 1);
    }
    setReviewedCount((c) => c - 1);

    // Put the card we were looking at back in line
    if (currentCard && currentCard.id !== card.id) {
      deck.addToFront(currentCard);
    }

    setNoCardsDue(false);
    setCurrentCard(card);
    setNextCard(deck.peekNext());
    setCardKey((k) => k + 1);
    isProcessing.current = false;
  };

  const handleDelete = async () => {
    if (!currentCard?.id) return;

    const deletedId = currentCard.id;

    await deleteCard(deletedId);
    setHistory((h) => h.filter((entry) => entry.card.id !== deletedId));
    advance();
  };

  const handleEdit = () => {
    if (!currentCard) return;

    router.push({
      pathname: "/editCard",
      params: { id: String(currentCard.id) },
    });
  };

  const handleAdd = () => {
    router.push({
      pathname: "/addCard",
      params: { deckId: String(selectedDeckId) },
    });
  };

  /* --------------------------------- Buttons -------------------------------- */

  const undoDisabled = history.length === 0;

  const undoButton = (
    <ActionButton
      label="↩ Undo"
      onPress={handleUndo}
      disabled={undoDisabled}
    />
  );
  const editButton = <ActionButton label="Edit card" onPress={handleEdit} />;
  const addButton = <ActionButton label="+ Add" onPress={handleAdd} />;

  /* --------------------------------- Screens -------------------------------- */

  if (noCardsDue) {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.messageContainer}>
          <Text style={styles.emptyTitle}>🎉 You're caught up!</Text>

          <Text style={styles.emptySubtitle}>
            Come back when your next cards are ready.
          </Text>

          <View style={[styles.actionsRow, styles.singleAction]}>
            {addButton}
          </View>
        </View>
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
          <Text style={styles.resultsTitle}>Session Complete</Text>

          <Text style={styles.resultsSubtitle}>
            Nice work. Here's how you did.
          </Text>

          <View style={styles.mainStatCard}>
            <Text style={styles.mainStatNumber}>{accuracy}%</Text>

            <Text style={styles.mainStatLabel}>Accuracy</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {formatStudyTime(Date.now() - sessionStart)}
              </Text>

              <Text style={styles.statLabel}>Time Spent</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{reviewedCount}</Text>

              <Text style={styles.statLabel}>Total Reviews</Text>
            </View>
          </View>

          <View style={[styles.actionsRow, styles.resultsActions]}>
            {undoButton}
            {addButton}
          </View>
        </View>
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
          cardKey={cardKey}
          onSwipe={handleSwipe}
          onDelete={handleDelete}
          ttsCode={ttsCode}
        />
      </View>

      <View style={[styles.actionsRow, styles.mainActions]}>
        {undoButton}
        {editButton}
        {addButton}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function ActionButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.actionButton,
        (pressed || disabled) && styles.actionButtonPressed,
      ]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
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

  /* Action row: every button gets an equal share of the width */
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },

  mainActions: {
    marginTop: 16,
    marginHorizontal: 20,
  },

  resultsActions: {
    width: "100%",
    marginTop: 24,
  },

  singleAction: {
    width: "50%",
    marginTop: 24,
  },

  actionButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  actionButtonPressed: {
    opacity: 0.5,
  },

  actionText: {
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