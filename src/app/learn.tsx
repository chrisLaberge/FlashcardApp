import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Speech from "expo-speech";
import { useCallback, useRef, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CardStack from "../components/CardStack";

import { getTTSLanguageCode } from "@/constants/languages";
import { REVIEW_BATCH_SIZE } from "../config";
import {
  deleteCard,
  getCardProgress,
  getCardsByIds,
  getDecks,
  getDueCardIds,
  markCardCorrect,
  markCardIncorrect,
  restoreCardProgress,
} from "../database/database";
import { useFocusedInterval } from "../hooks/useFocusedInterval";
import { useLearnSettings } from "../hooks/useLearnSettings";
import { Card } from "../models/Card";
import { CardProgress } from "../models/CardProgress";
import { hasVoiceFor } from "../models/StudyMode";
import {
  loadQueue,
  pollDueCards,
  refreshQueuedCards,
  ReviewQueue,
} from "../models/ReviewQueue";

const source = { getDueCardIds, getCardsByIds };

/** When fewer cards than this are waiting, top the queue up straight away instead of waiting for the next poll. */
const REFILL_BELOW = 20;

type HistoryEntry = {
  card: Card;
  direction: "left" | "right";
  previousProgress?: CardProgress;
};

export default function LearnScreen() {
  const insets = useSafeAreaInsets();
  const { settings, loaded: settingsLoaded, update: updateSettings } = useLearnSettings();

  const [sessionStart] = useState(Date.now());
  const [queue] = useState(() => new ReviewQueue());

  // What is on screen. The queue is the source of truth; `show` copies it into state.
  const [currentCard, setCurrentCard] = useState<Card | undefined>();
  const [nextCard, setNextCard] = useState<Card | undefined>();
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [hasDeck, setHasDeck] = useState(true);

  const [reviewedCount, setReviewedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const [selectedDeckId, setSelectedDeckId] = useState<string | undefined>();
  const [ttsCode, setTtsCode] = useState<string | undefined>();
  // Does this phone have a voice for the deck's language? Listening cards need one.
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Bumped when the visible card changes so CardStack remounts cleanly
  const [cardKey, setCardKey] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // True while an answer / undo / delete is being saved: further gestures are ignored.
  const busy = useRef(false);

  /* --------------------------------- Loading -------------------------------- */

  /** Copies the queue into screen state. `remount` restarts the card (needed whenever the card on screen changes). */
  const show = useCallback(
    (remount: boolean) => {
      setCurrentCard(queue.current);
      setNextCard(queue.peekNext());
      if (remount) setCardKey((k) => k + 1);
    },
    [queue],
  );

  const startSession = useCallback(
    async (deckId: number) => {
      await loadQueue(queue, deckId, source, REVIEW_BATCH_SIZE);
      const decks = await getDecks();
      const deck = decks.find((d) => d.id === deckId);

      setSelectedDeckId(String(deckId));
      const code = getTTSLanguageCode(deck?.language ?? "");
      setTtsCode(code);
      try {
        setVoiceAvailable(hasVoiceFor(await Speech.getAvailableVoicesAsync(), code));
      } catch {
        setVoiceAvailable(true); // cannot tell: assume speech works
      }
      setHistory([]);
      setReviewedCount(0);
      setCorrectCount(0);
      setHasDeck(true);
      setLoadedOnce(true);
      show(true);
    },
    [queue, show],
  );

  /**
   * Runs when the screen gains focus, every 10 seconds while it is focused, and when the app
   * returns to the foreground. It never rebuilds the session: it merges what changed in the
   * database into the queue, so the card you are looking at stays where it is.
   */
  const refresh = useCallback(
    async (reason: "focus" | "tick" | "resume") => {
      if (busy.current) return;

      if (reason === "focus") {
        const lastDeckId = await AsyncStorage.getItem("lastDeckId");
        if (!lastDeckId) {
          setHasDeck(false);
          setLoadedOnce(true);
          return;
        }
        if (Number(lastDeckId) !== queue.deckId) {
          await startSession(Number(lastDeckId));
          return;
        }
        // Coming back from the edit / add screens: pick up edits and deletions in place.
        await refreshQueuedCards(queue, source);
        await pollDueCards(queue, source, REVIEW_BATCH_SIZE);
        queue.ensureCurrent();
        show(true);
        return;
      }

      const added = await pollDueCards(queue, source, REVIEW_BATCH_SIZE);
      const startedCurrent = queue.ensureCurrent();
      if (added > 0 || startedCurrent) show(startedCurrent);
    },
    [queue, show, startSession],
  );

  useFocusedInterval(refresh);

  /* -------------------------------- Handlers -------------------------------- */

  /** Runs one save-then-update step; ignores gestures while another is in flight and never leaves the screen frozen. */
  const runExclusive = async (action: () => Promise<void>, errorMessage: string) => {
    if (busy.current) return;
    busy.current = true;
    queue.beginWrite();
    try {
      await action();
    } catch (error) {
      console.error(errorMessage, error);
      Alert.alert("Something went wrong", errorMessage);
      // Put the card back on screen (a swiped card has already slid away).
      show(true);
    } finally {
      queue.endWrite();
      busy.current = false;
    }
    if (queue.upcomingCount < REFILL_BELOW) void refresh("tick");
  };

  const handleSwipe = (direction: "left" | "right") =>
    runExclusive(async () => {
      const card = queue.current;
      if (card?.id === undefined) return;

      // Snapshot progress so the swipe can be undone
      const previousProgress = await getCardProgress(card.id);
      const newLevel =
        direction === "left"
          ? await markCardIncorrect(card.id)
          : await markCardCorrect(card.id);
      // The card may be shown again this session (after Again): it must use its new level.
      if (newLevel !== undefined) card.level = newLevel;

      queue.answer(direction);
      setHistory((h) => [...h, { card, direction, previousProgress }]);
      setReviewedCount((count) => count + 1);
      if (direction === "right") setCorrectCount((count) => count + 1);
      show(true);
    }, "Your answer could not be saved. Please try again.");

  const handleUndo = () =>
    runExclusive(async () => {
      const last = history[history.length - 1];
      if (!last) return;

      // Restore the DB progress to what it was before the swipe
      if (last.previousProgress) {
        await restoreCardProgress(last.previousProgress);
        last.card.level = last.previousProgress.level;
      }

      queue.undo(last.card);
      setHistory((h) => h.slice(0, -1));
      setReviewedCount((c) => c - 1);
      if (last.direction === "right") setCorrectCount((c) => c - 1);
      show(true);
    }, "The last answer could not be undone.");

  const handleDelete = () =>
    runExclusive(async () => {
      const deletedId = queue.current?.id;
      if (deletedId === undefined) return;

      await deleteCard(deletedId);
      queue.discardCurrent();
      setHistory((h) => h.filter((entry) => entry.card.id !== deletedId));
      show(true);
    }, "The card could not be deleted.");

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
    <ActionButton label="↩ Undo" onPress={handleUndo} disabled={undoDisabled} />
  );
  const editButton = <ActionButton label="Edit card" onPress={handleEdit} />;
  const addButton = <ActionButton label="+ Add" onPress={handleAdd} />;

  /* --------------------------------- Screens -------------------------------- */

  // Listening-only cards need sound: switched on, automatic pronunciation on, and a voice for the language.
  const listening = settings.listeningCards && settings.autoSpeak && voiceAvailable;

  // Wait for the stored settings so the first card does not speak when auto-speak is off.
  if (!loadedOnce || !settingsLoaded) {
    return <View style={styles.container} />;
  }

  if (!hasDeck || (!currentCard && reviewedCount === 0)) {
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
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 16,
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => setSettingsOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Learn settings"
          style={({ pressed }) => [styles.gear, pressed && styles.actionButtonPressed]}
        >
          <Ionicons name="settings-outline" size={22} color={COLORS.link} />
        </Pressable>
      </View>

      <View style={styles.cardArea}>
        <CardStack
          currentCard={currentCard}
          nextCard={nextCard}
          cardKey={cardKey}
          onSwipe={handleSwipe}
          onDelete={handleDelete}
          ttsCode={ttsCode}
          autoSpeak={settings.autoSpeak}
          showRomanization={settings.showRomanization}
          listening={listening}
        />
      </View>

      <View style={[styles.actionsRow, styles.mainActions]}>
        {undoButton}
        {editButton}
        {addButton}
      </View>

      <Modal
        visible={settingsOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSettingsOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setSettingsOpen(false)} />

          <View style={styles.settingsSheet}>
            <Text style={styles.settingsTitle}>Learn settings</Text>

            <SettingRow
              label="Automatic pronunciation"
              hint="Speak the word whenever it appears. The speaker button always works."
              value={settings.autoSpeak}
              onChange={(autoSpeak) => updateSettings({ autoSpeak })}
            />
            <SettingRow
              label="Show romanization"
              hint="Pinyin, romaji and similar under the word."
              value={settings.showRomanization}
              onChange={(showRomanization) => updateSettings({ showRomanization })}
            />
            <SettingRow
              label="Listening reviews"
              hint={
                !settings.autoSpeak
                  ? "Needs automatic pronunciation. Off: the word is shown instead."
                  : !voiceAvailable
                    ? "No voice for this language on this phone, so the word is shown instead."
                    : "Sometimes play only the sound, with no text, for words you know well. Off: the word is shown instead."
              }
              value={settings.listeningCards}
              onChange={(listeningCards) => updateSettings({ listeningCards })}
            />

            <Pressable
              onPress={() => setSettingsOpen(false)}
              accessibilityRole="button"
              style={styles.settingsClose}
            >
              <Text style={styles.settingsCloseText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function SettingRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingText}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: COLORS.border, true: COLORS.accent }}
        thumbColor={COLORS.text}
      />
    </View>
  );
}

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
  header: {
    height: 36,
    marginHorizontal: 20,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },

  gear: {
    padding: 6,
  },

  modalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.5)",
  },

  settingsSheet: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 20,
  },

  settingsTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },

  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },

  settingText: {
    flex: 1,
  },

  settingLabel: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "500",
  },

  settingHint: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 2,
  },

  settingsClose: {
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },

  settingsCloseText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: "600",
  },

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