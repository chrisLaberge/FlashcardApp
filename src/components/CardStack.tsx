import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, PanResponder, Text, View } from "react-native";
import { Card } from "../models/Card";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_THRESHOLD = 100;
const SWIPE_OUT_DURATION = 250;

interface CardStackProps {
    currentCard: Card;
    nextCard?: Card;
    onSwipe: (direction: "left" | "right") => void;
}

export default function CardStack({ currentCard, nextCard, onSwipe }: CardStackProps) {
    const [flipped, setFlipped] = useState(false);

    const position = useRef(new Animated.ValueXY()).current;
    const nextCardProgress = useRef(new Animated.Value(0)).current;

    // Reset animated state ONLY when the current card actually changes —
    // i.e. after React has committed the new card's content, not before.
    useEffect(() => {
        position.setValue({ x: 0, y: 0 });
        nextCardProgress.setValue(0);
        setFlipped(false);
    }, [currentCard]);

    const rotate = position.x.interpolate({
        inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        outputRange: ["-10deg", "0deg", "10deg"],
    });

    const nextCardScale = nextCardProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.92, 1],
    });
    const nextCardTranslateY = nextCardProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [10, 0],
    });

    const panResponder = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10,

        onPanResponderMove: (_, gesture) => {
            position.setValue({ x: gesture.dx, y: gesture.dy });
        },

        onPanResponderRelease: (_, gesture) => {
            if (gesture.dx > SWIPE_THRESHOLD) {
                forceSwipe("right");
            } else if (gesture.dx < -SWIPE_THRESHOLD) {
                forceSwipe("left");
            } else if (Math.abs(gesture.dx) < 10 && Math.abs(gesture.dy) < 10) {
                setFlipped((f) => !f);
                resetPosition();
            } else {
                resetPosition();
            }
        },
    });

    const forceSwipe = (direction: "left" | "right") => {
        const x = direction === "right" ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
        const y = SCREEN_HEIGHT * 0.4;

        Animated.parallel([
            Animated.timing(position, {
                toValue: { x, y },
                duration: SWIPE_OUT_DURATION,
                useNativeDriver: true,
            }),
            Animated.timing(nextCardProgress, {
                toValue: 1,
                duration: SWIPE_OUT_DURATION,
                useNativeDriver: true,
            }),
        ]).start(() => {
            // Just hand off to the parent — position/flip reset is handled
            // by the useEffect above once the new currentCard prop lands.
            onSwipe(direction);
        });
    };

    const resetPosition = () => {
        Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
        }).start();
    };

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
                    <Text style={{ fontSize: 40 }}>{nextCard.back}</Text>
                </Animated.View>
            )}

            <Animated.View
                {...panResponder.panHandlers}
                style={[
                    styles.card,
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
                <Text style={{ fontSize: 40 }}>
                    {flipped ? currentCard.front : currentCard.back}
                </Text>
            </Animated.View>
        </View>
    );
}

const styles = {
    container: {
        width: 300,
        height: 200,
        justifyContent: "center" as const,
        alignItems: "center" as const,
    },
    card: {
        position: "absolute" as const,
        width: 300,
        height: 200,
        backgroundColor: "#aca696",
        borderRadius: 15,
        justifyContent: "center" as const,
        alignItems: "center" as const,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
};