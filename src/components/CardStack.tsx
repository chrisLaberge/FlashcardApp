import { useEffect, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    PanResponder,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Card } from "../models/Card";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
    Dimensions.get("window");

const SWIPE_THRESHOLD = 100;
const DELETE_THRESHOLD = 120;
const SWIPE_OUT_DURATION = 250;

interface CardStackProps {
    currentCard: Card;
    nextCard?: Card;
    onSwipe: (direction: "left" | "right") => void;
    onDelete: () => void;
}

export default function CardStack({
    currentCard,
    nextCard,
    onSwipe,
    onDelete,
}: CardStackProps) {
    const [flipped, setFlipped] = useState(false);
    const [deletePreview, setDeletePreview] = useState(false);

    const position = useRef(new Animated.ValueXY()).current;
    const nextCardProgress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        position.setValue({ x: 0, y: 0 });
        nextCardProgress.setValue(0);
        setFlipped(false);
        setDeletePreview(false);
    }, [currentCard]);

    const rotate = position.x.interpolate({
        inputRange: [
            -SCREEN_WIDTH / 2,
            0,
            SCREEN_WIDTH / 2,
        ],
        outputRange: [
            "-10deg",
            "0deg",
            "10deg",
        ],
    });

    const nextCardScale = nextCardProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.92, 1],
    });

    const nextCardTranslateY = nextCardProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [10, 0],
    });

    const forceSwipe = (
        direction: "left" | "right"
    ) => {
        const x =
            direction === "right"
                ? SCREEN_WIDTH * 1.5
                : -SCREEN_WIDTH * 1.5;

        const y = SCREEN_HEIGHT * 0.4;

        Animated.parallel([
            Animated.timing(position, {
                toValue: { x, y: 0 },
                duration: SWIPE_OUT_DURATION,
                useNativeDriver: true,
            }),

            Animated.timing(nextCardProgress, {
                toValue: 1,
                duration: SWIPE_OUT_DURATION,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onSwipe(direction);
        });
    };

    const forceDelete = () => {
        Animated.timing(position, {
            toValue: {
                x: 0,
                y: SCREEN_HEIGHT * 0.8,
            },
            duration: SWIPE_OUT_DURATION,
            useNativeDriver: true,
        }).start(() => {
            onDelete();
        });
    };

    const resetPosition = () => {
        setDeletePreview(false);

        Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
        }).start();
    };

    const panResponder = PanResponder.create({
        onStartShouldSetPanResponder: () => true,

        onMoveShouldSetPanResponder: (_, gesture) =>
            Math.abs(gesture.dx) > 10 ||
            Math.abs(gesture.dy) > 10,

        onPanResponderMove: (_, gesture) => {
            position.setValue({
                x: gesture.dx,
                y: gesture.dy,
            });

            setDeletePreview(
                gesture.dy > 20 &&
                Math.abs(gesture.dy) > Math.abs(gesture.dx)
            );
        },

        onPanResponderRelease: (_, gesture) => {
            // Delete by swiping down
            if (
                gesture.dy > DELETE_THRESHOLD &&
                gesture.dy > Math.abs(gesture.dx)
            ) {
                forceDelete();
                return;
            }

            // Swipe right
            if (gesture.dx > SWIPE_THRESHOLD) {
                forceSwipe("right");
                return;
            }

            // Swipe left
            if (gesture.dx < -SWIPE_THRESHOLD) {
                forceSwipe("left");
                return;
            }

            // Tap
            if (
                Math.abs(gesture.dx) < 10 &&
                Math.abs(gesture.dy) < 10
            ) {
                setFlipped((f) => !f);
                resetPosition();
                return;
            }

            resetPosition();
        },
    });

    return (
        <View style={styles.container}>
            {nextCard && (
                <Animated.View
                    style={[
                        styles.card,
                        {
                            transform: [
                                { scale: nextCardScale },
                                { translateY: nextCardTranslateY },
                            ],
                            zIndex: 1,
                        },
                    ]}
                >
                    <Text style={styles.cardText}>
                        {nextCard.back}
                    </Text>
                </Animated.View>
            )}

            <Animated.View
                {...panResponder.panHandlers}
                style={[
                    styles.card,
                    deletePreview && styles.deleteCard,
                    {
                        transform: [
                            { translateX: position.x },
                            { translateY: position.y },
                            { rotate },
                        ],
                        zIndex: 2,
                    },
                ]}
            >
                {deletePreview && (
                    <View style={styles.deleteMessage}>
                        <Text style={styles.deleteText}>
                            Delete card?
                        </Text>
                    </View>
                )}

                <Text style={styles.cardText}>
                    {flipped
                        ? currentCard.front
                        : currentCard.back}
                </Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 300,
        height: 200,
        justifyContent: "center",
        alignItems: "center",
    },

    card: {
        position: "absolute",
        width: 300,
        height: 200,
        backgroundColor: "#ebdbb2",
        borderRadius: 15,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 3,
        borderColor: "#ebdbb2",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },

    deleteCard: {
        borderColor: "#cc241d",
    },

    cardText: {
        color: "#282828",
        fontSize: 40,
    },

    deleteMessage: {
        position: "absolute",
        top: 15,
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 5,
    },

    deleteText: {
        color: "#cc241d",
        fontSize: 17,
        fontWeight: "bold",
    },
});