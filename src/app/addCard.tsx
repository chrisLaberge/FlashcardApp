import { MaterialCommunityIcons } from "@expo/vector-icons";
import PixabayCredit from "../components/PixabayCredit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ComponentRef, useMemo } from "react";
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

import KeyboardInsetView from "@/components/KeyboardInsetView";

import {
    addCard,
    addImage,
    deleteCard,
    findDuplicateCard,
    getDecks,
    setCardImage,
} from "../database/database";
import { scheduleAchievementCheck } from "../services/achievementUnlocks";

import {
    ImageSearchResult,
    downloadImage,
    searchImages,
} from "@/services/imageApi";

import { keepLocalCopy } from "@/services/localImages";
import { translateText } from "@/services/translationApi";
import { getRomanization } from "@/utils/romanization";
import { getLanguage } from "../constants/languages";
import ExampleButton from "../components/ExampleButton";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

type TranslationDirection =
    | "learningToLocalized"
    | "localizedToLearning"
    | null;

type ExistingCard = {
    id: number;
    learning_text?: string;
    localized_text?: string;
};

type DuplicateChoice = "existing" | "new" | null;

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
    red: t.red,
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
    tone: "existing" | "new";
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
                    : styles.choiceNew,
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

export default function AddCardScreen() {
    const t = useTheme();
    const COLORS = useMemo(() => makeCOLORS(t), [t]);
    const styles = useMemo(() => makeStyles(t), [t]);
    const { deckId, text: presetText, meaning: presetMeaning, example: presetExample } = useLocalSearchParams<{ deckId?: string; text?: string; meaning?: string; example?: string }>();

    const [learningLanguageCode, setLearningLanguageCode] = useState("en");
    const [learningLanguageFlag, setLearningLanguageFlag] = useState("🌐");

    // TODO: Replace when localized language becomes selectable
    const localizedLanguageCode = "en";
    const localizedLanguageFlag = "🇬🇧";

    // A word tapped while reviewing arrives here already filled in (the meaning and sentence can be edited).
    const [learningText, setLearningText] = useState(typeof presetText === "string" ? presetText : "");
    const [localizedText, setLocalizedText] = useState(typeof presetMeaning === "string" ? presetMeaning : "");
    const [exampleSentence, setExampleSentence] = useState(typeof presetExample === "string" ? presetExample : "");

    const [translating, setTranslating] =
        useState<TranslationDirection>(null);

    // --------------------------------------------------
    // Images
    // --------------------------------------------------

    const [imageResults, setImageResults] = useState<ImageSearchResult[]>([]);
    const [selectedImage, setSelectedImage] =
        useState<ImageSearchResult | null>(null);
    const [imageQuery, setImageQuery] = useState("");
    const [searchingImages, setSearchingImages] = useState(false);
    const [imageModalVisible, setImageModalVisible] = useState(false);
    const [savingCard, setSavingCard] = useState(false);
    const lastSearchedQuery = useRef("");

    // --------------------------------------------------
    // Staying on this screen after a card is added
    // --------------------------------------------------

    const learningInputRef = useRef<ComponentRef<typeof TextInput>>(null);
    const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
    const [addedMessage, setAddedMessage] = useState<string | null>(null);
    const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (addedTimer.current) clearTimeout(addedTimer.current);
        },
        []
    );

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

    // --------------------------------------------------
    // Load deck language
    // --------------------------------------------------

    useFocusEffect(
        useCallback(() => {
            const loadDeck = async () => {
                const lastDeckId = await AsyncStorage.getItem("lastDeckId");

                if (!lastDeckId) {
                    setLearningLanguageCode("en");
                    setLearningLanguageFlag("🌐");
                    return;
                }

                const decks = await getDecks();

                const deck = decks.find(
                    (deck) => deck.id === Number(lastDeckId)
                );

                if (!deck) {
                    setLearningLanguageCode("en");
                    setLearningLanguageFlag("🌐");
                    return;
                }

                const language = getLanguage(deck.language);

                setLearningLanguageCode(language?.code ?? "en");
                setLearningLanguageFlag(language?.flag ?? "🌐");
            };

            loadDeck();
        }, [deckId])
    );

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

        if (isLearningSource && learningLanguageCode === localizedLanguageCode) {
            return;
        }

        setTranslating(direction);

        try {
            const translation = await translateText(sourceText, targetLanguage);

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
    // Image search
    // --------------------------------------------------

    const searchForImages = async (
        query: string,
        automaticallySelectFirst = false
    ) => {
        const trimmedQuery = query.trim();

        if (!trimmedQuery || searchingImages) {
            return;
        }

        setSearchingImages(true);
        lastSearchedQuery.current = trimmedQuery;

        try {
            const results = await searchImages(trimmedQuery);

            setImageResults(results);

            if (automaticallySelectFirst && results.length > 0) {
                setSelectedImage(results[0]);
            }
        } catch (error) {
            console.error("Image search failed:", error);
        } finally {
            setSearchingImages(false);
        }
    };

    // --------------------------------------------------
    // Open image picker
    // --------------------------------------------------

    const openImagePicker = () => {
        const query = localizedText.trim() || learningText.trim();

        setImageQuery(query);
        setImageModalVisible(true);

        // Images are only looked up when the picker is opened, and again if the text changed since.
        if (query && query !== lastSearchedQuery.current) {
            searchForImages(query);
        }
    };

    const removeImage = () => {
        setSelectedImage(null);
    };

    // --------------------------------------------------
    // Select image
    // --------------------------------------------------

    const selectImage = (image: ImageSearchResult) => {
        setSelectedImage(image);
        setImageModalVisible(false);
    };

    // --------------------------------------------------
    // Save card (optionally replacing an existing one)
    // --------------------------------------------------

    const saveCard = async (
        text: string,
        meaning: string,
        example: string,
        replaceCardId?: number
    ) => {
        const lastDeckId = await AsyncStorage.getItem("lastDeckId");

        if (!lastDeckId) {
            console.error("No selected deck");
            setSavingCard(false);
            return;
        }

        setSavingCard(true);

        try {
            const deckIdNumber = Number(lastDeckId);

            const romanization =
                (await getRomanization(text, learningLanguageCode)) ?? "";

            // ------------------------------------------
            // Download and save selected image
            // ------------------------------------------

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

            // ------------------------------------------
            // Remove the old card only once everything
            // else has succeeded
            // ------------------------------------------

            if (replaceCardId !== undefined) {
                await deleteCard(replaceCardId);
            }

            // ------------------------------------------
            // Create card
            // ------------------------------------------

            const cardId = await addCard(
                text,
                meaning,
                example,
                romanization,
                deckIdNumber
            );

            // ------------------------------------------
            // Attach image
            // ------------------------------------------

            if (imageId !== null) {
                await setCardImage(cardId, imageId);
            }
            scheduleAchievementCheck();

            setLearningText("");
            setLocalizedText("");
            setExampleSentence("");
            setImageQuery("");
            setImageResults([]);
            setSelectedImage(null);
            setDuplicateCard(null);
            setChoice(null);
            lastSearchedQuery.current = "";

            // Stay here for the next card: confirm, scroll to the top and focus the first field.
            setAddedMessage(`Added “${text.trim()}”`);
            if (addedTimer.current) clearTimeout(addedTimer.current);
            addedTimer.current = setTimeout(() => setAddedMessage(null), 2500);
            scrollRef.current?.scrollTo({ y: 0, animated: true });
            setTimeout(() => learningInputRef.current?.focus(), 150);
        } catch (error) {
            console.error("Failed to add card:", error);
        } finally {
            setSavingCard(false);
        }
    };

    // --------------------------------------------------
    // Add card button: check for a duplicate first
    // --------------------------------------------------

    const addCardToDatabase = async () => {
        if (savingCard) {
            return;
        }

        if (!learningText.trim() || !localizedText.trim()) {
            return;
        }

        const lastDeckId = await AsyncStorage.getItem("lastDeckId");

        if (!lastDeckId) {
            console.error("No selected deck");
            return;
        }

        setSavingCard(true);

        try {
            const found = (await findDuplicateCard(
                learningText.trim(),
                Number(lastDeckId)
            )) as ExistingCard | null;

            if (found) {
                setRenameText(learningText);
                setRenameDefinition(localizedText);
                setRenameExample(exampleSentence);
                setChoice(null);
                setDuplicateError("");
                setDuplicateCard(found);
                setSavingCard(false);
                return;
            }
        } catch (error) {
            console.error("Duplicate check failed:", error);
            setSavingCard(false);
            return;
        }

        await saveCard(learningText, localizedText, exampleSentence);
    };

    // --------------------------------------------------
    // Duplicate dialog actions
    // --------------------------------------------------

    const closeDuplicateDialog = () => {
        if (savingCard) {
            return;
        }

        setDuplicateCard(null);
        setChoice(null);
        setDuplicateError("");
    };

    const confirmChoice = async () => {
        if (!duplicateCard || !choice || savingCard) {
            return;
        }

        if (choice === "existing") {
            // Keep the card that is already in the deck; nothing is added.
            closeDuplicateDialog();
            return;
        }

        await saveCard(
            learningText,
            localizedText,
            exampleSentence,
            Number(duplicateCard.id)
        );
    };

    const renameAndAdd = async () => {
        if (!duplicateCard || savingCard) {
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

        await saveCard(name, definition, renameExample.trim());
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
    // Watermark
    // --------------------------------------------------

    const renderWatermark = (label: string) => (
        <Text style={styles.watermark} pointerEvents="none">
            {label}
        </Text>
    );

    // --------------------------------------------------
    // Duplicate dialog text
    // --------------------------------------------------

    const confirmLabel =
        choice === "existing"
            ? "Keep existing card"
            : choice === "new"
                ? "Replace with new card"
                : "Choose a card";

    // --------------------------------------------------
    // UI
    // --------------------------------------------------

    return (
        <KeyboardInsetView
            style={styles.container}
        >
            <ScrollView
                ref={scrollRef}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                {!!addedMessage && (
                    <View style={styles.addedBanner}>
                        <MaterialCommunityIcons
                            name="check-circle"
                            size={18}
                            color={COLORS.aqua}
                        />
                        <Text style={styles.addedText} numberOfLines={1}>
                            {addedMessage}
                        </Text>
                    </View>
                )}

                {/* Optional image: only searched for when you tap it */}

                <Pressable
                    style={styles.mainImageContainer}
                    onPress={openImagePicker}
                >
                    {selectedImage ? (
                        <Image
                            source={{ uri: selectedImage.downloadUrl }}
                            style={styles.mainImage}
                        />
                    ) : (
                        <View style={styles.imagePlaceholder}>
                            {searchingImages ? (
                                <ActivityIndicator
                                    size="large"
                                    color={COLORS.yellow}
                                />
                            ) : (
                                <>
                                    <MaterialCommunityIcons
                                        name="image-outline"
                                        size={50}
                                        color={COLORS.gray}
                                    />
                                    <Text style={styles.imageOptionalText}>
                                        Add an image (optional)
                                    </Text>
                                </>
                            )}
                        </View>
                    )}

                    {selectedImage && (
                        <Pressable
                            onPress={removeImage}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Remove image"
                            style={styles.removeImageBadge}
                        >
                            <MaterialCommunityIcons
                                name="close"
                                size={18}
                                color={COLORS.fg}
                            />
                        </Pressable>
                    )}

                    <View style={styles.changeImageBadge}>
                        <MaterialCommunityIcons
                            name="image-edit-outline"
                            size={17}
                            color={COLORS.fg}
                        />

                        <Text style={styles.changeImageText}>
                            {selectedImage ? "Change" : "Add"}
                        </Text>
                    </View>
                </Pressable>

                <View style={styles.form}>
                    {/* Learning language */}

                    <View style={styles.inputContainer}>
                        <TextInput
                            ref={learningInputRef}
                            style={styles.input}
                            value={learningText}
                            onChangeText={setLearningText}
                            placeholder="Enter the word or phrase"
                            placeholderTextColor={COLORS.gray}
                            multiline
                        />

                        {renderWatermark(
                            `${learningLanguageFlag} ${learningLanguageCode.toUpperCase()} `
                        )}

                        {renderTranslateButton("learningToLocalized")}
                    </View>

                    {/* Localized language */}

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
                            `${localizedLanguageFlag} ${localizedLanguageCode.toUpperCase()} `
                        )}

                        {renderTranslateButton("localizedToLearning")}
                    </View>

                    {/* Example */}

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={[styles.input, styles.exampleInput]}
                            value={exampleSentence}
                            onChangeText={setExampleSentence}
                            placeholder="Example sentence (optional)"
                            placeholderTextColor={COLORS.gray}
                            multiline
                        />

                        {!exampleSentence.trim() && (
                            <ExampleButton
                                learningText={learningText}
                                localizedText={localizedText}
                                languageName={getLanguage(learningLanguageCode)?.name ?? ""}
                                onExample={setExampleSentence}
                            />
                        )}

                        {renderWatermark("Example")}
                    </View>

                    {/* Add card */}

                    <Pressable
                        style={({ pressed }) => [
                            styles.button,
                            pressed && styles.buttonPressed,
                            savingCard && styles.buttonDisabled,
                        ]}
                        onPress={addCardToDatabase}
                        disabled={savingCard}
                    >
                        {savingCard && duplicateCard === null ? (
                            <ActivityIndicator
                                size="small"
                                color={COLORS.bg0}
                            />
                        ) : (
                            <Text style={styles.buttonText}>Add Card</Text>
                        )}
                    </Pressable>
                </View>
            </ScrollView>

            {/* Image picker modal */}

            <Modal
                visible={imageModalVisible}
                animationType="slide"
                transparent
                statusBarTranslucent
                onRequestClose={() => setImageModalVisible(false)}
            >
                <KeyboardInsetView
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContainer}>
                        {/* Modal header */}

                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Choose Image</Text>

                            <Pressable
                                onPress={() => setImageModalVisible(false)}
                                style={styles.closeButton}
                            >
                                <MaterialCommunityIcons
                                    name="close"
                                    size={24}
                                    color={COLORS.fg}
                                />
                            </Pressable>
                        </View>

                        {/* Search */}

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
                                style={({ pressed }) => [
                                    styles.searchButton,
                                    pressed && styles.searchButtonPressed,
                                ]}
                                onPress={() => searchForImages(imageQuery)}
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

                        {/* Results */}

                        <ScrollView contentContainerStyle={styles.modalResults}>
                            {imageResults.length > 0 ? (
                                <View style={styles.imageGrid}>
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
                                </View>
                            ) : searchingImages ? (
                                <View style={styles.emptyState}>
                                    <ActivityIndicator
                                        size="large"
                                        color={COLORS.yellow}
                                    />
                                </View>
                            ) : (
                                <View style={styles.emptyState}>
                                    <MaterialCommunityIcons
                                        name="image-search-outline"
                                        size={42}
                                        color={COLORS.gray}
                                    />

                                    <Text style={styles.emptyStateText}>
                                        Search for an image
                                    </Text>
                                </View>
                            )}
                        </ScrollView>

                        {/* Done */}

                        <Pressable
                            style={({ pressed }) => [
                                styles.doneButton,
                                pressed && styles.buttonPressed,
                            ]}
                            onPress={() => setImageModalVisible(false)}
                        >
                            <Text style={styles.buttonText}>Done</Text>
                        </Pressable>
                    </View>
                </KeyboardInsetView>
            </Modal>

            {/* Duplicate modal */}

            <Modal
                visible={duplicateCard !== null}
                animationType="slide"
                transparent
                statusBarTranslucent
                onRequestClose={closeDuplicateDialog}
            >
                <KeyboardInsetView
                    style={styles.modalOverlay}
                >
                    <View style={styles.duplicateContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Duplicate</Text>

                            <Pressable
                                onPress={closeDuplicateDialog}
                                style={styles.closeButton}
                            >
                                <MaterialCommunityIcons
                                    name="close"
                                    size={24}
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
                                This word is already in your deck. Tap the card
                                you want to keep.
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
                                    dimmed={choice === "new"}
                                    onPress={() => setChoice("existing")}
                                />
                                <ChoiceCard
                                    tone="new"
                                    label="New card"
                                    word={learningText}
                                    definition={localizedText}
                                    example={exampleSentence}
                                    selected={choice === "new"}
                                    dimmed={choice === "existing"}
                                    onPress={() => setChoice("new")}
                                />
                            </View>

                            <Pressable
                                style={({ pressed }) => [
                                    styles.button,
                                    styles.confirmButton,
                                    !choice && styles.buttonMuted,
                                    pressed && styles.buttonPressed,
                                ]}
                                onPress={confirmChoice}
                                disabled={!choice || savingCard}
                            >
                                {savingCard ? (
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
                                    onPress={renameAndAdd}
                                    disabled={savingCard}
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
        </KeyboardInsetView>
    );
}

const makeStyles = (t: Palette) => {
    const COLORS = makeCOLORS(t);
    return StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg0,
    },

    content: {
        padding: 20,
        paddingTop: 40,
        paddingBottom: 40,
    },

    form: {
        gap: 12,
    },

    inputContainer: {
        position: "relative",
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
        paddingRight: 56,
        fontSize: 16,
    },

    watermark: {
        position: "absolute",
        right: 12,
        bottom: 8,
        color: COLORS.gray,
        fontSize: 13,
        opacity: 0.45,
    },

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

    /* Main automatic image */

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

    imageOptionalText: {
        color: COLORS.gray,
        fontSize: 14,
        marginTop: 8,
    },

    removeImageBadge: {
        position: "absolute",
        top: 10,
        right: 10,
        backgroundColor: "rgba(40,40,40,0.85)",
        borderRadius: 16,
        padding: 6,
    },

    addedBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: COLORS.bg1,
        borderWidth: 1,
        borderColor: COLORS.aqua,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 14,
    },

    addedText: {
        flex: 1,
        color: COLORS.fg,
        fontSize: 14,
        fontWeight: "500",
    },

    changeImageText: {
        color: COLORS.fg,
        fontSize: 13,
        fontWeight: "600",
    },

    /* Modal */

    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.65)",
        justifyContent: "flex-end",
    },

    modalContainer: {
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

    modalTitle: {
        color: COLORS.fg,
        fontSize: 22,
        fontWeight: "bold",
    },

    closeButton: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
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

    searchButtonPressed: {
        opacity: 0.7,
    },

    modalResults: {
        paddingTop: 15,
        paddingBottom: 15,
    },

    imageGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
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

    emptyState: {
        minHeight: 250,
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
    },

    emptyStateText: {
        color: COLORS.gray,
        fontSize: 15,
    },

    /* Buttons */

    button: {
        backgroundColor: COLORS.yellowDark,
        padding: 16,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 12,
        minHeight: 54,
        justifyContent: "center",
    },

    doneButton: {
        backgroundColor: COLORS.yellowDark,
        padding: 15,
        borderRadius: 10,
        alignItems: "center",
        minHeight: 52,
        justifyContent: "center",
    },

    buttonPressed: {
        opacity: 0.7,
    },

    buttonDisabled: {
        opacity: 0.6,
    },

    buttonMuted: {
        backgroundColor: COLORS.bg2,
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

    choiceNew: {
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
        marginTop: 0,
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
        color: COLORS.red,
    },
    });
};