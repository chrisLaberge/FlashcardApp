import { getCardImage } from "@/database/database";
import { resolveImageUrl } from "@/services/imageApi";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    Image,
    PanResponder,
    PanResponderGestureState,
    Pressable,
    StyleProp,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from "react-native";
import { Card } from "../models/Card";

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

const COLORS = {
    cardBackground: "#ebdbb2",
    cardBorder: "#d5c4a1",
    text: "#282828",
    hint: "#7c6f64",
    danger: "#cc241d",
};

type Direction = "left" | "right";
type PromptSide = "learning" | "localized";

const oppositeSide = (side: PromptSide): PromptSide =>
    side === "learning" ? "localized" : "learning";

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
                let url = resolveImageUrl(image?.file_path) ?? null;

                if (url) {
                    const ok = await Image.prefetch(url).catch(() => false);
                    if (!ok) url = null; // file missing, show the card without an image
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

/** Remembers which language each card starts on, until the card is swiped. */
function usePromptSides() {
    const sides = useRef(new Map<number, PromptSide>()).current;

    const get = (card: Card): PromptSide => {
        const id = card.id ?? -1;
        let side = sides.get(id);

        if (!side) {
            side = Math.random() < 0.5 ? "learning" : "localized";
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
}

/**
 * Without `onPress` it renders an invisible spacer of the same size, so the
 * preview card has exactly the same layout as the real card.
 */
function SpeakButton({ onPress, small, style }: SpeakButtonProps) {
    const size = small ? styles.speakSmall : styles.speakLarge;

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

interface TermProps {
    card: Card;
    side: PromptSide;
    image: CardImage;
    size?: "large" | "small";
    onSpeak?: () => void;
}

/** One language of a card: learning text (+ romanization + speaker) or image + localized text. */
function Term({ card, side, image, size = "large", onSpeak }: TermProps) {
    const small = size === "small";
    const textStyle = small ? styles.textSmall : styles.textLarge;

    if (side === "learning") {
        const romanization = card.romanization?.trim();

        return (
            <View style={styles.term}>
                <View style={styles.learningRow}>
                    <SpeakButton
                        small={small}
                        onPress={onSpeak}
                        style={styles.speakGapStart}
                    />

                    <Text
                        style={[textStyle, styles.learningText]}
                        numberOfLines={2}
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

            <Text style={textStyle} numberOfLines={3} adjustsFontSizeToFit>
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
    cardKey: number;
    onSwipe: (direction: Direction) => void;
    onDelete: () => void;
}

export default function CardStack({
    currentCard,
    nextCard,
    cardKey,
    ttsCode,
    onSwipe,
    onDelete,
}: CardStackProps) {
    const sides = usePromptSides();

    const handleSwipe = (direction: Direction) => {
        sides.forget(currentCard);
        onSwipe(direction);
    };

    return (
        <View style={styles.container}>
            <ActiveCards
                key={cardKey}
                currentCard={currentCard}
                nextCard={nextCard}
                initialPromptSide={sides.get(currentCard)}
                initialNextSide={nextCard ? sides.get(nextCard) : "learning"}
                ttsCode={ttsCode}
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
    initialNextSide: PromptSide;
    ttsCode?: string;
    onSwipe: (direction: Direction) => void;
    onDelete: () => void;
}

function ActiveCards({
    currentCard,
    nextCard,
    initialPromptSide,
    initialNextSide,
    ttsCode,
    onSwipe,
    onDelete,
}: ActiveCardsProps) {
    // Frozen for the lifetime of this card (the component is re-keyed per card).
    const [promptSide] = useState(initialPromptSide);
    const [nextSide] = useState(initialNextSide);
    const answerSide = oppositeSide(promptSide);

    const currentImage = useCardImage(currentCard);
    const nextImage = useCardImage(nextCard); // prefetch for the next card

    const { flipped, flip, frontStyle, backStyle } = useFlip();
    const gestures = useCardGestures({
        canSwipe: flipped,
        onSwipe,
        onDelete,
        onTap: flip,
    });

    /* ------------------------------ Speech ------------------------------- */

    const speak = (text: string) => {
        Speech.stop();
        Speech.speak(text, { language: ttsCode, rate: 1.0 });
    };

    const speakLearning = () => speak(currentCard.learningText);

    const exampleText = currentCard.exampleSentence?.trim();

    // Read the learning text aloud whenever it becomes visible.
    const learningIsVisible = promptSide === "learning" ? !flipped : flipped;

    useEffect(() => {
        if (learningIsVisible) speakLearning();

        return () => {
            Speech.stop();
        };
    }, [currentCard.id, learningIsVisible]);

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
                        <Term card={nextCard} side={nextSide} image={nextImage} />
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
                    <Term
                        card={currentCard}
                        side={promptSide}
                        image={currentImage}
                        onSpeak={speakLearning}
                    />
                </Animated.View>

                {/* Back: the answer, the other language, and the example */}
                <Animated.View
                    pointerEvents={flipped ? "auto" : "none"}
                    style={[styles.cardFace, backStyle]}
                >
                    <Term
                        card={currentCard}
                        side={answerSide}
                        image={currentImage}
                        onSpeak={speakLearning}
                    />

                    <View style={styles.secondary}>
                        <Term
                            card={currentCard}
                            side={promptSide}
                            image={currentImage}
                            size="small"
                            onSpeak={speakLearning}
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

    speakGapSmall: {
        marginTop: 8,
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

    learningRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },

    learningText: {
        flexShrink: 1,
        alignSelf: "center",
    },

    speakGapStart: {
        marginRight: SPEAK_GAP,
    },

    speakGapEnd: {
        marginLeft: SPEAK_GAP,
    },

});