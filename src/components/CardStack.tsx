import { getCardImage } from "@/database/database";
import { downloadImageLocally, imageDisplayUrl, localImageUri } from "@/services/localImages";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    Image,
    Modal,
    PanResponder,
    PanResponderGestureState,
    Pressable,
    StyleProp,
    StyleSheet,
    Text,
    TextInput,
    View,
    ViewStyle,
} from "react-native";
import KeyboardInsetView from "./KeyboardInsetView";
import { Card } from "../models/Card";
import { prefetchSpeech, speakRemote, stopRemoteSpeech } from "@/services/tts";
import { answerSideFor, pickPromptSide, type PromptSide } from "../models/StudyMode";
import { fitText } from "../utils/textFit";

/* -------------------------------------------------------------------------- */
/*                              Constants & types                             */
/* -------------------------------------------------------------------------- */

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const SWIPE_THRESHOLD = 70;
const DELETE_THRESHOLD = 120;
const DELETE_PREVIEW_THRESHOLD = 20;
const TAP_THRESHOLD = 10;

const SWIPE_OUT_DURATION = 250;
const FLIP_DURATION = 500;

const SPEAK_GAP = 8;
const SPEAK_LARGE = 44;
const SPEAK_SMALL = 32;

// Width available to a line of text, used to size words so they are never split across lines.
// Card margin (learn screen) + card border + face padding.
const TEXT_AREA_WIDTH = SCREEN_WIDTH - 40 - 4 - 48;
const LEARNING_WIDTH = {
    large: TEXT_AREA_WIDTH - 2 * (SPEAK_LARGE + SPEAK_GAP),
    small: TEXT_AREA_WIDTH - 2 * (SPEAK_SMALL + SPEAK_GAP),
};
const LOCALIZED_WIDTH = TEXT_AREA_WIDTH;
const TEXT_SIZE = { large: 36, small: 18 };

const COLORS = {
    cardBackground: "#ebdbb2",
    cardBorder: "#d5c4a1",
    text: "#282828",
    hint: "#7c6f64",
    danger: "#cc241d",
    success: "#136d18",
};

type Direction = "left" | "right";


/* -------------------------------------------------------------------------- */
/*                              Answer grading                                */
/* -------------------------------------------------------------------------- */

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const isCorrect = (typed: string, expected: string) => normalize(typed) === normalize(expected);

/* -------------------------------------------------------------------------- */
/*                              Gesture helpers                               */
/* -------------------------------------------------------------------------- */

type Gesture = PanResponderGestureState;

const isMostlyVertical = (g: Gesture) => Math.abs(g.dy) > Math.abs(g.dx);
const isDeletePreview = (g: Gesture) => g.dy > DELETE_PREVIEW_THRESHOLD && isMostlyVertical(g);
const isDeleteGesture = (g: Gesture) => g.dy > DELETE_THRESHOLD && isMostlyVertical(g);
const isTap = (g: Gesture) => Math.abs(g.dx) < TAP_THRESHOLD && Math.abs(g.dy) < TAP_THRESHOLD;

/* -------------------------------------------------------------------------- */
/*                         Image cache + prefetching                          */
/* -------------------------------------------------------------------------- */
/*
 * Images are resolved once per card, prefetched into the native image cache,
 * and remembered. The NEXT card is resolved while the current one is on
 * screen, so by the time it becomes current its image is already there and
 * nothing pops in or shifts the layout.
 */

const imageUrlCache = new Map<number, string | null>();
const imageRequests = new Map<number, Promise<string | null>>();

/** Call this if a card's image is changed or removed elsewhere in the app. */
export const invalidateCardImage = (cardId: number) => {
    imageUrlCache.delete(cardId);
};

function resolveCardImage(cardId: number): Promise<string | null> {
    if (imageUrlCache.has(cardId)) {
        return Promise.resolve(imageUrlCache.get(cardId) ?? null);
    }

    let request = imageRequests.get(cardId);

    if (!request) {
        request = (async () => {
            try {
                const image = await getCardImage(cardId);
                let url = imageDisplayUrl(image) ?? null;

                if (url && !localImageUri(image)) {
                    const ok = await Image.prefetch(url).catch(() => false);
                    if (!ok) url = null; // file missing, show the card without an image
                    // Seen from the server: keep a copy on the phone for next time.
                    else if (image) void downloadImageLocally(image);
                }

                imageUrlCache.set(cardId, url);
                return url;
            } catch (error) {
                console.error("Failed to load card image:", error);
                return null; // not cached, so it can be retried later
            } finally {
                imageRequests.delete(cardId);
            }
        })();

        imageRequests.set(cardId, request);
    }

    return request;
}

interface CardImage {
    /** False until we know whether the card has an image. */
    ready: boolean;
    url: string | null;
}

function useCardImage(card?: Card): CardImage {
    const id = card?.id;

    // Start from the cache so already-known images render on the first frame.
    const [image, setImage] = useState<CardImage>(() => {
        if (id === undefined) return { ready: true, url: null };
        if (imageUrlCache.has(id)) return { ready: true, url: imageUrlCache.get(id) ?? null };
        return { ready: false, url: null };
    });

    useEffect(() => {
        if (id === undefined) return;

        let cancelled = false;

        resolveCardImage(id).then((url) => {
            if (!cancelled) setImage({ ready: true, url });
        });

        return () => {
            cancelled = true;
        };
    }, [id]);

    return image;
}

/* -------------------------------------------------------------------------- */
/*                              Prompt side hook                              */
/* -------------------------------------------------------------------------- */

/**
 * Remembers what each card shows first (the word, the meaning, or only the sound) until it is
 * swiped. It is chosen from the card's study level the first time the card is needed, so the card
 * underneath already shows the same thing when it becomes the current card.
 */
function usePromptSides(listening: boolean) {
    const sides = useRef(new Map<number, PromptSide>()).current;

    const get = (card: Card): PromptSide => {
        const id = card.id ?? -1;
        let side = sides.get(id);

        if (!side) {
            side = pickPromptSide(card.level, listening);
            sides.set(id, side);
        }

        return side;
    };

    const forget = (card: Card) => {
        sides.delete(card.id ?? -1);
    };

    return { get, forget };
}

/* -------------------------------------------------------------------------- */
/*                                 Flip hook                                  */
/* -------------------------------------------------------------------------- */

function useFlip() {
    const progress = useRef(new Animated.Value(0)).current;
    const [flipped, setFlipped] = useState(false);

    const flip = () => {
        if (flipped) return;

        setFlipped(true);

        Animated.timing(progress, {
            toValue: 1,
            duration: FLIP_DURATION,
            useNativeDriver: true,
        }).start();
    };

    const faces = useMemo(() => {
        const face = (rotate: [string, string], opacity: [number, number]) => ({
            opacity: progress.interpolate({
                inputRange: [0, 0.49, 0.5, 1],
                outputRange: [opacity[0], opacity[0], opacity[1], opacity[1]],
            }),
            transform: [
                { perspective: 1000 },
                {
                    rotateY: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: rotate,
                    }),
                },
            ],
        });

        return {
            front: face(["0deg", "180deg"], [1, 0]),
            back: face(["180deg", "360deg"], [0, 1]),
        };
    }, [progress]);

    return { flipped, flip, frontStyle: faces.front, backStyle: faces.back };
}

/* -------------------------------------------------------------------------- */
/*                               Gesture hook                                 */
/* -------------------------------------------------------------------------- */

interface GestureCallbacks {
    /** Left/right swipes are ignored (and the card is revealed) while false. */
    canSwipe: boolean;
    onSwipe: (direction: Direction) => void;
    onDelete: () => void;
    onTap: () => void;
}

function useCardGestures(callbacks: GestureCallbacks) {
    const position = useRef(new Animated.ValueXY()).current;
    const exitProgress = useRef(new Animated.Value(0)).current;
    const locked = useRef(false);
    const [deletePreview, setDeletePreview] = useState(false);

    // The PanResponder is created once, so it reads the latest callbacks here.
    const latest = useRef(callbacks);
    latest.current = callbacks;

    const panResponder = useMemo(() => {
        const slideOut = (x: number, y: number, done: () => void) => {
            locked.current = true;

            Animated.parallel([
                Animated.timing(position, {
                    toValue: { x, y },
                    duration: SWIPE_OUT_DURATION,
                    useNativeDriver: true,
                }),
                Animated.timing(exitProgress, {
                    toValue: 1,
                    duration: SWIPE_OUT_DURATION,
                    useNativeDriver: true,
                }),
            ]).start(done);
        };

        const swipe = (direction: Direction) =>
            slideOut(
                direction === "right" ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5,
                0,
                () => latest.current.onSwipe(direction)
            );

        const remove = () =>
            slideOut(0, SCREEN_HEIGHT * 0.8, () => latest.current.onDelete());

        const reset = () => {
            setDeletePreview(false);

            Animated.spring(position, {
                toValue: { x: 0, y: 0 },
                useNativeDriver: true,
            }).start();
        };

        return PanResponder.create({
            onStartShouldSetPanResponder: () => !locked.current,

            onMoveShouldSetPanResponder: (_, g) =>
                !locked.current &&
                (Math.abs(g.dx) > TAP_THRESHOLD || Math.abs(g.dy) > TAP_THRESHOLD),

            onPanResponderMove: (_, g) => {
                // LOCK: until the card is flipped it doesn't move at all
                if (!latest.current.canSwipe) return;

                position.setValue({ x: g.dx, y: g.dy });
                setDeletePreview(isDeletePreview(g));
            },

            onPanResponderRelease: (_, g) => {
                // Delete is also locked until flipped, so the card can't vanish without moving
                if (latest.current.canSwipe && isDeleteGesture(g)) return remove();

                const swipeDirection: Direction | null =
                    g.dx > SWIPE_THRESHOLD ? "right" : g.dx < -SWIPE_THRESHOLD ? "left" : null;

                if (swipeDirection) {
                    if (latest.current.canSwipe) return swipe(swipeDirection);

                    // Not flipped yet: reveal the answer
                    latest.current.onTap();
                    return reset();
                }

                if (isTap(g)) latest.current.onTap();
                reset();
            },

            onPanResponderTerminate: reset,
        });
    }, [position, exitProgress]);

    const rotate = position.x.interpolate({
        inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        outputRange: ["-10deg", "0deg", "10deg"],
        extrapolate: "clamp",
    });

    return {
        panHandlers: panResponder.panHandlers,
        deletePreview,

        currentTransform: [
            { translateX: position.x },
            { translateY: position.y },
            { rotate },
        ],

        // The card underneath grows into place as the top card leaves.
        nextCardTransform: [
            { scale: exitProgress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
            { translateY: exitProgress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
        ],
        nextContentOpacity: exitProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.45, 1],
        }),
    };
}

/* -------------------------------------------------------------------------- */
/*                            Small UI components                             */
/* -------------------------------------------------------------------------- */

interface SpeakButtonProps {
    onPress?: () => void;
    small?: boolean;
    style?: StyleProp<ViewStyle>;
    /** Draw the button but make it inert: used on the card underneath, so it is already there when that card arrives. */
    decorative?: boolean;
}

/**
 * Without `onPress` it renders an invisible spacer of the same size, so the
 * learning row can stay symmetric around the word.
 */
function SpeakButton({ onPress, small, style, decorative }: SpeakButtonProps) {
    const size = small ? styles.speakSmall : styles.speakLarge;

    if (!onPress && decorative) {
        return (
            <View pointerEvents="none" style={[styles.speakButton, size, style]}>
                <Ionicons name="volume-high" size={small ? 16 : 22} color={COLORS.text} />
            </View>
        );
    }

    if (!onPress) {
        return <View style={[size, styles.invisible, style]} />;
    }

    return (
        <Pressable
            onPress={onPress}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Play pronunciation"
            style={({ pressed }) => [
                styles.speakButton,
                size,
                pressed && styles.speakPressed,
                style,
            ]}
        >
            <Ionicons
                name="volume-high"
                size={small ? 16 : 22}
                color={COLORS.text}
            />
        </Pressable>
    );
}

/** The front of a listening card: no text at all, just the sound (tap to hear it again). */
function AudioPrompt({ onPress }: { onPress?: () => void }) {
    return (
        <View style={styles.term}>
            <Pressable
                onPress={onPress}
                disabled={!onPress}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Play the word again"
                style={({ pressed }) => [styles.audioButton, pressed && styles.speakPressed]}
            >
                <Ionicons name="volume-high" size={44} color={COLORS.text} />
            </Pressable>
            <Text style={styles.audioHint}>Listen</Text>
        </View>
    );
}

interface TermProps {
    card: Card;
    side: Exclude<PromptSide, "audio">;
    image: CardImage;
    size?: "large" | "small";
    onSpeak?: () => void;
    /** Show the speaker even without `onSpeak` (the next card). */
    previewSpeaker?: boolean;
    showRomanization?: boolean;
}

/** One language of a card: learning text (+ romanization + speaker) or image + localized text. */
function Term({
    card,
    side,
    image,
    size = "large",
    onSpeak,
    previewSpeaker,
    showRomanization = true,
}: TermProps) {
    const small = size === "small";
    const textStyle = small ? styles.textSmall : styles.textLarge;

    if (side === "learning") {
        const romanization = showRomanization ? card.romanization?.trim() : undefined;
        const fit = fitText(card.learningText, {
            baseSize: TEXT_SIZE[size],
            maxWidth: LEARNING_WIDTH[size],
            maxLines: 2,
        });

        return (
            <View style={styles.term}>
                <View style={styles.learningRow}>
                    <SpeakButton
                        small={small}
                        onPress={onSpeak}
                        decorative={previewSpeaker}
                        style={styles.speakGapStart}
                    />

                    <Text
                        style={[textStyle, styles.learningText, { fontSize: fit.fontSize }]}
                        numberOfLines={fit.numberOfLines}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                    >
                        {card.learningText}
                    </Text>

                    {/* Invisible twin of the speaker: keeps the word exactly centered */}
                    <SpeakButton small={small} style={styles.speakGapEnd} />
                </View>

                {!!romanization && (
                    <Text style={small ? styles.romanizationSmall : styles.romanization}>
                        {romanization}
                    </Text>
                )}
            </View>
        );
    }

    const localizedFit = fitText(card.localizedText, {
        baseSize: TEXT_SIZE[size],
        maxWidth: LOCALIZED_WIDTH,
        maxLines: 3,
    });

    // Hidden (not removed) until we know if there is an image,
    // so the final layout appears in one go instead of jumping around.
    return (
        <View style={[styles.term, !image.ready && styles.invisible]}>
            {!!image.url && (
                <Image
                    source={{ uri: image.url }}
                    style={small ? styles.imageSmall : styles.imageLarge}
                    resizeMode="cover"
                />
            )}

            <Text
                style={[textStyle, { fontSize: localizedFit.fontSize }]}
                numberOfLines={localizedFit.numberOfLines}
                adjustsFontSizeToFit
            >
                {card.localizedText}
            </Text>
        </View>
    );
}

/* -------------------------------------------------------------------------- */
/*                                  Wrapper                                   */
/* -------------------------------------------------------------------------- */

interface CardStackProps {
    currentCard: Card;
    nextCard?: Card;
    ttsCode?: string;
    /** Exact voice to use (see utils/voices). Without one the phone picks by language. */
    ttsVoice?: string;
    /** Voice id on the server, for languages the phone cannot speak (takes the place of the phone's voice). */
    remoteVoice?: string;
    /** False when the phone has no voice for the language: nothing is spoken rather than a wrong voice. */
    speechAvailable?: boolean;
    cardKey: number;
    /** Read the learning text aloud when it appears (the speaker buttons always work). */
    autoSpeak?: boolean;
    showRomanization?: boolean;
    /** Allow listening-only cards. Off: those reviews show the learning word instead. */
    listening?: boolean;
    /** `prompt` is what the front of the card showed, for the review log. */
    onSwipe: (direction: Direction, prompt: PromptSide) => void;
    onDelete: () => void;
}

export default function CardStack({
    currentCard,
    nextCard,
    cardKey,
    ttsCode,
    ttsVoice,
    remoteVoice,
    speechAvailable = true,
    autoSpeak = true,
    showRomanization = true,
    listening = true,
    onSwipe,
    onDelete,
}: CardStackProps) {
    const sides = usePromptSides(listening);

    const handleSwipe = (direction: Direction, prompt: PromptSide) => {
        sides.forget(currentCard);
        onSwipe(direction, prompt);
    };

    return (
        <View style={styles.container}>
            <ActiveCards
                key={cardKey}
                currentCard={currentCard}
                nextCard={nextCard}
                initialPromptSide={sides.get(currentCard)}
                nextSide={nextCard ? sides.get(nextCard) : "learning"}
                ttsCode={ttsCode}
                ttsVoice={ttsVoice}
                remoteVoice={remoteVoice}
                speechAvailable={speechAvailable}
                autoSpeak={autoSpeak}
                showRomanization={showRomanization}
                onSwipe={handleSwipe}
                onDelete={onDelete}
            />
        </View>
    );
}

/* -------------------------------------------------------------------------- */
/*                           Current + next card                              */
/* -------------------------------------------------------------------------- */

interface ActiveCardsProps {
    currentCard: Card;
    nextCard?: Card;
    initialPromptSide: PromptSide;
    nextSide: PromptSide;
    ttsCode?: string;
    ttsVoice?: string;
    remoteVoice?: string;
    speechAvailable: boolean;
    autoSpeak: boolean;
    showRomanization: boolean;
    onSwipe: (direction: Direction, prompt: PromptSide) => void;
    onDelete: () => void;
}

function ActiveCards({
    currentCard,
    nextCard,
    initialPromptSide,
    nextSide,
    ttsCode,
    ttsVoice,
    remoteVoice,
    speechAvailable,
    autoSpeak,
    showRomanization,
    onSwipe,
    onDelete,
}: ActiveCardsProps) {
    // The prompt side is frozen for the lifetime of this card (the component is re-keyed per card).
    // The next card's side is remembered per card by usePromptSides, so it is stable even if the next card changes.
    const [promptSide] = useState(initialPromptSide);
    const answerSide = answerSideFor(promptSide);
    // On a listening card the word is only revealed on the back, as the small second line.
    const revealedSide = promptSide === "audio" ? "learning" : promptSide;

    const currentImage = useCardImage(currentCard);
    const nextImage = useCardImage(nextCard); // prefetch for the next card

    const { flipped, flip, frontStyle, backStyle } = useFlip();
    const gestures = useCardGestures({
        canSwipe: flipped,
        onSwipe: (direction) => onSwipe(direction, promptSide),
        onDelete,
        onTap: flip,
    });

    /* ------------------------- Typed answer + grading --------------------- */

    const [typed, setTyped] = useState("");
    const [typing, setTyping] = useState(false);
    const [result, setResult] = useState<"correct" | "wrong" | null>(null);

    const expected =
        answerSide === "learning" ? currentCard.learningText : currentCard.localizedText;

    const submit = () => {
        if (flipped) return;

        setTyping(false);
        if (!typed.trim()) return;

        setResult(isCorrect(typed, expected) ? "correct" : "wrong");
        flip();
    };

    /* ------------------------------ Speech ------------------------------- */

    const speak = (text: string) => {
        Speech.stop();
        if (remoteVoice) {
            void speakRemote(remoteVoice, text);
            return;
        }
        // No voice for this language: stay silent instead of an English voice reading it letter by letter.
        if (!speechAvailable) return;
        Speech.speak(text, { language: ttsCode, voice: ttsVoice, rate: 1.0 });
    };

    const speakLearning = () => speak(currentCard.learningText);

    const exampleText = currentCard.exampleSentence?.trim();

    // Read the learning text aloud whenever it becomes visible.
    // Fetch the next card's audio ahead of time so it plays at once when it arrives.
    const nextText = nextCard?.learningText;
    useEffect(() => {
        if (remoteVoice && nextText) prefetchSpeech(remoteVoice, nextText);
    }, [remoteVoice, nextText]);

    const learningIsVisible = promptSide === "learning" ? !flipped : flipped;

    // A listening card must be heard, whatever the automatic-pronunciation setting says.
    const speakOnAppear = promptSide === "audio" || (autoSpeak && learningIsVisible);

    useEffect(() => {
        if (speakOnAppear) speakLearning();

        return () => {
            Speech.stop();
            stopRemoteSpeech();
        };
    }, [currentCard.id, speakOnAppear]);


    /* ------------------------------ Render ------------------------------- */

    return (
        <>
            {/* Next card (same layout as a real card, so the swap is seamless) */}
            {nextCard && (
                <Animated.View
                    style={[styles.card, { transform: gestures.nextCardTransform }]}
                >
                    <Animated.View
                        style={[styles.cardFace, { opacity: gestures.nextContentOpacity }]}
                    >
                        {nextSide === "audio" ? (
                            <AudioPrompt />
                        ) : (
                            <Term
                                card={nextCard}
                                side={nextSide}
                                image={nextImage}
                                previewSpeaker
                                showRomanization={showRomanization}
                            />
                        )}

                        {/* Same buttons as the real card, so nothing pops in when it arrives */}
                        <View pointerEvents="none" style={styles.typeButton}>
                            <Ionicons name="create-outline" size={20} color={COLORS.text} />
                        </View>
                    </Animated.View>
                </Animated.View>
            )}

            {/* Current card */}
            <Animated.View
                {...gestures.panHandlers}
                style={[
                    styles.card,
                    styles.currentCard,
                    gestures.deletePreview && styles.deleteCard,
                    { transform: gestures.currentTransform },
                ]}
            >
                {gestures.deletePreview && (
                    <View style={styles.deleteMessage}>
                        <Text style={styles.deleteText}>Delete card?</Text>
                    </View>
                )}

                {/* Front: the prompt */}
                <Animated.View
                    pointerEvents={flipped ? "none" : "auto"}
                    style={[styles.cardFace, frontStyle]}
                >
                    {promptSide === "audio" ? (
                        <AudioPrompt onPress={speakLearning} />
                    ) : (
                        <Term
                            card={currentCard}
                            side={promptSide}
                            image={currentImage}
                            onSpeak={speakLearning}
                            showRomanization={showRomanization}
                        />
                    )}

                    <Pressable
                        onPress={() => setTyping(true)}
                        accessibilityRole="button"
                        style={styles.typeButton}
                    >
                        <Ionicons name="create-outline" size={20} color={COLORS.text} />

                    </Pressable>
                </Animated.View>

                {/* Back: the answer, what you typed, the other language, and the example */}
                <Animated.View
                    pointerEvents={flipped ? "auto" : "none"}
                    style={[styles.cardFace, backStyle]}
                >
                    <Term
                        card={currentCard}
                        side={answerSide}
                        image={currentImage}
                        onSpeak={speakLearning}
                        showRomanization={showRomanization}
                    />

                    {!!typed.trim() && (
                        <Text
                            style={[
                                styles.typed,
                                result === "correct" && styles.typedCorrect,
                                result === "wrong" && styles.typedWrong,
                            ]}
                        >
                            {typed.trim()}
                        </Text>
                    )}

                    <View style={styles.secondary}>
                        <Term
                            card={currentCard}
                            side={revealedSide}
                            image={currentImage}
                            size="small"
                            onSpeak={speakLearning}
                            showRomanization={showRomanization}
                        />
                    </View>

                    {!!exampleText && (
                        <View style={styles.exampleRow}>
                            <SpeakButton small onPress={() => speak(exampleText)} />
                            <Text style={styles.exampleText}>{exampleText}</Text>
                        </View>
                    )}
                </Animated.View>
            </Animated.View>

            {/* Answer input: slides above the keyboard */}
            <Modal
                visible={typing}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => setTyping(false)}
            >
                <KeyboardInsetView
                    style={styles.modalRoot}
                >
                    <Pressable style={styles.backdrop} onPress={() => setTyping(false)} />

                    <View style={styles.sheet}>
                        <TextInput
                            value={typed}
                            onChangeText={setTyped}
                            onSubmitEditing={submit}
                            placeholderTextColor={COLORS.hint}
                            autoFocus
                            autoCapitalize="none"
                            autoCorrect={false}
                            returnKeyType="done"
                            style={styles.input}
                        />

                        <Pressable
                            onPress={submit}
                            accessibilityRole="button"
                            style={styles.checkButton}
                        >
                            <Text style={styles.checkText}>Check</Text>
                        </Pressable>
                    </View>
                </KeyboardInsetView>
            </Modal>
        </>
    );
}

/* -------------------------------------------------------------------------- */
/*                                   Styles                                   */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: "100%",
    },

    /* Card shell */

    card: {
        ...StyleSheet.absoluteFill,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: COLORS.cardBackground,
        borderRadius: 28,
        borderWidth: 2,
        borderColor: COLORS.cardBorder,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 6,
        zIndex: 1,
    },

    currentCard: {
        zIndex: 2,
    },

    cardFace: {
        ...StyleSheet.absoluteFill,
        paddingHorizontal: 24,
        justifyContent: "center",
        alignItems: "center",
        backfaceVisibility: "hidden",
    },

    invisible: {
        opacity: 0,
    },

    /* Terms (one language of a card) */

    term: {
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
    },

    secondary: {
        width: "100%",
        marginTop: 20,
    },

    textLarge: {
        alignSelf: "stretch",
        color: COLORS.text,
        fontSize: 36,
        fontWeight: "500",
        textAlign: "center",
        includeFontPadding: false,
    },

    textSmall: {
        alignSelf: "stretch",
        color: COLORS.hint,
        fontSize: 18,
        textAlign: "center",
        includeFontPadding: false,
    },

    romanization: {
        color: COLORS.hint,
        fontSize: 18,
        marginTop: 8,
        textAlign: "center",
    },

    romanizationSmall: {
        color: COLORS.hint,
        fontSize: 13,
        marginTop: 4,
        textAlign: "center",
    },

    imageLarge: {
        width: "82%",
        height: 190,
        borderRadius: 16,
        marginBottom: 20,
    },

    imageSmall: {
        width: "60%",
        height: 120,
        borderRadius: 12,
        marginBottom: 12,
    },

    /* Listening prompt */

    audioButton: {
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.cardBorder,
    },

    audioHint: {
        marginTop: 12,
        color: COLORS.hint,
        fontSize: 15,
        letterSpacing: 1,
        textTransform: "uppercase",
    },

    /* Learning row: [speaker][gap] word [gap][invisible twin] */

    learningRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },

    learningText: {
        flexShrink: 1, // long words shrink/wrap instead of pushing the buttons out
        alignSelf: "center", // overrides alignSelf: "stretch" from textLarge/textSmall
    },

    speakGapStart: {
        marginRight: SPEAK_GAP,
    },

    speakGapEnd: {
        marginLeft: SPEAK_GAP,
    },

    /* Speaker button */

    speakButton: {
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.cardBorder,
    },

    speakLarge: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },

    speakSmall: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },

    speakPressed: {
        opacity: 0.6,
        transform: [{ scale: 0.94 }],
    },

    /* Example sentence */

    exampleRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginTop: 24,
        paddingTop: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.hint,
    },

    exampleText: {
        flex: 1,
        color: COLORS.hint,
        fontSize: 17,
        fontStyle: "italic",
    },

    /* Typed answer (back of card) */

    typed: {
        marginTop: 12,
        fontSize: 22,
        fontWeight: "600",
        color: COLORS.hint, // used when the card was flipped without grading
    },

    typedCorrect: {
        color: COLORS.success,
    },

    typedWrong: {
        color: COLORS.danger,
        textDecorationLine: "line-through",
    },

    /* "Type answer" button (front of card) */

    typeButton: {
        position: "absolute",
        bottom: 24,
        alignSelf: "center",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 20,
        backgroundColor: COLORS.cardBorder,
    },

    typeButtonText: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: "500",
    },

    /* Input modal */

    modalRoot: {
        flex: 1,
        justifyContent: "flex-end",
    },

    backdrop: {
        ...StyleSheet.absoluteFill,
        backgroundColor: "rgba(0,0,0,0.4)",
    },

    sheet: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 16,
        backgroundColor: COLORS.cardBackground,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },

    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 18,
        color: COLORS.text,
        backgroundColor: "#fbf1c7",
    },

    checkButton: {
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: COLORS.text,
    },

    checkText: {
        color: COLORS.cardBackground,
        fontSize: 16,
        fontWeight: "600",
    },

    /* Delete preview */

    deleteCard: {
        borderColor: COLORS.danger,
        borderWidth: 3,
    },

    deleteMessage: {
        position: "absolute",
        top: 20,
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 10,
    },

    deleteText: {
        color: COLORS.danger,
        fontSize: 17,
        fontWeight: "bold",
    },
});