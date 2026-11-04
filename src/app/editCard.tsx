import { MaterialCommunityIcons } from "@expo/vector-icons";
import PixabayCredit from "../components/PixabayCredit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState, useMemo } from "react";
import KeyboardInsetView from "@/components/KeyboardInsetView";
import {
    ActivityIndicator,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { invalidateCardImage } from "@/components/CardStack";
import {
    ImageSearchResult,
    downloadImage,
    searchImages
} from "@/services/imageApi";

import { imageDisplayUrl, keepLocalCopy } from "@/services/localImages";
import { translateText } from "@/services/translationApi";
import { getLanguage } from "../constants/languages";
import {
    addImage,
    deleteCard,
    findDuplicateCard,
    getCard,
    getCardImage,
    getCardProgress,
    getDecks,
    resetCardProgress,
    setCardImage,
    updateCard,
} from "../database/database";
import { getRomanization } from "../utils/romanization";

import { CardProgress } from "../models/CardProgress";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

type TranslationDirection = "learningToLocalized" | "localizedToLearning" | null;

type ExistingCard = {
    id: number;
    learning_text?: string;
    localized_text?: string;
};

type DuplicateChoice = "existing" | "current" | null;

// Gruvbox palette
const makeCOLORS = (t: Palette) => ({
    bg0: t.bg,
    bg1: t.surface,
    bg2: t.surfaceHigh,
    bg3: t.surfaceTop,
    fg: t.text,
    gray: t.muted,
    yellow: t.yellow,
    yellowDark: t.gold,
    aqua: t.aqua,
    red: t.redDark,
    redBright: t.red,
    blue: t.blue,
});

function normalize(text: string): string {
    return text.trim().toLocaleLowerCase();
}

// --------------------------------------------------
// Tappable card used in the duplicate dialog
// --------------------------------------------------

function ChoiceCard({
    tone,
    label,
    word,
    definition,
    example,
    selected,
    dimmed,
    onPress,
}: {
    tone: "existing" | "current";
    label: string;
    word: string;
    definition: string;
    example?: string;
    selected: boolean;
    dimmed: boolean;
    onPress: () => void;
}) {
    const t = useTheme();
    const COLORS = useMemo(() => makeCOLORS(t), [t]);
    const styles = useMemo(() => makeStyles(t), [t]);
    const accent = tone === "existing" ? COLORS.aqua : COLORS.yellow;

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.choiceCard,
                tone === "existing"
                    ? styles.choiceExisting
                    : styles.choiceCurrent,
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
            <Text style={styles.choiceWord}>{word}</Text>
            <Text style={styles.choiceDefinition}>{definition}</Text>
            {!!example && (
                <Text style={styles.choiceExample}>{example}</Text>
            )}
        </Pressable>
    );
}

export default function EditCardScreen() {
    const t = useTheme();
    const COLORS = useMemo(() => makeCOLORS(t), [t]);
    const styles = useMemo(() => makeStyles(t), [t]);
    const { id } = useLocalSearchParams<{ id: string }>();
    const cardId = Number(id);

    const [learningText, setLearningText] = useState("");
    const [originalLearningText, setOriginalLearningText] = useState("");
    const [localizedText, setLocalizedText] = useState("");
    const [exampleSentence, setExampleSentence] = useState("");
    const [progress, setProgress] = useState<CardProgress>();
    const [showProgress, setShowProgress] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [saving, setSaving] = useState(false);

    const [selectedImage, setSelectedImage] = useState<ImageSearchResult | null>(null);
    const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
    const [imageResults, setImageResults] = useState<ImageSearchResult[]>([]);
    const [imageQuery, setImageQuery] = useState("");
    const [imageModalVisible, setImageModalVisible] = useState(false);
    const [searchingImages, setSearchingImages] = useState(false);

    const [learningLanguageCode, setLearningLanguageCode] = useState("en");
    const [learningLanguageFlag, setLearningLanguageFlag] = useState("🌐");

    // TODO: Replace these when localized language becomes selectable
    const localizedLanguageCode = "en";
    const localizedLanguageFlag = "🇬🇧";

    const [translating, setTranslating] =
        useState<TranslationDirection>(null);

    // --------------------------------------------------
    // Duplicate handling
    // --------------------------------------------------

    const [duplicateCard, setDuplicateCard] = useState<ExistingCard | null>(
        null
    );
    const [choice, setChoice] = useState<DuplicateChoice>(null);
    const [renameText, setRenameText] = useState("");
    const [renameDefinition, setRenameDefinition] = useState("");
    const [renameExample, setRenameExample] = useState("");
    const [duplicateError, setDuplicateError] = useState("");

    useEffect(() => {
        const loadCard = async () => {
            const card = await getCard(cardId);

            if (card) {
                setLearningText(card.learningText);
                setOriginalLearningText(card.learningText);
                setLocalizedText(card.localizedText);
                setExampleSentence(card.exampleSentence ?? "");
            }

            const cardProgress = await getCardProgress(cardId);

            if (cardProgress) {
                setProgress(cardProgress);
            }

            const image = await getCardImage(cardId);

            if (image) {
                setCurrentImageUrl(imageDisplayUrl(image) ?? null);
            }

            // Load deck language (same approach as AddCardScreen)
            const lastDeckId = await AsyncStorage.getItem("lastDeckId");

            if (lastDeckId) {
                const decks = await getDecks();
                const deck = decks.find(
                    (deck) => deck.id === Number(lastDeckId)
                );

                if (deck) {
                    const language = getLanguage(deck.language);
                    setLearningLanguageCode(language?.code ?? "en");
                    setLearningLanguageFlag(language?.flag ?? "🌐");
                }
            }
        };

        loadCard();
    }, [cardId]);

    // --------------------------------------------------
    // Save (optionally deleting another card that clashes)
    // --------------------------------------------------

    const persistChanges = async (
        text: string,
        meaning: string,
        example: string,
        deleteOtherCardId?: number
    ) => {
        setSaving(true);

        try {
            const romanization =
                (await getRomanization(text, learningLanguageCode)) ?? "";

            // Download first so a failure here changes nothing
            let imageId: number | null = null;

            if (selectedImage) {
                try {
                    const downloaded = await downloadImage(selectedImage);

                    imageId = await addImage(
                        selectedImage.source,
                        String(selectedImage.id),
                        downloaded.imageUrl,
                        null,
                        selectedImage.pageUrl,
                        selectedImage.photographer,
                        selectedImage.photographerUrl
                    );
                    await keepLocalCopy(imageId);
                } catch (error) {
                    console.warn("Image failed, saving card without it:", error);
                    // imageId stays as it was, so the card still saves
                }
            }

            if (deleteOtherCardId !== undefined) {
                await deleteCard(deleteOtherCardId);
            }

            await updateCard(cardId, text, meaning, example, romanization);

            if (imageId !== null) {
                await setCardImage(cardId, imageId);
                invalidateCardImage(cardId);   // <-- add this line
            }

            setDuplicateCard(null);
            router.back();
        } catch (error) {
            console.error("Failed to save card:", error);
        } finally {
            setSaving(false);
        }
    };

    // --------------------------------------------------
    // Save button: check for a duplicate first
    // --------------------------------------------------

    const saveChanges = async () => {
        if (saving) {
            return;
        }

        setSaving(true);

        try {
            // Only look for duplicates if the learning text changed,
            // otherwise the card would match itself.
            if (
                learningText.trim() &&
                normalize(learningText) !== normalize(originalLearningText)
            ) {
                const lastDeckId = await AsyncStorage.getItem("lastDeckId");

                if (lastDeckId) {
                    const found = (await findDuplicateCard(
                        learningText.trim(),
                        Number(lastDeckId)
                    )) as ExistingCard | null;

                    if (found && Number(found.id) !== cardId) {
                        setRenameText(learningText);
                        setRenameDefinition(localizedText);
                        setRenameExample(exampleSentence);
                        setChoice(null);
                        setDuplicateError("");
                        setDuplicateCard(found);
                        setSaving(false);
                        return;
                    }
                }
            }
        } catch (error) {
            console.error("Duplicate check failed:", error);
            setSaving(false);
            return;
        }

        await persistChanges(learningText, localizedText, exampleSentence);
    };

    // --------------------------------------------------
    // Duplicate dialog actions
    // --------------------------------------------------

    const closeDuplicateDialog = () => {
        if (saving) {
            return;
        }

        setDuplicateCard(null);
        setChoice(null);
        setDuplicateError("");
    };

    const confirmChoice = async () => {
        if (!duplicateCard || !choice || saving) {
            return;
        }

        if (choice === "existing") {
            // Leave both cards untouched.
            closeDuplicateDialog();
            return;
        }

        // Keep this card (with its progress), remove the other one.
        await persistChanges(
            learningText,
            localizedText,
            exampleSentence,
            Number(duplicateCard.id)
        );
    };

    const renameAndSave = async () => {
        if (!duplicateCard || saving) {
            return;
        }

        const name = renameText.trim();
        const definition = renameDefinition.trim();

        if (!name) {
            setDuplicateError("Enter a learning text first.");
            return;
        }

        if (
            normalize(name) ===
            normalize(duplicateCard.learning_text ?? learningText)
        ) {
            setDuplicateError("Choose a different learning text.");
            return;
        }

        if (!definition) {
            setDuplicateError("Enter a definition first.");
            return;
        }

        setDuplicateError("");

        await persistChanges(name, definition, renameExample.trim());
    };

    const removeCard = async () => {
        await deleteCard(cardId);
        router.back();
    };

    const resetCard = async () => {
        await resetCardProgress(cardId);
        const cardProgress = await getCardProgress(cardId);

        if (cardProgress) {
            setProgress(cardProgress);
        }
    };

    // --------------------------------------------------
    // Translation
    // --------------------------------------------------

    const translate = async (
        direction: Exclude<TranslationDirection, null>
    ) => {
        if (translating !== null) {
            return;
        }

        const isLearningSource = direction === "learningToLocalized";

        const sourceText = isLearningSource ? learningText : localizedText;

        const targetLanguage = isLearningSource
            ? localizedLanguageCode
            : learningLanguageCode;

        if (!sourceText.trim()) {
            return;
        }

        if (
            isLearningSource &&
            learningLanguageCode === localizedLanguageCode
        ) {
            return;
        }

        setTranslating(direction);

        try {
            const translation = await translateText(
                sourceText,
                targetLanguage
            );

            if (isLearningSource) {
                setLocalizedText(translation);
            } else {
                setLearningText(translation);
            }
        } catch (error) {
            console.error("Translation failed:", error);
        } finally {
            setTranslating(null);
        }
    };

    // --------------------------------------------------
    // Translate button
    // --------------------------------------------------

    const renderTranslateButton = (
        direction: Exclude<TranslationDirection, null>
    ) => {
        const isLoading = translating === direction;
        const isDisabled = translating !== null;

        return (
            <Pressable
                style={({ pressed }) => [
                    styles.translateButton,
                    pressed && styles.translateButtonPressed,
                    isDisabled && !isLoading && styles.translateButtonDisabled,
                ]}
                onPress={() => translate(direction)}
                disabled={isDisabled}
                hitSlop={8}
            >
                {isLoading ? (
                    <ActivityIndicator size="small" color={COLORS.yellow} />
                ) : (
                    <MaterialCommunityIcons
                        name="translate"
                        size={18}
                        color={COLORS.yellow}
                    />
                )}
            </Pressable>
        );
    };

    // --------------------------------------------------
    // Faded label inside the input (flag + code, or plain text)
    // --------------------------------------------------

    const renderWatermark = (label: string) => (
        <Text style={styles.watermark} pointerEvents="none">
            {label}
        </Text>
    );

    const searchForImages = async (query: string) => {
        const trimmedQuery = query.trim();

        if (!trimmedQuery || searchingImages) {
            return;
        }

        setSearchingImages(true);

        try {
            const results = await searchImages(trimmedQuery);
            setImageResults(results);
        } catch (error) {
            console.error("Image search failed:", error);
        } finally {
            setSearchingImages(false);
        }
    };

    const openImagePicker = () => {
        setImageQuery(
            localizedText.trim() ||
            learningText.trim()
        );

        setImageModalVisible(true);
    };

    const selectImage = (image: ImageSearchResult) => {
        setSelectedImage(image);
        setCurrentImageUrl(image.downloadUrl);
        setImageModalVisible(false);
    };

    const confirmLabel =
        choice === "existing"
            ? "Keep existing card"
            : choice === "current"
                ? "Replace existing card"
                : "Choose a card";

    // --------------------------------------------------
    // UI
    // --------------------------------------------------

    return (
        <KeyboardInsetView
            style={styles.container}
        >
        <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
        >

            <Pressable
                style={styles.mainImageContainer}
                onPress={openImagePicker}
            >
                {currentImageUrl ? (
                    <Image
                        source={{ uri: currentImageUrl }}
                        style={styles.mainImage}
                    />
                ) : (
                    <View style={styles.imagePlaceholder}>
                        <MaterialCommunityIcons
                            name="image-outline"
                            size={50}
                            color={COLORS.gray}
                        />
                    </View>
                )}

                <View style={styles.changeImageBadge}>
                    <MaterialCommunityIcons
                        name="image-edit-outline"
                        size={17}
                        color={COLORS.fg}
                    />

                    <Text style={styles.changeImageText}>
                        Change
                    </Text>
                </View>
            </Pressable>

            {/* ---------- Card content ---------- */}
            <View style={styles.form}>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={learningText}
                        onChangeText={setLearningText}
                        placeholder="Enter the word or phrase"
                        placeholderTextColor={COLORS.gray}
                        multiline
                    />

                    {renderWatermark(
                        `${learningLanguageFlag} ${learningLanguageCode.toUpperCase()}`
                    )}
                    {renderTranslateButton("learningToLocalized")}
                </View>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={localizedText}
                        onChangeText={setLocalizedText}
                        placeholder="Enter the meaning"
                        placeholderTextColor={COLORS.gray}
                        multiline
                    />

                    {renderWatermark(
                        `${localizedLanguageFlag} ${localizedLanguageCode.toUpperCase()}`
                    )}
                    {renderTranslateButton("localizedToLearning")}
                </View>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={[styles.input, styles.exampleInput]}
                        value={exampleSentence}
                        onChangeText={setExampleSentence}
                        placeholder="Example sentence (optional)"
                        placeholderTextColor={COLORS.gray}
                        multiline
                    />

                    {renderWatermark("Example")}
                </View>

                <Pressable
                    style={({ pressed }) => [
                        styles.saveButton,
                        pressed && styles.buttonPressed,
                        saving && styles.buttonDisabled,
                    ]}
                    onPress={saveChanges}
                    disabled={saving}
                >
                    {saving && duplicateCard === null ? (
                        <ActivityIndicator size="small" color={COLORS.bg0} />
                    ) : (
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                    )}
                </Pressable>
            </View>



            {/* ---------- Collapsible progress ---------- */}
            <View style={styles.progressSection}>
                <Pressable
                    style={({ pressed }) => [
                        styles.progressHeader,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={() => setShowProgress((value) => !value)}
                >
                    <Text style={styles.title}></Text>

                    <View style={styles.progressHeaderText}>

                        <Text style={styles.sectionTitle}>

                            Learning Progress
                        </Text>

                        {!showProgress && (
                            <Text style={styles.progressSummary}>
                                Level {progress?.reviewCount ?? 0} · Next:{" "}
                                {formatTimeRemaining(progress?.nextReviewAt)}
                            </Text>
                        )}
                    </View>

                    <MaterialCommunityIcons
                        name={showProgress ? "chevron-up" : "chevron-down"}
                        size={24}
                        color={COLORS.gray}
                    />
                </Pressable>

                {showProgress && (
                    <View style={styles.statsContainer}>
                        <View style={styles.statCard}>
                            <Text style={styles.statNumber}>
                                {progress?.reviewCount ?? 0}
                            </Text>

                            <Text style={styles.statLabel}>Level</Text>
                        </View>

                        <View style={styles.statCard}>
                            <Text style={styles.statNumber}>
                                {formatTimeRemaining(progress?.nextReviewAt)}
                            </Text>

                            <Text style={styles.statLabel}>Next Review</Text>
                        </View>

                        <View style={styles.statCard}>
                            <Text style={styles.statNumber}>
                                {progress?.mastered ? "Yes" : "No"}
                            </Text>

                            <Text style={styles.statLabel}>Mastered</Text>
                        </View>
                    </View>
                )}
            </View>

            <Text style={styles.title}></Text>

            {/* ---------- Actions ---------- */}
            <View style={styles.actionsRow}>
                <Pressable
                    style={({ pressed }) => [
                        styles.resetButton,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={() => setShowResetModal(true)}
                >
                    <Text style={styles.resetButtonText}>Reset</Text>
                </Pressable>

                <Pressable
                    style={({ pressed }) => [
                        styles.deleteButton,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={() => setShowDeleteModal(true)}
                >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
            </View>

            <Modal
                visible={showResetModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowResetModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modal}>
                        <Text style={styles.modalTitle}>
                            Reset Card Progress?
                        </Text>

                        <Text style={styles.modalText}>
                            This will reset this card's learning progress
                            back to the beginning.
                        </Text>

                        <View style={styles.modalButtons}>
                            <Pressable
                                style={styles.cancelButton}
                                onPress={() => setShowResetModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>
                                    Cancel
                                </Text>
                            </Pressable>

                            <Pressable
                                style={styles.resetConfirmButton}
                                onPress={async () => {
                                    await resetCard();
                                    setShowResetModal(false);
                                }}
                            >
                                <Text style={styles.resetConfirmText}>
                                    Reset
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showDeleteModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDeleteModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modal}>
                        <Text style={styles.modalTitle}>Delete Card?</Text>

                        <Text style={styles.modalText}>
                            Are you sure you want to permanently delete
                            this card?
                        </Text>

                        <View style={styles.modalButtons}>
                            <Pressable
                                style={styles.cancelButton}
                                onPress={() => setShowDeleteModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>
                                    Cancel
                                </Text>
                            </Pressable>

                            <Pressable
                                style={styles.deleteConfirmButton}
                                onPress={async () => {
                                    await removeCard();
                                }}
                            >
                                <Text style={styles.deleteConfirmText}>
                                    Delete
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={imageModalVisible}
                animationType="slide"
                transparent
                statusBarTranslucent
                onRequestClose={() => setImageModalVisible(false)}
            >
                <KeyboardInsetView
                    style={styles.imageModalOverlay}
                >
                    <View style={styles.imageModal}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.imageModalTitle}>
                                Choose Image
                            </Text>

                            <Pressable
                                onPress={() => setImageModalVisible(false)}
                            >
                                <MaterialCommunityIcons
                                    name="close"
                                    size={26}
                                    color={COLORS.fg}
                                />
                            </Pressable>
                        </View>

                        <View style={styles.imageSearchRow}>
                            <TextInput
                                style={styles.imageSearchInput}
                                value={imageQuery}
                                onChangeText={setImageQuery}
                                placeholder="Search images..."
                                placeholderTextColor={COLORS.gray}
                                onSubmitEditing={() =>
                                    searchForImages(imageQuery)
                                }
                                returnKeyType="search"
                            />

                            <Pressable
                                style={styles.searchButton}
                                onPress={() =>
                                    searchForImages(imageQuery)
                                }
                                disabled={searchingImages}
                            >
                                {searchingImages ? (
                                    <ActivityIndicator
                                        size="small"
                                        color={COLORS.bg0}
                                    />
                                ) : (
                                    <MaterialCommunityIcons
                                        name="magnify"
                                        size={22}
                                        color={COLORS.bg0}
                                    />
                                )}
                            </Pressable>
                        </View>

                        <PixabayCredit />

                        <ScrollView
                            contentContainerStyle={styles.imageGrid}
                        >
                            {imageResults.map((image) => {
                                const isSelected =
                                    selectedImage?.id === image.id;

                                return (
                                    <Pressable
                                        key={image.id}
                                        style={[
                                            styles.imageResult,
                                            isSelected &&
                                            styles.imageResultSelected,
                                        ]}
                                        onPress={() =>
                                            selectImage(image)
                                        }
                                    >
                                        <Image
                                            source={{
                                                uri: image.thumbnailUrl,
                                            }}
                                            style={styles.thumbnail}
                                        />

                                        {isSelected && (
                                            <View
                                                style={
                                                    styles.selectedOverlay
                                                }
                                            >
                                                <MaterialCommunityIcons
                                                    name="check-circle"
                                                    size={30}
                                                    color={COLORS.yellow}
                                                />
                                            </View>
                                        )}
                                    </Pressable>
                                );
                            })}
                        </ScrollView>

                        <Pressable
                            style={styles.doneButton}
                            onPress={() => setImageModalVisible(false)}
                        >
                            <Text style={styles.buttonText}>
                                Done
                            </Text>
                        </Pressable>
                    </View>
                </KeyboardInsetView>
            </Modal>

            {/* ---------- Duplicate dialog ---------- */}
            <Modal
                visible={duplicateCard !== null}
                animationType="slide"
                transparent
                statusBarTranslucent
                onRequestClose={closeDuplicateDialog}
            >
                <KeyboardInsetView
                    style={styles.imageModalOverlay}
                >
                    <View style={styles.duplicateContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.imageModalTitle}>
                                Duplicate
                            </Text>

                            <Pressable onPress={closeDuplicateDialog}>
                                <MaterialCommunityIcons
                                    name="close"
                                    size={26}
                                    color={COLORS.fg}
                                />
                            </Pressable>
                        </View>

                        <ScrollView
                            style={styles.duplicateScroll}
                            contentContainerStyle={styles.duplicateContent}
                            keyboardShouldPersistTaps="handled"
                        >
                            <Text style={styles.mutedText}>
                                Another card in your deck already has this
                                word. Tap the card you want to keep.
                            </Text>

                            <View style={styles.cardRow}>
                                <ChoiceCard
                                    tone="existing"
                                    label="In your deck"
                                    word={duplicateCard?.learning_text ?? "—"}
                                    definition={
                                        duplicateCard?.localized_text ?? "—"
                                    }
                                    selected={choice === "existing"}
                                    dimmed={choice === "current"}
                                    onPress={() => setChoice("existing")}
                                />
                                <ChoiceCard
                                    tone="current"
                                    label="This card"
                                    word={learningText}
                                    definition={localizedText}
                                    example={exampleSentence}
                                    selected={choice === "current"}
                                    dimmed={choice === "existing"}
                                    onPress={() => setChoice("current")}
                                />
                            </View>

                            <Pressable
                                style={({ pressed }) => [
                                    styles.confirmButton,
                                    !choice && styles.confirmButtonMuted,
                                    pressed && styles.buttonPressed,
                                ]}
                                onPress={confirmChoice}
                                disabled={!choice || saving}
                            >
                                {saving ? (
                                    <ActivityIndicator
                                        size="small"
                                        color={COLORS.bg0}
                                    />
                                ) : (
                                    <Text style={styles.buttonText}>
                                        {confirmLabel}
                                    </Text>
                                )}
                            </Pressable>

                            <View style={styles.renameBox}>
                                <TextInput
                                    style={styles.renameInput}
                                    value={renameText}
                                    onChangeText={setRenameText}
                                    placeholder="Learning text"
                                    placeholderTextColor={COLORS.bg3}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                <TextInput
                                    style={[
                                        styles.renameInput,
                                        styles.renameInputMulti,
                                    ]}
                                    value={renameDefinition}
                                    onChangeText={setRenameDefinition}
                                    placeholder="Definition"
                                    placeholderTextColor={COLORS.bg3}
                                    multiline
                                />
                                <TextInput
                                    style={[
                                        styles.renameInput,
                                        styles.renameInputMulti,
                                    ]}
                                    value={renameExample}
                                    onChangeText={setRenameExample}
                                    placeholder="Example (optional)"
                                    placeholderTextColor={COLORS.bg3}
                                    multiline
                                />
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.renameButton,
                                        pressed && styles.choicePressed,
                                    ]}
                                    onPress={renameAndSave}
                                    disabled={saving}
                                >
                                    <Text style={styles.renameText}>
                                        Rename
                                    </Text>
                                </Pressable>
                            </View>

                            {!!duplicateError && (
                                <Text style={styles.errorText}>
                                    {duplicateError}
                                </Text>
                            )}
                        </ScrollView>
                    </View>
                </KeyboardInsetView>
            </Modal>
        </ScrollView>
        </KeyboardInsetView>
    );
}

function formatTimeRemaining(nextReviewAt?: number): string {
    if (!nextReviewAt) {
        return "Now";
    }

    const remaining = nextReviewAt - Date.now();

    if (remaining <= 0) {
        return "Now";
    }

    const minutes = Math.ceil(remaining / (60 * 1000));

    if (minutes < 60) {
        return `${minutes} min`;
    }

    const hours = Math.ceil(minutes / 60);

    if (hours < 24) {
        return `${hours} hr`;
    }

    const days = Math.ceil(hours / 24);

    return `${days} day${days === 1 ? "" : "s"}`;
}

const makeStyles = (t: Palette) => {
    const COLORS = makeCOLORS(t);
    return StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg0,
    },

    scroll: {
        flex: 1,
    },

    content: {
        padding: 20,
        paddingTop: 40,
        paddingBottom: 40,
    },

    title: {
        color: COLORS.fg,
        fontSize: 32,
        fontWeight: "bold",
        marginBottom: 24,
    },

    form: {
        gap: 4,
    },

    // Faded language tag in the bottom-right corner of a field
    watermark: {
        position: "absolute",
        right: 12,
        bottom: 8,
        color: COLORS.gray,
        fontSize: 13,
        opacity: 0.45,
    },

    inputContainer: {
        position: "relative",
        marginBottom: 16,
    },

    input: {
        backgroundColor: COLORS.bg1,
        color: COLORS.fg,
        fontSize: 18,
        padding: 15,
        paddingRight: 56,
        paddingBottom: 22,
        paddingTop: 22,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: COLORS.bg2,
        minHeight: 55,
        textAlignVertical: "top",
    },

    exampleInput: {
        minHeight: 55,
        paddingRight: 15,
        fontSize: 16,
    },

    // Tinted circle, sits at the top-right of the field
    translateButton: {
        position: "absolute",
        right: 10,
        top: 9,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(250,189,47,0.12)",
        borderWidth: 1,
        borderColor: "rgba(250,189,47,0.35)",
    },

    translateButtonPressed: {
        opacity: 0.6,
    },

    translateButtonDisabled: {
        opacity: 0.4,
    },

    saveButton: {
        backgroundColor: COLORS.yellowDark,
        padding: 16,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8,
        minHeight: 54,
    },

    saveButtonText: {
        color: COLORS.bg0,
        fontSize: 17,
        fontWeight: "bold",
    },

    progressSection: {
        marginTop: 24,
        backgroundColor: COLORS.bg1,
        borderWidth: 1,
        borderColor: COLORS.bg2,
        borderRadius: 12,
        padding: 14,
    },

    progressHeader: {
        flexDirection: "row",
        alignItems: "center",
    },

    progressHeaderText: {
        flex: 1,
    },

    progressSummary: {
        color: COLORS.gray,
        fontSize: 13,
        marginTop: 2,
    },

    sectionTitle: {
        color: COLORS.fg,
        fontSize: 17,
        fontWeight: "bold",
    },

    statsContainer: {
        flexDirection: "row",
        gap: 10,
        marginTop: 14,
    },

    statCard: {
        flex: 1,
        backgroundColor: COLORS.bg0,
        borderWidth: 1,
        borderColor: COLORS.bg2,
        borderRadius: 10,
        paddingVertical: 14,
        paddingHorizontal: 8,
        alignItems: "center",
    },

    statNumber: {
        color: COLORS.yellowDark,
        fontSize: 21,
        fontWeight: "bold",
        marginBottom: 5,
    },

    statLabel: {
        color: COLORS.gray,
        fontSize: 13,
        textAlign: "center",
    },

    actionsRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 24,
    },

    resetButton: {
        flex: 1,
        backgroundColor: COLORS.bg1,
        borderWidth: 1,
        borderColor: COLORS.blue,
        padding: 14,
        borderRadius: 10,
        alignItems: "center",
    },

    resetButtonText: {
        color: COLORS.blue,
        fontSize: 16,
        fontWeight: "bold",
    },

    deleteButton: {
        flex: 1,
        backgroundColor: COLORS.bg1,
        borderWidth: 1,
        borderColor: COLORS.red,
        padding: 14,
        borderRadius: 10,
        alignItems: "center",
    },

    deleteButtonText: {
        color: COLORS.red,
        fontSize: 16,
        fontWeight: "bold",
    },

    buttonPressed: {
        opacity: 0.7,
    },

    buttonDisabled: {
        opacity: 0.6,
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        justifyContent: "center",
        alignItems: "center",
    },

    modal: {
        width: "85%",
        backgroundColor: COLORS.bg1,
        borderWidth: 1,
        borderColor: COLORS.bg2,
        borderRadius: 15,
        padding: 22,
    },

    modalTitle: {
        color: COLORS.fg,
        fontSize: 22,
        fontWeight: "bold",
        marginBottom: 10,
    },

    modalText: {
        color: COLORS.gray,
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 24,
    },

    modalButtons: {
        flexDirection: "row",
        gap: 10,
    },

    cancelButton: {
        flex: 1,
        backgroundColor: COLORS.bg2,
        padding: 14,
        borderRadius: 10,
        alignItems: "center",
    },

    cancelButtonText: {
        color: COLORS.fg,
        fontSize: 16,
        fontWeight: "bold",
    },

    resetConfirmButton: {
        flex: 1,
        backgroundColor: COLORS.blue,
        padding: 14,
        borderRadius: 10,
        alignItems: "center",
    },

    resetConfirmText: {
        color: COLORS.bg0,
        fontSize: 16,
        fontWeight: "bold",
    },

    deleteConfirmButton: {
        flex: 1,
        backgroundColor: COLORS.red,
        padding: 14,
        borderRadius: 10,
        alignItems: "center",
    },

    deleteConfirmText: {
        color: COLORS.fg,
        fontSize: 16,
        fontWeight: "bold",
    },

    mainImageContainer: {
        width: "100%",
        height: 230,
        borderRadius: 14,
        overflow: "hidden",
        marginBottom: 18,
        backgroundColor: COLORS.bg1,
        borderWidth: 1,
        borderColor: COLORS.bg2,
        position: "relative",
    },

    mainImage: {
        width: "100%",
        height: "100%",
        resizeMode: "cover",
    },

    imagePlaceholder: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    changeImageBadge: {
        position: "absolute",
        right: 10,
        bottom: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: "rgba(40,40,40,0.85)",
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
    },

    changeImageText: {
        color: COLORS.fg,
        fontSize: 13,
        fontWeight: "600",
    },

    imageModalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.65)",
        justifyContent: "flex-end",
    },

    imageModal: {
        height: "82%",
        backgroundColor: COLORS.bg0,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        padding: 20,
    },

    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 15,
    },

    imageModalTitle: {
        color: COLORS.fg,
        fontSize: 22,
        fontWeight: "bold",
    },

    imageSearchRow: {
        flexDirection: "row",
        gap: 8,
    },

    imageSearchInput: {
        flex: 1,
        backgroundColor: COLORS.bg1,
        color: COLORS.fg,
        fontSize: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: COLORS.bg2,
    },

    searchButton: {
        width: 48,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.yellowDark,
    },

    imageGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        paddingTop: 15,
        paddingBottom: 15,
    },

    imageResult: {
        width: "18.4%",
        aspectRatio: 1,
        borderRadius: 8,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: "transparent",
        position: "relative",
    },

    imageResultSelected: {
        borderColor: COLORS.yellow,
    },

    thumbnail: {
        width: "100%",
        height: "100%",
    },

    selectedOverlay: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(40,40,40,0.35)",
    },

    doneButton: {
        backgroundColor: COLORS.yellowDark,
        padding: 15,
        borderRadius: 10,
        alignItems: "center",
        minHeight: 52,
        justifyContent: "center",
    },

    buttonText: {
        color: COLORS.bg0,
        fontSize: 17,
        fontWeight: "bold",
    },

    /* Duplicate dialog */

    duplicateContainer: {
        maxHeight: "92%",
        backgroundColor: COLORS.bg0,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        padding: 20,
    },

    duplicateScroll: {
        flexShrink: 1,
    },

    duplicateContent: {
        gap: 12,
        paddingBottom: 20,
    },

    mutedText: {
        color: COLORS.gray,
        fontSize: 14,
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
        backgroundColor: COLORS.bg1,
    },

    choiceCurrent: {
        backgroundColor: COLORS.bg2,
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
        fontWeight: "bold",
    },

    check: {
        fontSize: 16,
        fontWeight: "bold",
    },

    choiceWord: {
        color: COLORS.fg,
        fontSize: 20,
        fontWeight: "bold",
        marginTop: 6,
    },

    choiceDefinition: {
        color: COLORS.fg,
        fontSize: 15,
    },

    choiceExample: {
        color: COLORS.gray,
        fontStyle: "italic",
        fontSize: 13,
    },

    confirmButton: {
        backgroundColor: COLORS.yellowDark,
        padding: 16,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 54,
    },

    confirmButtonMuted: {
        backgroundColor: COLORS.bg2,
    },

    renameBox: {
        borderWidth: 1,
        borderColor: COLORS.aqua,
        borderRadius: 10,
        padding: 12,
        gap: 8,
    },

    renameInput: {
        backgroundColor: COLORS.bg1,
        color: COLORS.fg,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.bg3,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
    },

    renameInputMulti: {
        minHeight: 60,
        textAlignVertical: "top",
    },

    renameButton: {
        borderWidth: 1,
        borderColor: COLORS.aqua,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: "center",
    },

    renameText: {
        color: COLORS.aqua,
        fontWeight: "bold",
        fontSize: 16,
    },

    errorText: {
        color: COLORS.redBright,
    },
    });
};