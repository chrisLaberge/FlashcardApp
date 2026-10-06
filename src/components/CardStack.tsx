import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    PanResponder,
    PanResponderGestureState,
    Pressable,
    StyleProp,
    StyleSheet,
    Text,
    TextStyle,
    View,
} from "react-native";
import { Card } from "../models/Card";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
    Dimensions.get("window");

const SWIPE_THRESHOLD = 100;
const DELETE_THRESHOLD = 120;
const DELETE_PREVIEW_THRESHOLD = 20;
const TAP_THRESHOLD = 10;

const SWIPE_OUT_DURATION = 250;
const FLIP_DURATION = 500;

type Direction = "left" | "right";
type PromptSide = "learning" | "localized";

const isMostlyVertical = (g: PanResponderGestureState) =>
    Math.abs(g.dy) > Math.abs(g.dx);

const isDeletePreview = (g: PanResponderGestureState) =>
    g.dy > DELETE_PREVIEW_THRESHOLD && isMostlyVertical(g);

const isDeleteGesture = (g: PanResponderGestureState) =>
    g.dy > DELETE_THRESHOLD && isMostlyVertical(g);

const isTap = (g: PanResponderGestureState) =>
    Math.abs(g.dx) < TAP_THRESHOLD && Math.abs(g.dy) < TAP_THRESHOLD;

const randomPromptSide = (): PromptSide =>
    Math.random() < 0.5 ? "learning" : "localized";

const textFor = (card: Card, side: PromptSide) =>
    side === "learning" ? card.learningText : card.localizedText;

/* -------------------------------------------------------------------------- */
/*                                   Wrapper                                  */
/* -------------------------------------------------------------------------- */

interface CardStackProps {
    currentCard: Card;
    nextCard?: Card;
    ttsCode?: string;

    /** Change this whenever the visible card changes (advance, undo, reload). */
    cardKey: number;

    onSwipe: (direction: Direction) => void;
    onDelete: () => void;
}

/**
 * Decides which side each card starts on, so the card waiting behind the
 * current one can already show the same prompt it will have once it's on top.
 */
export default function CardStack({
    currentCard,
    nextCard,
    cardKey,
    ttsCode,
    onSwipe,
    onDelete,
}: CardStackProps) {
    const sides = useRef(new Map<number, PromptSide>()).current;

    const getSide = (card: Card): PromptSide => {
        const id = card.id ?? -1;

        let side = sides.get(id);

        if (!side) {
            side = randomPromptSide();
            sides.set(id, side);
        }

        return side;
    };

    const handleSwipe = (direction: Direction) => {
        // Forget the side so a repeated card gets a fresh random one
        sides.delete(currentCard.id ?? -1);

        onSwipe(direction);
    };

    return (
        <View style={styles.container}>
            <ActiveCards
                key={cardKey}
                currentCard={currentCard}
                nextCard={nextCard}
                initialPromptSide={getSide(currentCard)}
                initialNextSide={nextCard ? getSide(nextCard) : "learning"}
                onSwipe={handleSwipe}
                onDelete={onDelete}
                ttsCode={ttsCode}
            />
        </View>
    );
}

/* -------------------------------------------------------------------------- */
/*                      Current + next card (remounted per card)              */
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
    // Frozen for the lifetime of this mount, so re-renders can't change them
    const [promptSide] = useState(initialPromptSide);
    const [nextSide] = useState(initialNextSide);

    const [hasFlipped, setHasFlipped] = useState(false);
    const [deletePreview, setDeletePreview] = useState(false);

    // Fresh values on every mount, so no reset step is needed
    const position = useRef(new Animated.ValueXY()).current;
    const nextCardProgress = useRef(new Animated.Value(0)).current;
    const flipAnimation = useRef(new Animated.Value(0)).current;

    const isLocked = useRef(false);

    const latest = useRef({
        flipCard: () => { },
        forceSwipe: (_: Direction) => { },
        forceDelete: () => { },
        resetPosition: () => { },
    });

    const slideOut = (
        toValue: { x: number; y: number },
        done: () => void
    ) => {
        isLocked.current = true;

        Animated.parallel([
            Animated.timing(position, {
                toValue,
                duration: SWIPE_OUT_DURATION,
                useNativeDriver: true,
            }),

            Animated.timing(nextCardProgress, {
                toValue: 1,
                duration: SWIPE_OUT_DURATION,
                useNativeDriver: true,
            }),
        ]).start(done);
    };

    const forceSwipe = (direction: Direction) => {
        const x =
            direction === "right"
                ? SCREEN_WIDTH * 1.5
                : -SCREEN_WIDTH * 1.5;

        slideOut({ x, y: 0 }, () => onSwipe(direction));
    };

    const forceDelete = () =>
        slideOut({ x: 0, y: SCREEN_HEIGHT * 0.8 }, onDelete);

    const resetPosition = () => {
        setDeletePreview(false);

        Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
        }).start();
    };

    const flipCard = () => {
        if (hasFlipped) return;

        setHasFlipped(true);

        Animated.timing(flipAnimation, {
            toValue: 1,
            duration: FLIP_DURATION,
            useNativeDriver: true,
        }).start();
    };

    latest.current = {
        flipCard,
        forceSwipe,
        forceDelete,
        resetPosition,
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => !isLocked.current,

            onMoveShouldSetPanResponder: (_, g) =>
                !isLocked.current &&
                (Math.abs(g.dx) > TAP_THRESHOLD ||
                    Math.abs(g.dy) > TAP_THRESHOLD),

            onPanResponderMove: (_, g) => {
                position.setValue({
                    x: g.dx,
                    y: g.dy,
                });

                setDeletePreview(isDeletePreview(g));
            },

            onPanResponderRelease: (_, g) => {
                const { flipCard, forceSwipe, forceDelete, resetPosition } =
                    latest.current;

                if (isDeleteGesture(g)) {
                    return forceDelete();
                }

                if (g.dx > SWIPE_THRESHOLD) {
                    return forceSwipe("right");
                }

                if (g.dx < -SWIPE_THRESHOLD) {
                    return forceSwipe("left");
                }

                if (isTap(g)) {
                    flipCard();
                }

                resetPosition();
            },

            onPanResponderTerminate: () => latest.current.resetPosition(),
        })
    ).current;

    /* ------------------------------ Interpolations ------------------------------ */

    const promptRotate = flipAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "180deg"],
    });

    const answerRotate = flipAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: ["180deg", "360deg"],
    });

    const promptOpacity = flipAnimation.interpolate({
        inputRange: [0, 0.49, 0.5, 1],
        outputRange: [1, 1, 0, 0],
    });

    const answerOpacity = flipAnimation.interpolate({
        inputRange: [0, 0.49, 0.5, 1],
        outputRange: [0, 0, 1, 1],
    });

    const rotate = position.x.interpolate({
        inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        outputRange: ["-10deg", "0deg", "10deg"],
        extrapolate: "clamp",
    });

    const nextCardScale = nextCardProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.94, 1],
    });

    const nextCardTranslateY = nextCardProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [12, 0],
    });

    /* ---------------------------------- Content --------------------------------- */

    const answerSide: PromptSide =
        promptSide === "learning" ? "localized" : "learning";

    const promptText = textFor(currentCard, promptSide);
    const answerText = textFor(currentCard, answerSide);

    const exampleText = currentCard.exampleSentence?.trim();

    // Always read the word being learned, whichever face is showing it
    const speak = () => {
        Speech.stop();

        Speech.speak(currentCard.learningText, {
            language: ttsCode,
            rate: 1.0,
        });
    };

    // Stop audio when this card goes away (swipe, delete, undo)
    useEffect(
        () => () => {
            Speech.stop();
        },
        []
    );

    /**
     * One line of card text. When the text is in the language being learned,
     * the speaker button sits to the left of it.
     */
    const renderLine = (
        text: string,
        side: PromptSide,
        textStyle: StyleProp<TextStyle>,
        small = false
    ) => (
        <View style={styles.line}>
            {side === "learning" && (
                <Pressable
                    style={({ pressed }) => [
                        styles.speakButton,
                        small && styles.speakButtonSmall,
                        pressed && styles.speakButtonPressed,
                    ]}
                    onPress={speak}
                    hitSlop={10}
                >
                    <Text
                        style={[
                            styles.speakIcon,
                            small && styles.speakIconSmall,
                        ]}
                    >
                        🔊
                    </Text>
                </Pressable>
            )}

            <Text style={[textStyle, styles.lineText]}>{text}</Text>
        </View>
    );

    return (
        <>
            {/* NEXT CARD - shows its real prompt */}
            {nextCard && (
                <Animated.View
                    style={[
                        styles.card,
                        styles.nextCard,
                        {
                            transform: [
                                { scale: nextCardScale },
                                { translateY: nextCardTranslateY },
                            ],
                        },
                    ]}
                >
                    <Text style={styles.cardText}>
                        {textFor(nextCard, nextSide)}
                    </Text>
                </Animated.View>
            )}

            {/* CURRENT CARD */}
            <Animated.View
                {...panResponder.panHandlers}
                style={[
                    styles.card,
                    styles.currentCard,
                    deletePreview && styles.deleteCard,
                    {
                        transform: [
                            { translateX: position.x },
                            { translateY: position.y },
                            { rotate },
                        ],
                    },
                ]}
            >
                {deletePreview && (
                    <View style={styles.deleteMessage}>
                        <Text style={styles.deleteText}>Delete card?</Text>
                    </View>
                )}

                {/* PROMPT SIDE */}
                <Animated.View
                    pointerEvents={hasFlipped ? "none" : "auto"}
                    style={[
                        styles.cardFace,
                        {
                            opacity: promptOpacity,
                            transform: [
                                { perspective: 1000 },
                                { rotateY: promptRotate },
                            ],
                        },
                    ]}
                >
                    {renderLine(promptText, promptSide, styles.cardText)}
                </Animated.View>

                {/* ANSWER SIDE */}
                <Animated.View
                    pointerEvents={hasFlipped ? "auto" : "none"}
                    style={[
                        styles.cardFace,
                        {
                            opacity: answerOpacity,
                            transform: [
                                { perspective: 1000 },
                                { rotateY: answerRotate },
                            ],
                        },
                    ]}
                >
                    <View style={styles.hintWrapper}>
                        {renderLine(
                            promptText,
                            promptSide,
                            styles.hintText,
                            true
                        )}
                    </View>

                    {renderLine(answerText, answerSide, styles.cardText)}

                    {!!exampleText && (
                        <Text style={styles.exampleText}>{exampleText}</Text>
                    )}
                </Animated.View>
            </Animated.View>
        </>
    );
}

/* -------------------------------------------------------------------------- */
/*                                   Styles                                   */
/* -------------------------------------------------------------------------- */

const COLORS = {
    cardBackground: "#ebdbb2",
    cardBorder: "#d5c4a1",
    nextCardBackground: "#d5c4a1",
    text: "#282828",
    hint: "#7c6f64",
    danger: "#cc241d",
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: "100%",
    },

    card: {
        ...StyleSheet.absoluteFill,
        padding: 30,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: COLORS.cardBackground,
        borderRadius: 28,
        borderWidth: 2,
        borderColor: COLORS.cardBorder,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 6,
        },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 6,
        zIndex: 1,
    },

    currentCard: {
        zIndex: 2,
    },

    nextCard: {
        backgroundColor: COLORS.nextCardBackground,
    },

    cardFace: {
        ...StyleSheet.absoluteFill,
        paddingHorizontal: 24,
        justifyContent: "center",
        alignItems: "center",
        backfaceVisibility: "hidden",
    },

    // Speaker button on the left, text beside it
    line: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
    },

    lineText: {
        flexShrink: 1,
    },

    cardText: {
        color: COLORS.text,
        fontSize: 44,
        fontWeight: "500",
        textAlign: "center",
    },

    hintWrapper: {
        marginBottom: 20,
    },

    hintText: {
        color: COLORS.hint,
        fontSize: 20,
        textAlign: "center",
    },

    exampleText: {
        color: COLORS.hint,
        fontSize: 18,
        fontStyle: "italic",
        textAlign: "center",
        marginTop: 28,
        paddingHorizontal: 8,
    },

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

    speakButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.cardBorder,
    },

    speakButtonSmall: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },

    speakButtonPressed: {
        opacity: 0.6,
    },

    speakIcon: {
        fontSize: 20,
    },

    speakIconSmall: {
        fontSize: 15,
    },
});