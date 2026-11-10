import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router, useNavigation } from "expo-router";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Alert, Linking, Modal, Platform, StyleSheet, Switch, Text, View } from "react-native";
import Pressable from "../components/Pressable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CardStack from "../components/CardStack";

import { getLanguage, getRemoteVoice, getTTSLanguageCode } from "@/constants/languages";
import { REVIEW_BATCH_SIZE } from "../config";
import {
  deleteCard,
  getCardProgress,
  getCardsByIds,
  getDecks,
  getDueCardIds,
  markCardCorrect,
  markCardIncorrect,
  undoCardReview,
} from "../database/database";
import { scheduleAchievementCheck } from "../services/achievementUnlocks";
import { scheduleGoalCheck, scheduleReminderRefresh } from "../services/dailyGoal";
import { announceStudyScreenLeft, currentSession } from "../services/sessionSummary";
import { formatStudyTime, type StudySession } from "../models/Stats";
import { useFocusedInterval } from "../hooks/useFocusedInterval";
import { useLearnSettings } from "../hooks/useLearnSettings";
import { Card } from "../models/Card";
import { CardProgress } from "../models/CardProgress";
import type { PromptSide } from "../models/StudyMode";
import { chooseVoice, hasVoiceFor } from "../utils/voices";
import {
  loadQueue,
  pollDueCards,
  refreshQueuedCards,
  ReviewQueue,
} from "../models/ReviewQueue";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

const source = { getDueCardIds, getCardsByIds };

/** When fewer cards than this are waiting, top the queue up straight away instead of waiting for the next poll. */
const REFILL_BELOW = 20;

type HistoryEntry = {
  card: Card;
  direction: "left" | "right";
  previousProgress?: CardProgress;
};

export default function LearnScreen() {
  const t = useTheme();
  const COLORS = useMemo(() => makeCOLORS(t), [t]);
  const styles = useMemo(() => makeStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const { settings, loaded: settingsLoaded, update: updateSettings } = useLearnSettings();

  const [queue] = useState(() => new ReviewQueue());

  // What is on screen. The queue is the source of truth; `show` copies it into state.
  const [currentCard, setCurrentCard] = useState<Card | undefined>();
  const [nextCard, setNextCard] = useState<Card | undefined>();
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [hasDeck, setHasDeck] = useState(true);

  // The study session in progress, worked out from the review log so it survives leaving this
  // screen (and coming back), restarting the app and Undo.
  const [session, setSession] = useState<StudySession | null>(null);
  const reviewedCount = session?.reviews ?? 0;
  const correctCount = session?.correct ?? 0;
  const refreshSession = useCallback(() => {
    currentSession()
      .then(setSession)
      .catch(() => undefined);
  }, []);
  useEffect(refreshSession, [refreshSession]);



  const [selectedDeckId, setSelectedDeckId] = useState<string | undefined>();

  // Closing this screen (back, or the tab bar) shows what you did and what is left. Opening the
  // edit or add screen on top of it does not remove it, so that stays quiet.
  const navigation = useNavigation<{ addListener: (event: "beforeRemove", callback: () => void) => () => void }>();
  useEffect(
    () => navigation.addListener("beforeRemove", () => announceStudyScreenLeft(selectedDeckId === undefined ? null : Number(selectedDeckId))),
    [navigation, selectedDeckId],
  );
  const [ttsCode, setTtsCode] = useState<string | undefined>();
  // Does this phone have a voice for the deck's language? Listening cards need one.
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  const [voiceId, setVoiceId] = useState<string | undefined>();
  const [languageName, setLanguageName] = useState("");
  // Languages the phone cannot speak get their audio from the server instead.
  const [remoteVoice, setRemoteVoice] = useState<string | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Bumped when the visible card changes so CardStack remounts cleanly
  const [cardKey, setCardKey] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // True while an answer / undo / delete is being saved: further gestures are ignored.
  const busy = useRef(false);

  // When the card now on screen appeared, to log how long each answer took.
  const shownAt = useRef(0); // set by show() whenever a card appears

  /* --------------------------------- Loading -------------------------------- */

  /** Copies the queue into screen state. `remount` restarts the card (needed whenever the card on screen changes). */
  const show = useCallback(
    (remount: boolean) => {
      setCurrentCard(queue.current);
      setNextCard(queue.peekNext());
      if (remount) {
        shownAt.current = Date.now();
        setCardKey((k) => k + 1);
      }
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
      setLanguageName(getLanguage(deck?.language ?? "")?.name ?? "");
      const remote = getRemoteVoice(deck?.language ?? "");
      setRemoteVoice(remote);
      if (remote) {
        // The server speaks this language: no need to look at the phone's voices.
        setVoiceAvailable(true);
        setVoiceId(undefined);
      } else {
        try {
          const voices = await Speech.getAvailableVoicesAsync();
          setVoiceAvailable(hasVoiceFor(voices, code));
          setVoiceId(chooseVoice(voices, code)?.identifier);
        } catch {
          setVoiceAvailable(true); // cannot tell: assume speech works
          setVoiceId(undefined);
        }
      }
      setHistory([]);
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

  const handleSwipe = (direction: "left" | "right", prompt: PromptSide) =>
    runExclusive(async () => {
      const card = queue.current;
      if (card?.id === undefined) return;

      // Snapshot progress so the swipe can be undone
      const previousProgress = await getCardProgress(card.id);
      const info = { prompt, durationMs: Date.now() - shownAt.current };
      const newLevel =
        direction === "left"
          ? await markCardIncorrect(card.id, info)
          : await markCardCorrect(card.id, info);
      // The card may be shown again this session (after Again): it must use its new level.
      if (newLevel !== undefined) card.level = newLevel;

      queue.answer(direction);
      scheduleAchievementCheck();
      scheduleReminderRefresh();
      scheduleGoalCheck();
      setHistory((h) => [...h, { card, direction, previousProgress }]);
      refreshSession();
      show(true);
    }, "Your answer could not be saved. Please try again.");

  const handleUndo = () =>
    runExclusive(async () => {
      const last = history[history.length - 1];
      if (!last) return;

      // Restore the DB progress to what it was before the swipe
      if (last.previousProgress) {
        await undoCardReview(last.previousProgress);
        last.card.level = last.previousProgress.level;
      }

      queue.undo(last.card);
      setHistory((h) => h.slice(0, -1));
      refreshSession();
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

  /** Opens the phone's text-to-speech settings, where voice data for a language is installed. */
  const openVoiceSettings = async () => {
    try {
      if (Platform.OS === "android") await Linking.sendIntent("com.android.settings.TTS_SETTINGS");
      else await Linking.openSettings();
    } catch {
      Alert.alert(
        "Install a voice",
        "Open Settings, search for \"Text-to-speech output\", and install the voice data for this language.",
      );
    }
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
          <Text style={styles.emptyTitle}>You're caught up</Text>

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
                {formatStudyTime(session?.timeMs ?? 0)}
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

      {!voiceAvailable && (
        <Pressable onPress={openVoiceSettings} style={styles.voiceNotice} accessibilityRole="button">
          <Ionicons name="volume-mute-outline" size={18} color={COLORS.accent} />
          <Text style={styles.voiceNoticeText}>
            No {languageName || "voice"} voice on this phone, so nothing is spoken. Tap to install one.
          </Text>
        </Pressable>
      )}

      <View style={styles.cardArea}>
        <CardStack
          currentCard={currentCard}
          nextCard={nextCard}
          cardKey={cardKey}
          onSwipe={handleSwipe}
          onDelete={handleDelete}
          ttsCode={ttsCode}
          ttsVoice={voiceId}
          remoteVoice={remoteVoice}
          languageName={languageName}
          deckId={selectedDeckId}
          speechAvailable={voiceAvailable}
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
          <Pressable style={styles.backdrop} dim={false} onPress={() => setSettingsOpen(false)} />

          <View style={styles.settingsSheet}>
            <Text style={styles.settingsTitle}>Learn settings</Text>

            <SettingRow
              label="Automatic pronunciation"
              hint="Say each word out loud."
              value={settings.autoSpeak}
              onChange={(autoSpeak) => updateSettings({ autoSpeak })}
            />
            <SettingRow
              label="Show romanization"
              hint="Pinyin, romaji and similar."
              value={settings.showRomanization}
              onChange={(showRomanization) => updateSettings({ showRomanization })}
            />
            <SettingRow
              label="Listening reviews"
              hint={
                !settings.autoSpeak
                  ? "Needs automatic pronunciation."
                  : !voiceAvailable
                    ? "No voice for this language on this phone."
                    : "Sometimes play only the sound."
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
  const t = useTheme();
  const COLORS = useMemo(() => makeCOLORS(t), [t]);
  const styles = useMemo(() => makeStyles(t), [t]);
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
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
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

const makeCOLORS = (t: Palette) => ({
  background: t.bg,
  surface: t.surface,
  border: t.surfaceHigh,
  text: t.text,
  muted: t.muted,
  accent: t.gold,
  link: t.blue,
});

const makeStyles = (t: Palette) => {
    const COLORS = makeCOLORS(t);
    return StyleSheet.create({
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

  voiceNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },

  voiceNoticeText: {
    flex: 1,
    color: COLORS.muted,
    fontSize: 13,
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
    borderRadius: 12,
    padding: 20,
  },

  settingsTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "600",
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
    fontWeight: "600",
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
    fontWeight: "600",
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
    borderRadius: 12,
    paddingVertical: 25,
    alignItems: "center",
    marginBottom: 12,
  },

  mainStatNumber: {
    color: COLORS.accent,
    fontSize: 48,
    fontWeight: "600",
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
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: "center",
  },

  statNumber: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 5,
  },

  statLabel: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: "center",
  },
    });
};