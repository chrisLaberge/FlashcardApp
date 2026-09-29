import { useLayoutEffect, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    PanResponder,
    PanResponderGestureState,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Card } from "../models/Card";

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
    Dimensions.get("window");

const SWIPE_THRESHOLD = 100;
const DELETE_THRESHOLD = 120;
const DELETE_PREVIEW_THRESHOLD = 20;
const TAP_THRESHOLD = 10;

const SWIPE_OUT_DURATION = 250;
const FLIP_DURATION = 500;

type Direction = "left" | "right";
type PromptSide = "front" | "back";

/* -------------------------------------------------------------------------- */
/*                               Gesture helpers                              */
/* -------------------------------------------------------------------------- */

const isMostlyVertical = (g: PanResponderGestureState) =>
    Math.abs(g.dy) > Math.abs(g.dx);

const isDeletePreview = (g: PanResponderGestureState) =>
    g.dy > DELETE_PREVIEW_THRESHOLD && isMostlyVertical(g);

const isDeleteGesture = (g: PanResponderGestureState) =>
    g.dy > DELETE_THRESHOLD && isMostlyVertical(g);

const isTap = (g: PanResponderGestureState) =>
    Math.abs(g.dx) < TAP_THRESHOLD && Math.abs(g.dy) < TAP_THRESHOLD;

const randomPromptSide = (): PromptSide =>
    Math.random() < 0.5 ? "front" : "back";

/* -------------------------------------------------------------------------- */
/*                                  Component                                 */
/* -------------------------------------------------------------------------- */

interface CardStackProps {
    currentCard: Card;
    nextCard?: Card;
    onSwipe: (direction: Direction) => void;
    onDelete: () => void;
}

/**
 * Fills whatever space its parent gives it.
 *
 * Each card starts by showing ONE side (randomly front or back) - the prompt.
 * Tapping flips it to reveal the other side (the answer), with the original
 * prompt kept as small text above it. The next card starts fresh again.
 */
export default function CardStack({
    currentCard,
    nextCard,
    onSwipe,
    onDelete,
}: CardStackProps) {
    /* ------------------------------ State / refs ------------------------------ */

    const [promptSide, setPromptSide] = useState<PromptSide>("front");
    const [hasFlipped, setHasFlipped] = useState(false);
    const [deletePreview, setDeletePreview] = useState(false);

    const position = useRef(new Animated.ValueXY()).current;
    const nextCardProgress = useRef(new Animated.Value(0)).current;

    // 0 = prompt face showing, 1 = answer face showing
    const flipAnimation = useRef(new Animated.Value(0)).current;

    // Blocks touches while a swipe/delete animation is running
    const isLocked = useRef(false);

    // The PanResponder is created once, so it calls through this ref to always
    // reach the latest handlers instead of stale state.
    const latest = useRef({
        flipCard: () => { },
        forceSwipe: (_: Direction) => { },
        forceDelete: () => { },
        resetPosition: () => { },
    });

    /* ------------------------- Reset when the card changes ------------------------- */

    // useLayoutEffect so the new card never paints in the old card's position.
    useLayoutEffect(() => {
        position.setValue({ x: 0, y: 0 });
        nextCardProgress.setValue(0);
        flipAnimation.setValue(0);

        setPromptSide(randomPromptSide());
        setHasFlipped(false);
        setDeletePreview(false);
        isLocked.current = false;
    }, [currentCard.id]);

    /* -------------------------------- Animations -------------------------------- */

    const slideOut = (toValue: { x: number; y: number }, done: () => void) => {
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

    latest.current = { flipCard, forceSwipe, forceDelete, resetPosition };

    /* -------------------------------- Pan handling -------------------------------- */

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => !isLocked.current,

            onMoveShouldSetPanResponder: (_, g) =>
                !isLocked.current &&
                (Math.abs(g.dx) > TAP_THRESHOLD ||
                    Math.abs(g.dy) > TAP_THRESHOLD),

            onPanResponderMove: (_, g) => {
                position.setValue({ x: g.dx, y: g.dy });
                setDeletePreview(isDeletePreview(g));
            },

            onPanResponderRelease: (_, g) => {
                const { flipCard, forceSwipe, forceDelete, resetPosition } =
                    latest.current;

                if (isDeleteGesture(g)) return forceDelete();
                if (g.dx > SWIPE_THRESHOLD) return forceSwipe("right");
                if (g.dx < -SWIPE_THRESHOLD) return forceSwipe("left");

                if (isTap(g)) flipCard();
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

    /* ---------------------------------- Render ---------------------------------- */

    const promptText =
        promptSide === "front" ? currentCard.front : currentCard.back;
    const answerText =
        promptSide === "front" ? currentCard.back : currentCard.front;

    return (
        <View style={styles.container}>
            {/* NEXT CARD - left blank because its starting side is random */}
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
                />
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

                {/* PROMPT FACE: only the starting side */}
                <Animated.View
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
                    <Text style={styles.cardText}>{promptText}</Text>
                </Animated.View>

                {/* ANSWER FACE: the other side, with the prompt kept small above */}
                <Animated.View
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
                    <Text style={styles.hintText}>{promptText}</Text>
                    <Text style={styles.cardText}>{answerText}</Text>
                </Animated.View>
            </Animated.View>
        </View>
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
    // Fills the parent; cards stretch to fill this
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
        shadowOffset: { width: 0, height: 6 },
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

    cardText: {
        color: COLORS.text,
        fontSize: 44,
        fontWeight: "500",
        textAlign: "center",
    },

    hintText: {
        color: COLORS.hint,
        fontSize: 20,
        textAlign: "center",
        marginBottom: 20,
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
});