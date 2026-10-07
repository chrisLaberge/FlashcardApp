import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
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

import {
    ImageSearchResult,
    downloadImage,
    searchImages,
} from "@/services/imageApi";

import {
    addImage,
    getCardImage,
    setCardImage,
} from "../database/database";
import { getRomanization } from "../utils/romanization";

import { translateText } from "@/services/translationApi";
import { getLanguage } from "../constants/languages";
import {
    deleteCard,
    getCard,
    getCardProgress,
    getDecks,
    resetCardProgress,
    updateCard,
} from "../database/database";

import { CardProgress } from "../models/CardProgress";

type TranslationDirection = "learningToLocalized" | "localizedToLearning" | null;

// Gruvbox palette
const COLORS = {
    bg0: "#282828",
    bg1: "#3c3836",
    bg2: "#504945",
    fg: "#ebdbb2",
    gray: "#a89984",
    yellow: "#fabd2f",
    yellowDark: "#d79921",
    red: "#cc241d",
    blue: "#5992b1",
};

export default function EditCardScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const cardId = Number(id);

    const [learningText, setLearningText] = useState("");
    const [localizedText, setLocalizedText] = useState("");
    const [exampleSentence, setExampleSentence] = useState("");
    const [progress, setProgress] = useState<CardProgress>();
    const [showProgress, setShowProgress] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);

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

    useEffect(() => {
        const loadCard = async () => {
            const card = await getCard(cardId);

            if (card) {
                setLearningText(card.learningText);
                setLocalizedText(card.localizedText);
                setExampleSentence(card.exampleSentence ?? "");
            }

            const cardProgress = await getCardProgress(cardId);

            if (cardProgress) {
                setProgress(cardProgress);
            }

            const image = await getCardImage(cardId);

            if (image) {
                setCurrentImageUrl(
                    `http://10.0.0.208:3000${image.file_path}`
                );
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

    const saveChanges = async () => {
        const romanization =
            (await getRomanization(
                learningText,
                learningLanguageCode
            )) ?? "";

        await updateCard(
            cardId,
            learningText,
            localizedText,
            exampleSentence,
            romanization
        );

        if (selectedImage) {
            const downloaded =
                await downloadImage(selectedImage);

            const imageId = await addImage(
                selectedImage.source,
                String(selectedImage.id),
                downloaded.imageUrl,
                null,
                selectedImage.pageUrl,
                selectedImage.photographer,
                selectedImage.photographerUrl
            );

            await setCardImage(
                cardId,
                imageId
            );
        }

        router.back();
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

    // --------------------------------------------------
    // UI
    // --------------------------------------------------

    return (
        <ScrollView
            style={styles.container}
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
                    ]}
                    onPress={saveChanges}
                >
                    <Text style={styles.saveButtonText}>Save Changes</Text>
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
                onRequestClose={() => setImageModalVisible(false)}
            >
                <View style={styles.imageModalOverlay}>
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
                </View>
            </Modal>
        </ScrollView>
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg0,
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
        marginTop: 8,
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
});