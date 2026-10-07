import { getCardImage } from "@/database/database";
import { API_URL } from "@/services/imageApi";
import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Image,
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
    Math.abs(g.dx) < TAP_THRESHOLD &&
    Math.abs(g.dy) < TAP_THRESHOLD;

const randomPromptSide = (): PromptSide =>
    Math.random() < 0.5 ? "learning" : "localized";

const textFor = (card: Card, side: PromptSide) =>
    side === "learning"
        ? card.learningText
        : card.localizedText;

/* -------------------------------------------------------------------------- */
/*                                   Wrapper                                  */
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
    const sides = useRef(
        new Map<number, PromptSide>()
    ).current;

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
                initialNextSide={
                    nextCard
                        ? getSide(nextCard)
                        : "learning"
                }
                onSwipe={handleSwipe}
                onDelete={onDelete}
                ttsCode={ttsCode}
            />
        </View>
    );
}

/* -------------------------------------------------------------------------- */
/*                      Current + next card                                   */
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
    const [promptSide] = useState(initialPromptSide);
    const [nextSide] = useState(initialNextSide);

    const [hasFlipped, setHasFlipped] = useState(false);
    const [deletePreview, setDeletePreview] =
        useState(false);

    const [imageUrl, setImageUrl] =
        useState<string | null>(null);

    const [loadingImage, setLoadingImage] =
        useState(false);

    const position = useRef(
        new Animated.ValueXY()
    ).current;

    const nextCardProgress = useRef(
        new Animated.Value(0)
    ).current;

    const flipAnimation = useRef(
        new Animated.Value(0)
    ).current;

    const isLocked = useRef(false);

    const latest = useRef({
        flipCard: () => { },
        forceSwipe: (_: Direction) => { },
        forceDelete: () => { },
        resetPosition: () => { },
    });

    /* ---------------------------------------------------------------------- */
    /*                              Load image                                */
    /* ---------------------------------------------------------------------- */

    useEffect(() => {
        let cancelled = false;

        const loadImage = async () => {
            if (currentCard.id === undefined) {
                setImageUrl(null);
                return;
            }

            setLoadingImage(true);

            try {
                const image = await getCardImage(
                    currentCard.id
                );

                if (cancelled) {
                    return;
                }

                if (image?.file_path) {
                    setImageUrl(
                        `${API_URL}${image.file_path}`
                    );
                } else {
                    setImageUrl(null);
                }
            } catch (error) {
                console.error(
                    "Failed to load card image:",
                    error
                );

                if (!cancelled) {
                    setImageUrl(null);
                }
            } finally {
                if (!cancelled) {
                    setLoadingImage(false);
                }
            }
        };

        loadImage();

        return () => {
            cancelled = true;
        };
    }, [currentCard.id]);

    /* ---------------------------------------------------------------------- */
    /*                              Swipe logic                               */
    /* ---------------------------------------------------------------------- */

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

        slideOut({ x, y: 0 }, () =>
            onSwipe(direction)
        );
    };

    const forceDelete = () =>
        slideOut(
            {
                x: 0,
                y: SCREEN_HEIGHT * 0.8,
            },
            onDelete
        );

    const resetPosition = () => {
        setDeletePreview(false);

        Animated.spring(position, {
            toValue: {
                x: 0,
                y: 0,
            },
            useNativeDriver: true,
        }).start();
    };

    const flipCard = () => {
        if (hasFlipped) {
            return;
        }

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
            onStartShouldSetPanResponder: () =>
                !isLocked.current,

            onMoveShouldSetPanResponder: (_, g) =>
                !isLocked.current &&
                (Math.abs(g.dx) > TAP_THRESHOLD ||
                    Math.abs(g.dy) > TAP_THRESHOLD),

            onPanResponderMove: (_, g) => {
                position.setValue({
                    x: g.dx,
                    y: g.dy,
                });

                setDeletePreview(
                    isDeletePreview(g)
                );
            },

            onPanResponderRelease: (_, g) => {
                const {
                    flipCard,
                    forceSwipe,
                    forceDelete,
                    resetPosition,
                } = latest.current;

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

            onPanResponderTerminate: () =>
                latest.current.resetPosition(),
        })
    ).current;

    /* ---------------------------------------------------------------------- */
    /*                            Animations                                  */
    /* ---------------------------------------------------------------------- */

    const promptRotate =
        flipAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: ["0deg", "180deg"],
        });

    const answerRotate =
        flipAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: ["180deg", "360deg"],
        });

    const promptOpacity =
        flipAnimation.interpolate({
            inputRange: [0, 0.49, 0.5, 1],
            outputRange: [1, 1, 0, 0],
        });

    const answerOpacity =
        flipAnimation.interpolate({
            inputRange: [0, 0.49, 0.5, 1],
            outputRange: [0, 0, 1, 1],
        });

    const rotate = position.x.interpolate({
        inputRange: [
            -SCREEN_WIDTH / 2,
            0,
            SCREEN_WIDTH / 2,
        ],
        outputRange: ["-10deg", "0deg", "10deg"],
        extrapolate: "clamp",
    });

    const nextCardScale =
        nextCardProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.94, 1],
        });

    const nextCardTranslateY =
        nextCardProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [12, 0],
        });

    /* ---------------------------------------------------------------------- */
    /*                              Content                                   */
    /* ---------------------------------------------------------------------- */

    const answerSide: PromptSide =
        promptSide === "learning"
            ? "localized"
            : "learning";

    const promptText = textFor(
        currentCard,
        promptSide
    );

    const answerText = textFor(
        currentCard,
        answerSide
    );

    const exampleText =
        currentCard.exampleSentence?.trim();

    const romanizationFor = (
        card: Card,
        side: PromptSide
    ) =>
        side === "learning"
            ? card.romanization?.trim()
            : undefined;

    const speak = () => {
        Speech.stop();

        Speech.speak(
            currentCard.learningText,
            {
                language: ttsCode,
                rate: 1.0,
            }
        );
    };

    useEffect(
        () => () => {
            Speech.stop();
        },
        []
    );

    /* ---------------------------------------------------------------------- */
    /*                         Learning text                                  */
    /* ---------------------------------------------------------------------- */

    const renderLearning = (
        textStyle: StyleProp<TextStyle>,
        small = false
    ) => {
        const romanization =
            romanizationFor(
                currentCard,
                "learning"
            );

        return (
            <View style={styles.learningRow}>
                {/* Left balancing space */}
                <View style={styles.speakerSlot} />

                {/* Learning text stays truly centered */}
                <View style={styles.learningTextGroup}>
                    <Text
                        style={[
                            textStyle,
                            styles.lineText,
                        ]}
                    >
                        {currentCard.learningText}
                    </Text>

                    {!!romanization && (
                        <Text
                            style={[
                                styles.romanization,
                                small &&
                                styles.romanizationSmall,
                            ]}
                        >
                            {romanization}
                        </Text>
                    )}
                </View>

                {/* Speaker on the right */}
                <View style={styles.speakerSlot}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.speakButton,
                            small &&
                            styles.speakButtonSmall,
                            pressed &&
                            styles.speakButtonPressed,
                        ]}
                        onPress={speak}
                        hitSlop={10}
                    >
                        <Text
                            style={[
                                styles.speakIcon,
                                small &&
                                styles.speakIconSmall,
                            ]}
                        >
                            🔊
                        </Text>
                    </Pressable>
                </View>
            </View>
        );
    };

    /* ---------------------------------------------------------------------- */
    /*                         Localized + image                              */
    /* ---------------------------------------------------------------------- */

    const renderLocalized = (
        textStyle: StyleProp<TextStyle>
    ) => {
        return (
            <View style={styles.localizedContent}>
                {loadingImage ? (
                    <View style={styles.imageLoading}>
                        <ActivityIndicator
                            size="small"
                        />
                    </View>
                ) : imageUrl ? (
                    <Image
                        source={{ uri: imageUrl }}
                        style={styles.cardImage}
                        resizeMode="cover"
                    />
                ) : null}

                <Text
                    style={[
                        textStyle,
                        styles.lineText,
                    ]}
                >
                    {currentCard.localizedText}
                </Text>
            </View>
        );
    };

    /* ---------------------------------------------------------------------- */
    /*                              NEXT CARD                                 */
    /* ---------------------------------------------------------------------- */

    return (
        <>
            {nextCard && (
                <Animated.View
                    style={[
                        styles.card,
                        styles.nextCard,
                        {
                            transform: [
                                {
                                    scale: nextCardScale,
                                },
                                {
                                    translateY:
                                        nextCardTranslateY,
                                },
                            ],
                        },
                    ]}
                >
                    <Text style={styles.cardText}>
                        {textFor(
                            nextCard,
                            nextSide
                        )}
                    </Text>
                </Animated.View>
            )}

            {/* ------------------------------------------------------------------ */}
            {/* CURRENT CARD                                                       */}
            {/* ------------------------------------------------------------------ */}

            <Animated.View
                {...panResponder.panHandlers}
                style={[
                    styles.card,
                    styles.currentCard,
                    deletePreview &&
                    styles.deleteCard,
                    {
                        transform: [
                            {
                                translateX:
                                    position.x,
                            },
                            {
                                translateY:
                                    position.y,
                            },
                            {
                                rotate,
                            },
                        ],
                    },
                ]}
            >
                {deletePreview && (
                    <View
                        style={
                            styles.deleteMessage
                        }
                    >
                        <Text
                            style={
                                styles.deleteText
                            }
                        >
                            Delete card?
                        </Text>
                    </View>
                )}

                {/* ============================================================ */}
                {/* PROMPT                                                        */}
                {/* ============================================================ */}

                <Animated.View
                    pointerEvents={
                        hasFlipped
                            ? "none"
                            : "auto"
                    }
                    style={[
                        styles.cardFace,
                        {
                            opacity:
                                promptOpacity,
                            transform: [
                                {
                                    perspective: 1000,
                                },
                                {
                                    rotateY:
                                        promptRotate,
                                },
                            ],
                        },
                    ]}
                >
                    {promptSide ===
                        "localized"
                        ? renderLocalized(
                            styles.cardText
                        )
                        : renderLearning(
                            styles.cardText
                        )}
                </Animated.View>

                {/* ============================================================ */}
                {/* ANSWER                                                        */}
                {/* ============================================================ */}

                <Animated.View
                    pointerEvents={
                        hasFlipped
                            ? "auto"
                            : "none"
                    }
                    style={[
                        styles.cardFace,
                        {
                            opacity:
                                answerOpacity,
                            transform: [
                                {
                                    perspective: 1000,
                                },
                                {
                                    rotateY:
                                        answerRotate,
                                },
                            ],
                        },
                    ]}
                >
                    <View
                        style={
                            styles.answerContent
                        }
                    >
                        {/*
                         * If the answer is localized:
                         * image + localized
                         *
                         * If the answer is learning:
                         * learning
                         */}
                        {answerSide ===
                            "localized" ? (
                            renderLocalized(
                                styles.cardText
                            )
                        ) : (
                            renderLearning(
                                styles.cardText
                            )
                        )}

                        {/*
                         * Show the other language underneath.
                         *
                         * This gives us:
                         *
                         * image
                         * localized
                         * learning
                         *
                         * OR
                         *
                         * learning
                         * image
                         * localized
                         *
                         * depending on which side
                         * was originally shown.
                         */}
                        <View
                            style={
                                styles.answerSecondary
                            }
                        >
                            {answerSide ===
                                "localized"
                                ? renderLearning(
                                    styles.hintText,
                                    true
                                )
                                : renderLocalized(
                                    styles.hintText
                                )}
                        </View>

                        {!!exampleText && (
                            <Text
                                style={
                                    styles.exampleText
                                }
                            >
                                {exampleText}
                            </Text>
                        )}
                    </View>
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
        backgroundColor:
            COLORS.cardBackground,
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
        backgroundColor:
            COLORS.nextCardBackground,
    },

    cardFace: {
        ...StyleSheet.absoluteFill,
        paddingHorizontal: 24,
        justifyContent: "center",
        alignItems: "center",
        backfaceVisibility: "hidden",
    },

    /* ---------------------------------------------------------------------- */
    /* Localized side                                                        */
    /* ---------------------------------------------------------------------- */

    localizedContent: {
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
    },

    cardImage: {
        width: "82%",
        height: 190,
        borderRadius: 16,
        marginBottom: 20,
    },

    imageLoading: {
        width: "82%",
        height: 190,
        borderRadius: 16,
        marginBottom: 20,
        backgroundColor: COLORS.cardBorder,
        alignItems: "center",
        justifyContent: "center",
    },

    /* ---------------------------------------------------------------------- */
    /* Learning side                                                         */
    /* ---------------------------------------------------------------------- */

    learningRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },

    learningTextGroup: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    speakerSlot: {
        width: 44,
        alignItems: "center",
        justifyContent: "center",
    },

    lineText: {
        flexShrink: 1,
        textAlign: "center",
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
    },

    /* ---------------------------------------------------------------------- */
    /* Answer                                                                */
    /* ---------------------------------------------------------------------- */

    answerContent: {
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
    },

    answerSecondary: {
        width: "100%",
        marginTop: 20,
    },

    exampleText: {
        color: COLORS.hint,
        fontSize: 18,
        fontStyle: "italic",
        textAlign: "center",
        marginTop: 28,
        paddingHorizontal: 8,
    },

    /* ---------------------------------------------------------------------- */
    /* TTS                                                                   */
    /* ---------------------------------------------------------------------- */

    speakButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.cardBorder,
        borderWidth: 1,
        borderColor: COLORS.hint,
    },

    speakButtonSmall: {
        width: 26,
        height: 26,
        borderRadius: 13,
    },

    speakButtonPressed: {
        opacity: 0.6,
    },

    speakIcon: {
        fontSize: 16,
    },

    speakIconSmall: {
        fontSize: 12,
    },

    romanization: {
        color: COLORS.hint,
        fontSize: 18,
        marginTop: 8,
        textAlign: "center",
    },

    romanizationSmall: {
        fontSize: 13,
        marginTop: 4,
    },

    /* ---------------------------------------------------------------------- */
    /* Delete                                                                */
    /* ---------------------------------------------------------------------- */

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