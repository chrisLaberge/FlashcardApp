import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import Papa from "papaparse";
import { useEffect, useRef, useState, useMemo } from "react";
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Pressable from "../components/Pressable";
import {
    addCard,
    deleteCard,
    findDuplicateCard,
    getDecks,
    updateCardProgress,
} from "../database/database";
import { scheduleAchievementCheck } from "../services/achievementUnlocks";
import { REVIEW_INTERVALS } from "../models/SpacedRepetition";
import { getRomanization } from "../utils/romanization";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

/* ---------- Gruvbox dark palette ---------- */
const makeC = (t: Palette) => ({
    bg: t.bg,
    bg1: t.surface,
    bg2: t.surfaceHigh,
    bg3: t.surfaceTop,
    fg: t.text,
    gray: t.muted,
    yellow: t.yellow,
    green: t.green,
    red: t.red,
    orange: t.orange,
    aqua: t.aqua,
});

type CsvCard = {
    learningText: string;
    definition: string;
    example?: string;
    timeTillNextReview?: number;
};

type ExistingCard = {
    id: number;
    learning_text?: string;
    localized_text?: string;
};

type ImportPlan = {
    index: number;
    card: CsvCard;
    conflict?: "database" | "csv";
    existingCard?: ExistingCard;
    duplicateOfIndex?: number;
    action?: "add" | "skip" | "replace" | "rename";
    renamedText?: string;
    renamedDefinition?: string;
    renamedExample?: string;
};

type ImportSummary = {
    added: number;
    replaced: number;
    renamed: number;
    skipped: number;
};

function getReviewCount(reviewTime: number): number {
    let count = 0;

    while (
        count < REVIEW_INTERVALS.length &&
        REVIEW_INTERVALS[count] <= reviewTime
    ) {
        count++;
    }

    return count;
}

function normalize(text: string): string {
    return text.trim().toLocaleLowerCase();
}

/* ---------- Small UI pieces ---------- */

function StatRow({
    label,
    value,
    last,
}: {
    label: string;
    value: number;
    last?: boolean;
}) {
    const t = useTheme();
    const styles = useMemo(() => makeStyles(t), [t]);
    return (
        <View style={[styles.statRow, !last && styles.statDivider]}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>{value}</Text>
        </View>
    );
}

function ChoiceCard({
    tone,
    label,
    word,
    definition,
    example,
    note,
    selected,
    dimmed,
    onPress,
}: {
    tone: "existing" | "imported";
    label: string;
    word: string;
    definition: string;
    example?: string;
    note?: string;
    selected: boolean;
    dimmed: boolean;
    onPress: () => void;
}) {
    const t = useTheme();
    const c = useMemo(() => makeC(t), [t]);
    const styles = useMemo(() => makeStyles(t), [t]);
    const accent = tone === "existing" ? c.aqua : c.yellow;

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.choiceCard,
                tone === "existing"
                    ? styles.choiceExisting
                    : styles.choiceImported,
                selected && { borderColor: accent },
                dimmed && styles.choiceDimmed,
                pressed && styles.choicePressed,
            ]}
        >
            <View style={styles.choiceTop}>
                <Text style={[styles.choiceLabel, { color: accent }]}>
                    {label}
                </Text>
                {selected && (
                    <Text style={[styles.check, { color: accent }]}>✓</Text>
                )}
            </View>
            <Text style={styles.cardWord}>{word}</Text>
            <Text style={styles.cardDefinition}>{definition}</Text>
            {!!example && <Text style={styles.cardExample}>{example}</Text>}
            {!!note && <Text style={styles.cardNote}>{note}</Text>}
        </Pressable>
    );
}

export default function ImportScreen() {
    const t = useTheme();
    const c = useMemo(() => makeC(t), [t]);
    const styles = useMemo(() => makeStyles(t), [t]);
    const [cards, setCards] = useState<CsvCard[]>([]);
    const [plans, setPlans] = useState<ImportPlan[]>([]);
    const [stage, setStage] = useState<
        "preview" | "review" | "confirm" | "summary"
    >("preview");
    const [reviewIndices, setReviewIndices] = useState<number[]>([]);
    const [reviewPosition, setReviewPosition] = useState(0);
    const [renameText, setRenameText] = useState("");
    const [renameDefinition, setRenameDefinition] = useState("");
    const [renameExample, setRenameExample] = useState("");
    const [selected, setSelected] = useState<"existing" | "imported" | null>(
        null
    );
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);
    const [loadingMessage, setLoadingMessage] = useState("");
    const indeterminateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!loading || progress !== null) {
            indeterminateAnim.stopAnimation();
            indeterminateAnim.setValue(0);
            return;
        }

        const animation = Animated.loop(
            Animated.timing(indeterminateAnim, {
                toValue: 1,
                duration: 1100,
                useNativeDriver: true,
            })
        );
        animation.start();
        return () => animation.stop();
    }, [loading, progress, indeterminateAnim]);
    const [summary, setSummary] = useState<ImportSummary>({
        added: 0,
        replaced: 0,
        renamed: 0,
        skipped: 0,
    });

    function fillRename(card: CsvCard) {
        setRenameText(card.learningText);
        setRenameDefinition(card.definition);
        setRenameExample(card.example ?? "");
    }

    const currentPlanIndex = reviewIndices[reviewPosition];
    const currentPlan =
        currentPlanIndex === undefined ? undefined : plans[currentPlanIndex];

    async function selectCsv() {
        if (loading) return;
        setLoading(true);
        setProgress(null);
        setLoadingMessage("Opening and reading CSV...");
        setError("");
        setMessage("");
        setCards([]);
        setPlans([]);
        setStage("preview");

        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
                copyToCacheDirectory: true,
                multiple: false,
            });

            if (result.canceled) return;

            const file = result.assets[0];

            if (!file.name.toLowerCase().endsWith(".csv")) {
                throw new Error("Please select a .csv file.");
            }

            const csvText = await (await fetch(file.uri)).text();

            const parsed = Papa.parse<string[]>(csvText, {
                header: false,
                skipEmptyLines: "greedy",
                transform: (value) => value.trim(),
            });

            if (parsed.errors.length > 0) {
                throw new Error(parsed.errors[0].message);
            }

            let rows = parsed.data;

            if (rows.length > 0) {
                const first = rows[0].map((value) =>
                    value.trim().toLowerCase()
                );

                const learningHeaders = [
                    "learningtext",
                    "learning text",
                    "learning",
                    "word",
                    "term",
                    "front",
                ];

                const definitionHeaders = [
                    "definition",
                    "translation",
                    "meaning",
                    "localizedtext",
                    "localized text",
                    "back",
                ];

                if (
                    learningHeaders.includes(first[0] ?? "") &&
                    definitionHeaders.includes(first[1] ?? "")
                ) {
                    rows = rows.slice(1);
                }
            }

            const importedCards: CsvCard[] = [];

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];

                if (!row.some((value) => value.trim())) continue;

                const learningText = row[0]?.trim();
                const definition = row[1]?.trim();
                const example = row[2]?.trim();
                const rawTime = row[3]?.trim();

                if (!learningText || !definition) {
                    throw new Error(
                        `Row ${i + 1}: the first two columns must contain learning text and definition.`
                    );
                }

                let timeTillNextReview: number | undefined;

                if (rawTime) {
                    timeTillNextReview = Number(rawTime);

                    if (
                        !Number.isFinite(timeTillNextReview) ||
                        timeTillNextReview < 0
                    ) {
                        throw new Error(
                            `Row ${i + 1}: review delay must be a non-negative number of milliseconds.`
                        );
                    }
                }

                importedCards.push({
                    learningText,
                    definition,
                    example: example || undefined,
                    timeTillNextReview,
                });
            }

            if (importedCards.length === 0) {
                throw new Error("No cards were found in this CSV.");
            }

            setCards(importedCards);
            setMessage(`Found ${importedCards.length} cards.`);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Could not read the CSV file."
            );
        } finally {
            setLoading(false);
            setProgress(null);
            setLoadingMessage("");
        }
    }

    async function prepareImport() {
        if (cards.length === 0 || loading) return;

        setLoading(true);
        setProgress(0);
        setLoadingMessage("Checking cards for duplicates...");
        setError("");
        setMessage("");

        try {
            const storedDeckId = await AsyncStorage.getItem("lastDeckId");

            if (!storedDeckId) {
                throw new Error(
                    "No deck selected. Go back and select a deck first."
                );
            }

            const deckId = Number(storedDeckId);

            if (!Number.isInteger(deckId) || deckId <= 0) {
                throw new Error("The selected deck ID is invalid.");
            }

            const decks = await getDecks();
            const selectedDeck = decks.find(
                (deck) => Number(deck.id) === deckId
            );

            if (!selectedDeck) {
                throw new Error(
                    "The selected deck no longer exists. Select a deck again."
                );
            }

            const nextPlans: ImportPlan[] = [];
            const firstCsvIndex = new Map<string, number>();

            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                const key = normalize(card.learningText);
                const previousIndex = firstCsvIndex.get(key);

                if (previousIndex !== undefined) {
                    nextPlans.push({
                        index: i,
                        card,
                        conflict: "csv",
                        duplicateOfIndex: previousIndex,
                    });
                    setProgress(Math.round(((i + 1) / cards.length) * 100));
                    setLoadingMessage(`Checking card ${i + 1} of ${cards.length}...`);
                    continue;
                }

                firstCsvIndex.set(key, i);

                const found = (await findDuplicateCard(
                    card.learningText,
                    deckId
                )) as ExistingCard | null;

                if (found) {
                    nextPlans.push({
                        index: i,
                        card,
                        conflict: "database",
                        existingCard: found,
                    });
                } else {
                    nextPlans.push({
                        index: i,
                        card,
                        action: "add",
                    });
                }

                setProgress(Math.round(((i + 1) / cards.length) * 100));
                setLoadingMessage(`Checking card ${i + 1} of ${cards.length}...`);
            }

            setPlans(nextPlans);

            const indices = nextPlans
                .map((plan, index) => (plan.conflict ? index : -1))
                .filter((index) => index >= 0);

            setReviewIndices(indices);
            setReviewPosition(0);

            if (indices.length > 0) {
                fillRename(nextPlans[indices[0]].card);
                setStage("review");
            } else {
                setStage("confirm");
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Could not check for duplicates."
            );
        } finally {
            setLoading(false);
            setProgress(null);
            setLoadingMessage("");
        }
    }

    function chooseAction(action: "skip" | "replace" | "rename") {
        if (!currentPlan) return;

        const updated = [...plans];
        const current = { ...updated[currentPlanIndex] };

        if (action === "rename") {
            const name = renameText.trim();

            if (!name) {
                setError("Enter a new learning text first.");
                return;
            }

            if (normalize(name) === normalize(current.card.learningText)) {
                setError("Choose a different learning text.");
                return;
            }

            const definition = renameDefinition.trim();

            if (!definition) {
                setError("Enter a definition first.");
                return;
            }

            current.renamedText = name;
            current.renamedDefinition = definition;
            current.renamedExample = renameExample.trim();
        }

        current.action = action;
        updated[currentPlanIndex] = current;

        setPlans(updated);
        setError("");
        setSelected(null);

        if (reviewPosition + 1 < reviewIndices.length) {
            const nextPosition = reviewPosition + 1;
            setReviewPosition(nextPosition);
            fillRename(updated[reviewIndices[nextPosition]].card);
        } else {
            setStage("confirm");
        }
    }

    async function commitImport() {
        if (loading || plans.length === 0) return;

        setLoading(true);
        setProgress(0);
        setLoadingMessage("Importing cards...");
        setError("");
        setMessage("");

        try {
            const storedDeckId = await AsyncStorage.getItem("lastDeckId");

            if (!storedDeckId) {
                throw new Error("No deck selected.");
            }

            const deckId = Number(storedDeckId);
            const decks = await getDecks();
            const selectedDeck = decks.find(
                (deck) => Number(deck.id) === deckId
            );

            if (!selectedDeck) {
                throw new Error("The selected deck no longer exists.");
            }

            const result: ImportSummary = {
                added: 0,
                replaced: 0,
                renamed: 0,
                skipped: 0,
            };

            const csvReplacements = new Map<number, ImportPlan>();
            const replacedCsvIndices = new Set<number>();

            for (const plan of plans) {
                if (
                    plan.conflict === "csv" &&
                    plan.action === "replace" &&
                    plan.duplicateOfIndex !== undefined
                ) {
                    csvReplacements.set(plan.duplicateOfIndex, plan);
                    replacedCsvIndices.add(plan.index);
                }
            }

            for (let i = 0; i < plans.length; i++) {
                if (replacedCsvIndices.has(i)) {
                    setProgress(Math.round(((i + 1) / plans.length) * 100));
                    setLoadingMessage(`Processing card ${i + 1} of ${plans.length}...`);
                    continue;
                }

                let plan = plans[i];

                if (replacedCsvIndices.has(plan.index)) {
                    setProgress(Math.round(((i + 1) / plans.length) * 100));
                    setLoadingMessage(`Processing card ${i + 1} of ${plans.length}...`);
                    continue;
                }

                const csvReplacement = csvReplacements.get(i);
                if (csvReplacement) {
                    plan = csvReplacement;
                }

                if (plan.action === "skip") {
                    result.skipped++;
                    setProgress(Math.round(((i + 1) / plans.length) * 100));
                    setLoadingMessage(`Processing card ${i + 1} of ${plans.length}...`);
                    continue;
                }

                if (plan.conflict === "csv" && plan.action === "replace") {
                    // The later CSV row replaces the earlier staged row.
                    // No existing database card is deleted here.
                } else if (
                    plan.conflict === "database" &&
                    plan.action === "replace"
                ) {
                    if (!plan.existingCard) {
                        throw new Error("Could not identify the card to replace.");
                    }

                    await deleteCard(Number(plan.existingCard.id));
                    result.replaced++;
                } else if (plan.action === "rename") {
                    result.renamed++;
                } else {
                    result.added++;
                }

                const learningText =
                    plan.action === "rename"
                        ? plan.renamedText!.trim()
                        : plan.card.learningText;

                const definition =
                    plan.action === "rename"
                        ? plan.renamedDefinition!
                        : plan.card.definition;

                const example =
                    plan.action === "rename"
                        ? plan.renamedExample ?? ""
                        : plan.card.example ?? "";

                const romanization = await getRomanization(
                    learningText,
                    selectedDeck.language
                );

                scheduleAchievementCheck();
                const cardId = await addCard(
                    learningText,
                    definition,
                    example,
                    romanization ?? "",
                    deckId
                );

                if (plan.card.timeTillNextReview !== undefined) {
                    const reviewCount = getReviewCount(
                        plan.card.timeTillNextReview
                    );

                    await updateCardProgress(
                        Number(cardId),
                        reviewCount,
                        Date.now() + plan.card.timeTillNextReview,
                        reviewCount >= 8
                    );
                }

                setProgress(Math.round(((i + 1) / plans.length) * 100));
                setLoadingMessage(`Importing card ${i + 1} of ${plans.length}...`);
            }

            setSummary(result);
            setCards([]);
            setPlans([]);
            setStage("summary");
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to import cards."
            );
        } finally {
            setLoading(false);
            setProgress(null);
            setLoadingMessage("");
        }
    }

    function startOver() {
        setCards([]);
        setPlans([]);
        setReviewIndices([]);
        setReviewPosition(0);
        setError("");
        setMessage("");
        setStage("preview");
    }

    const plannedCounts = plans.reduce(
        (counts, plan) => {
            if (plan.action === "skip") {
                counts.skipped++;
            } else if (
                plan.action === "replace" &&
                plan.conflict === "database"
            ) {
                counts.replaced++;
            } else if (plan.action === "rename") {
                counts.renamed++;
            } else if (plan.action === "replace" && plan.conflict === "csv") {
                // Replaces an earlier CSV row, not a database card.
            } else if (plan.conflict !== "csv" || plan.action !== undefined) {
                counts.added++;
            }

            return counts;
        },
        { added: 0, replaced: 0, renamed: 0, skipped: 0 }
    );

    const title =
        stage === "preview"
            ? "Import CSV"
            : stage === "review"
                ? "Duplicates"
                : stage === "confirm"
                    ? "Confirm"
                    : "Done";

    // What the "existing" side of a duplicate shows
    const csvOriginal =
        currentPlan?.duplicateOfIndex !== undefined
            ? plans[currentPlan.duplicateOfIndex]?.card
            : undefined;

    const existingWord =
        currentPlan?.existingCard?.learning_text ??
        csvOriginal?.learningText ??
        "—";
    const existingDefinition =
        currentPlan?.existingCard?.localized_text ??
        csvOriginal?.definition ??
        "—";
    const existingLabel =
        currentPlan?.conflict === "csv" ? "Earlier in CSV" : "In your deck";

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable
                    onPress={() => router.back()}
                    hitSlop={12}
                    style={styles.backButton}
                >
                    <Text style={styles.backText}>←</Text>
                </Pressable>
                <Text style={styles.title}>{title}</Text>
            </View>

            {/* Status line (shown once, for every stage) */}
            {!!error && <Text style={styles.error}>{error}</Text>}
            {!error && !!message && stage === "preview" && (
                <Text style={styles.message}>{message}</Text>
            )}
            {loading && (
                <View style={styles.progressContainer}>
                    <View style={styles.progressHeading}>
                        <Text style={styles.progressLabel}>{loadingMessage}</Text>
                        {progress !== null && (
                            <Text style={styles.progressPercent}>{progress}%</Text>
                        )}
                    </View>
                    <View style={styles.progressTrack}>
                        <Animated.View
                            style={[
                                styles.progressFill,
                                progress === null
                                    ? [
                                        styles.progressIndeterminate,
                                        {
                                            transform: [
                                                {
                                                    translateX: indeterminateAnim.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: [-120, 320],
                                                    }),
                                                },
                                            ],
                                        },
                                    ]
                                    : { width: `${progress}%` },
                            ]}
                        />
                    </View>
                </View>
            )}

            {/* ---------- Preview ---------- */}
            {stage === "preview" && (
                <View style={styles.body}>
                    {cards.length === 0 ? (
                        <View style={styles.empty}>
                            <Text style={styles.emptyText}>
                                Choose a CSV with learning text, definition,
                                and optionally an example.
                            </Text>
                            <Pressable
                                style={styles.primaryButton}
                                onPress={selectCsv}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color={c.bg} />
                                ) : (
                                    <Text style={styles.primaryText}>Choose CSV</Text>
                                )}
                            </Pressable>
                        </View>
                    ) : (
                        <>
                            <ScrollView
                                style={styles.list}
                                contentContainerStyle={styles.listContent}
                            >
                                {cards.slice(0, 10).map((card, index) => (
                                    <View key={index} style={styles.listItem}>
                                        <Text style={styles.itemWord}>
                                            {card.learningText}
                                        </Text>
                                        <Text style={styles.itemDefinition}>
                                            {card.definition}
                                        </Text>
                                    </View>
                                ))}
                                {cards.length > 10 && (
                                    <Text style={styles.muted}>
                                        +{cards.length - 10} more
                                    </Text>
                                )}
                            </ScrollView>

                            <View style={styles.footer}>
                                <Pressable
                                    style={styles.primaryButton}
                                    onPress={prepareImport}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color={c.bg} />
                                    ) : (
                                        <Text style={styles.primaryText}>
                                            Continue
                                        </Text>
                                    )}
                                </Pressable>
                                <Pressable
                                    style={styles.secondaryButton}
                                    onPress={selectCsv}
                                    disabled={loading}
                                >
                                    <Text style={styles.secondaryText}>
                                        Choose a different file
                                    </Text>
                                </Pressable>
                            </View>
                        </>
                    )}
                </View>
            )}

            {/* ---------- Review duplicates ---------- */}
            {stage === "review" && currentPlan && (
                <ScrollView
                    style={styles.body}
                    contentContainerStyle={styles.reviewContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={styles.muted}>
                        {reviewPosition + 1} of {reviewIndices.length}. Tap the
                        card you want to keep.
                    </Text>

                    <View style={styles.cardRow}>
                        <ChoiceCard
                            tone="existing"
                            label={existingLabel}
                            word={existingWord}
                            definition={existingDefinition}
                            selected={selected === "existing"}
                            dimmed={selected === "imported"}
                            onPress={() => setSelected("existing")}
                        />
                        <ChoiceCard
                            tone="imported"
                            label="Importing"
                            word={currentPlan.card.learningText}
                            definition={currentPlan.card.definition}
                            example={currentPlan.card.example}
                            note={
                                currentPlan.card.timeTillNextReview !== undefined
                                    ? "Includes review schedule"
                                    : undefined
                            }
                            selected={selected === "imported"}
                            dimmed={selected === "existing"}
                            onPress={() => setSelected("imported")}
                        />
                    </View>

                    <Pressable
                        style={[
                            styles.primaryButton,
                            !selected && styles.primaryDisabled,
                        ]}
                        onPress={() =>
                            selected &&
                            chooseAction(
                                selected === "existing" ? "skip" : "replace"
                            )
                        }
                        disabled={!selected || loading}
                    >
                        <Text style={styles.primaryText}>Next</Text>
                    </Pressable>

                    <View style={styles.renameBox}>
                        <TextInput
                            style={styles.input}
                            value={renameText}
                            onChangeText={setRenameText}
                            placeholder="Learning text"
                            placeholderTextColor={c.bg3}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <TextInput
                            style={[styles.input, styles.inputMulti]}
                            value={renameDefinition}
                            onChangeText={setRenameDefinition}
                            placeholder="Definition"
                            placeholderTextColor={c.bg3}
                            multiline
                        />
                        <TextInput
                            style={[styles.input, styles.inputMulti]}
                            value={renameExample}
                            onChangeText={setRenameExample}
                            placeholder="Example (optional)"
                            placeholderTextColor={c.bg3}
                            multiline
                        />
                        <Pressable
                            style={({ pressed }) => [
                                styles.renameButton,
                                pressed && styles.choicePressed,
                            ]}
                            onPress={() => chooseAction("rename")}
                            disabled={loading}
                        >
                            <Text style={styles.renameText}>Rename</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            )}

            {/* ---------- Confirm ---------- */}
            {stage === "confirm" && (
                <View style={styles.body}>
                    <View style={styles.stats}>
                        <StatRow label="New" value={plannedCounts.added} />
                        <StatRow label="Replaced" value={plannedCounts.replaced} />
                        <StatRow label="Renamed" value={plannedCounts.renamed} />
                        <StatRow
                            label="Skipped"
                            value={plannedCounts.skipped}
                            last
                        />
                    </View>

                    <View style={styles.footer}>
                        <Pressable
                            style={styles.primaryButton}
                            onPress={commitImport}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={c.bg} />
                            ) : (
                                <Text style={styles.primaryText}>Import</Text>
                            )}
                        </Pressable>
                        <Pressable
                            style={styles.secondaryButton}
                            onPress={() => {
                                if (reviewIndices.length > 0) {
                                    setReviewPosition(0);
                                    fillRename(plans[reviewIndices[0]].card);
                                    // allow choosing again
                                    setPlans(
                                        plans.map((p) =>
                                            p.conflict
                                                ? {
                                                    ...p,
                                                    action: undefined,
                                                    renamedText: undefined,
                                                }
                                                : p
                                        )
                                    );
                                    setStage("review");
                                } else {
                                    setStage("preview");
                                }
                            }}
                            disabled={loading}
                        >
                            <Text style={styles.secondaryText}>Back</Text>
                        </Pressable>
                    </View>
                </View>
            )}

            {/* ---------- Summary ---------- */}
            {stage === "summary" && (
                <View style={styles.body}>
                    <View style={styles.stats}>
                        <StatRow label="Added" value={summary.added} />
                        <StatRow label="Replaced" value={summary.replaced} />
                        <StatRow label="Renamed" value={summary.renamed} />
                        <StatRow label="Skipped" value={summary.skipped} last />
                    </View>

                    <View style={styles.footer}>
                        <Pressable
                            style={styles.primaryButton}
                            onPress={() => router.back()}
                        >
                            <Text style={styles.primaryText}>Done</Text>
                        </Pressable>
                        <Pressable
                            style={styles.secondaryButton}
                            onPress={startOver}
                        >
                            <Text style={styles.secondaryText}>
                                Import another
                            </Text>
                        </Pressable>
                    </View>
                </View>
            )}
        </View>
    );
}

const makeStyles = (t: Palette) => {
    const c = makeC(t);
    return StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: c.bg,
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 24,
    },
    body: {
        flex: 1,
    },

    /* Header */
    header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 20,
    },
    backButton: {
        marginRight: 16,
    },
    backText: {
        color: c.yellow,
        fontSize: 24,
    },
    title: {
        color: c.fg,
        fontSize: 24,
        fontWeight: "600",
    },

    /* Status */
    error: {
        color: c.red,
        marginBottom: 12,
    },
    message: {
        color: c.green,
        marginBottom: 12,
    },
    muted: {
        color: c.gray,
        fontSize: 14,
    },
    progressContainer: {
        backgroundColor: c.bg1,
        borderRadius: 10,
        padding: 14,
        marginBottom: 16,
        gap: 10,
    },
    progressHeading: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },
    progressLabel: {
        color: c.fg,
        fontSize: 14,
        flex: 1,
    },
    progressPercent: {
        color: c.yellow,
        fontSize: 14,
        fontWeight: "600",
    },
    progressTrack: {
        height: 8,
        backgroundColor: c.bg2,
        borderRadius: 999,
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        backgroundColor: c.yellow,
        borderRadius: 999,
    },
    progressIndeterminate: {
        width: "35%",
        opacity: 0.9,
    },

    /* Empty / pick file */
    empty: {
        flex: 1,
        justifyContent: "center",
        gap: 20,
    },
    emptyText: {
        color: c.gray,
        fontSize: 16,
        lineHeight: 24,
        textAlign: "center",
    },

    /* Preview list */
    list: {
        flex: 1,
    },
    listContent: {
        gap: 8,
        paddingBottom: 8,
    },
    listItem: {
        backgroundColor: c.bg1,
        borderRadius: 8,
        padding: 12,
    },
    itemWord: {
        color: c.yellow,
        fontSize: 16,
        fontWeight: "600",
    },
    itemDefinition: {
        color: c.fg,
        marginTop: 2,
    },

    /* Footer buttons */
    footer: {
        gap: 10,
        paddingTop: 12,
    },
    primaryButton: {
        backgroundColor: c.yellow,
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: "center",
    },
    primaryText: {
        color: c.bg,
        fontSize: 16,
        fontWeight: "600",
    },
    secondaryButton: {
        backgroundColor: c.bg1,
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: "center",
    },
    secondaryText: {
        color: c.fg,
        fontSize: 16,
    },

    /* Review */
    reviewContent: {
        gap: 12,
        paddingBottom: 24,
    },
    cardRow: {
        flexDirection: "row",
        gap: 10,
    },
    choiceCard: {
        flex: 1,
        minWidth: 0,
        minHeight: 150,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: "transparent",
        padding: 12,
        gap: 4,
    },
    choiceExisting: {
        backgroundColor: c.bg1,
    },
    choiceImported: {
        backgroundColor: c.bg2,
    },
    choiceDimmed: {
        opacity: 0.5,
    },
    choicePressed: {
        transform: [{ scale: 0.97 }],
    },
    choiceTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    choiceLabel: {
        fontSize: 13,
        fontWeight: "600",
    },
    check: {
        fontSize: 16,
        fontWeight: "600",
    },
    cardWord: {
        color: c.fg,
        fontSize: 20,
        fontWeight: "600",
        marginTop: 6,
    },
    cardDefinition: {
        color: c.fg,
        fontSize: 15,
    },
    cardExample: {
        color: c.gray,
        fontStyle: "italic",
        fontSize: 13,
    },
    cardNote: {
        color: c.aqua,
        fontSize: 12,
        marginTop: 4,
    },
    primaryDisabled: {
        backgroundColor: c.bg2,
    },
    renameBox: {
        borderWidth: 1,
        borderColor: "transparent",
        borderRadius: 10,
        padding: 12,
        gap: 8,
        marginTop: 12,
    },
    renameLabel: {
        color: c.aqua,
        fontSize: 13,
        fontWeight: "600",
    },
    input: {
        backgroundColor: c.bg1,
        color: c.fg,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: c.bg3,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
    },
    inputMulti: {
        minHeight: 60,
        textAlignVertical: "top",
    },
    renameButton: {
        borderWidth: 1,
        borderColor: c.aqua,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: "center",
    },
    renameText: {
        color: c.aqua,
        fontWeight: "600",
        fontSize: 16,
    },

    /* Stats */
    stats: {
        backgroundColor: c.bg1,
        borderRadius: 8,
        paddingHorizontal: 14,
    },
    statRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 14,
    },
    statDivider: {
        borderBottomWidth: 1,
        borderBottomColor: c.bg2,
    },
    statLabel: {
        color: c.fg,
        fontSize: 16,
    },
    statValue: {
        color: c.yellow,
        fontSize: 16,
        fontWeight: "600",
    },
    });
};