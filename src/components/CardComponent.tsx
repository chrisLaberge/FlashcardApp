import { useRef, useState } from "react";
import { Animated, PanResponder, Text } from "react-native";
import { Card } from "../models/Card";

interface CardComponentProps {
    cardData: Card;
    onSwipe: (direction: "left" | "right") => void;
}

export default function CardComponent({ cardData, onSwipe }: CardComponentProps) {
    const [flipped, setFlipped] = useState(false);
    const position = useRef(new Animated.Value(0)).current;

    const panResponder = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => {
            return Math.abs(gesture.dx) > 10;
        },

        onPanResponderMove: (_, gesture) => {
            position.setValue(gesture.dx);
        },

        onPanResponderRelease: (_, gesture) => {
            if (gesture.dx < -100) {
                onSwipe("left");
            } else if (gesture.dx > 100) {
                onSwipe("right");
            } else if (Math.abs(gesture.dx) < 10 && Math.abs(gesture.dy) < 10) {
                setFlipped(!flipped);
            }
            position.setValue(0);
        },
    });

    return (
        <Animated.View
            {...panResponder.panHandlers}
            style={{
                transform: [{ translateX: position }],
                width: 300,
                height: 200,
                backgroundColor: "white",
                borderRadius: 15,
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            <Text style={{ fontSize: 40 }}>
                {flipped ? cardData.front : cardData.back}
            </Text>
        </Animated.View>
    );
}