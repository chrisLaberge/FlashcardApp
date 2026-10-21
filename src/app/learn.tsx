import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CardStack from "../components/CardStack";


import { getTTSLanguageCode } from "@/constants/languages";
import {
  deleteCard,
  getCard,
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

const DUE_CHECK_INTERVAL_MS = 15_000;

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

  // Refs: values that timers / async code must read without going stale
  const isProcessing = useRef(false);
  const isRefreshing = useRef(false);
  const currentCardRef = useRef<Card | undefined>(undefined);
  const deckIdRef = useRef<number | undefined>(undefined);
  // IDs of cards currently in the session (on screen or waiting in `deck`)
  const queuedIds = useRef(new Set<number>());

  /* --------------------------------- Loading -------------------------------- */

  /** Single place that changes the visible card, so state and ref never drift. */
  const showCard = useCallback((card?: Card, next?: Card) => {
    currentCardRef.current = card;
    setCurrentCard(card);
    setNextCard(next);
    setCardKey((k) => k + 1);
  }, []);

  const advance = useCallback(() => {
    showCard(deck.getNextCard(), deck.peekNext());
    isProcessing.current = false;
  }, [showCard]);

  const loadCards = useCallback(async () => {
    const lastDeckId = await AsyncStorage.getItem("lastDeckId");

    if (!lastDeckId) {
      setNoCardsDue(true);
      return;
    }

    const deckId = Number(lastDeckId);
    deckIdRef.current = deckId;
    setSelectedDeckId(lastDeckId);

    const [cards, decks] = await Promise.all([getDueCards(deckId), getDecks()]);

    deck.clear();
    completedDeck.clear();
    queuedIds.current.clear();

    for (const card of cards) {
      deck.reinsertCard(card);
      if (card.id !== undefined) queuedIds.current.add(card.id);
    }

    setHistory([]);
    isProcessing.current = false;

    if (deck.size === 0) {
      showCard(undefined, undefined);
      setNoCardsDue(true);
      return;
    }

    const selectedDeck = decks.find((d) => d.id === deckId);
    setTtsCode(getTTSLanguageCode(selectedDeck?.language ?? ""));

    setNoCardsDue(false);
    showCard(deck.getNextCard(), deck.peekNext());
  }, [showCard]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  const refreshCurrentCard = useCallback(async () => {
    const cardId = currentCardRef.current?.id;

    if (cardId === undefined) return;

    try {
      const updatedCard = await getCard(cardId);

      // Don't update the screen if the user has already moved to another card.
      if (currentCardRef.current?.id !== cardId) return;

      // The card may have been deleted from the Edit screen.
      if (!updatedCard) {
        queuedIds.current.delete(cardId);
        advance();
        return;
      }

      currentCardRef.current = updatedCard;
      setCurrentCard(updatedCard);

      // Remount the card so updated content and any changed image are refreshed.
      setCardKey((key) => key + 1);
    } catch (error) {
      console.error("Failed to refresh card after editing:", error);
    }
  }, [advance]);

  useFocusEffect(
    useCallback(() => {
      void refreshCurrentCard();
    }, [refreshCurrentCard])
  );

  /* ------------------------ Pull in cards that come due ----------------------- */

  const pullInDueCards = useCallback(async () => {
    const deckId = deckIdRef.current;
    if (deckId === undefined || isRefreshing.current) return;

    isRefreshing.current = true;
    try {
      const due = await getDueCards(deckId);

      // A swipe/undo was writing to the DB while we queried, so this result
      // may be stale. Skip; the next tick or swipe will check again.
      if (isProcessing.current) return;



      let added = 0;
      for (const card of due) {
        if (card.id === undefined || queuedIds.current.has(card.id)) continue;

        queuedIds.current.add(card.id);
        completedDeck.removeById(card.id);
        deck.reinsertCard(card); // fresh copy from the DB
        added++;
      }

      if (added > 0) {
        setNoCardsDue(false);
        // Session had run out of cards: pick back up with the new one
        if (!currentCardRef.current) advance();
      }
    } catch (error) {
      console.error("Failed to check for due cards:", error);
    } finally {
      isRefreshing.current = false;
    }
  }, [advance]);

  // pullInDueCards is stable, so this timer is created once per focus
  useFocusEffect(
    useCallback(() => {
      const interval = setInterval(pullInDueCards, DUE_CHECK_INTERVAL_MS);
      return () => clearInterval(interval);
    }, [pullInDueCards])
  );

  /* -------------------------------- Handlers -------------------------------- */

  const handleSwipe = async (direction: "left" | "right") => {
    const card = currentCard;
    if (!card || card.id === undefined || isProcessing.current) return;

    const cardId = card.id;
    isProcessing.current = true;

    try {
      // Snapshot progress so the swipe can be undone
      const previousProgress = await getCardProgress(cardId);
      setHistory((h) => [...h, { card, direction, previousProgress }]);
      setReviewedCount((count) => count + 1);

      if (direction === "left") {
        await markCardIncorrect(cardId);
        deck.reinsertCard(card); // stays queued
      } else {
        await markCardCorrect(cardId);
        setCorrectCount((count) => count + 1);
        completedDeck.reinsertCard(card);
        queuedIds.current.delete(cardId); // no longer in the session
      }
    } finally {
      advance(); // also clears isProcessing
    }

    // A card may have come due while we were studying
    void pullInDueCards();
  };

  const handleUndo = async () => {
    if (isProcessing.current) return;

    const last = history[history.length - 1];
    if (!last) return;

    isProcessing.current = true;
    setHistory((h) => h.slice(0, -1));

    const { card, direction, previousProgress } = last;

    try {
      if (card.id !== undefined) {
        // Restore the DB progress to what it was before the swipe
        if (previousProgress) {
          await updateCardProgress(
            card.id,
            previousProgress.reviewCount,
            previousProgress.nextReviewAt,
            previousProgress.mastered
          );
        }

        // Remove from both piles: a right-swiped card may already have been
        // re-queued into `deck` by pullInDueCards, and we don't want a duplicate.
        deck.removeById(card.id);
        completedDeck.removeById(card.id);
        queuedIds.current.add(card.id); // it's the current card again
      }

      if (direction === "right") setCorrectCount((c) => c - 1);
      setReviewedCount((c) => c - 1);

      // Put the card we were looking at back in line
      const viewing = currentCardRef.current;
      if (viewing && viewing.id !== card.id) {
        deck.addToFront(viewing);
      }

      setNoCardsDue(false);
      showCard(card, deck.peekNext());
    } finally {
      isProcessing.current = false;
    }
  };

  const handleDelete = async () => {
    if (!currentCard || currentCard.id === undefined) return;

    const deletedId = currentCard.id;

    await deleteCard(deletedId);
    queuedIds.current.delete(deletedId);
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

  const undoButton = (
    <ActionButton
      label="↩ Undo"
      onPress={handleUndo}
      disabled={history.length === 0}
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