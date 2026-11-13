import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Pressable from "../Pressable";
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Polygon, Rect, Stop } from "react-native-svg";
import { isMaxed, petLevel, petStage, stageProgress } from "../../models/Pet";
import { renderAccessory, type Anchors } from "./Accessories";

export type Look = { hat?: string | null; glasses?: string | null; scarf?: string | null };

type Props = {
    /** The pet's level (the player's level, capped at 100). */
    level: number;
    look?: Look;
    size?: number;
    /** Bobs up and down and, when maxed, shines. Off in lists, where many pets are on screen. */
    animated?: boolean;
    onPress?: () => void;
};

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const GOLD = ["#fff3b0", "#f2c94c", "#b8860b"] as const;

/** The pet: an egg that cracks and hatches, grows into a pukeko, and turns solid gold at level 100. */
export default function PetView({ level, look = {}, size = 160, animated = true, onPress }: Props) {
    const lvl = petLevel(level);
    const stage = petStage(lvl);
    const maxed = isMaxed(lvl);

    const [bob] = useState(() => new Animated.Value(0));
    const [shine] = useState(() => new Animated.Value(0));
    const [glint] = useState(() => new Animated.Value(0));
    const [hop] = useState(() => new Animated.Value(0));
    const hopping = useRef(false);

    useEffect(() => {
        if (!animated) return;
        const loops = [
            Animated.loop(Animated.sequence([
                Animated.timing(bob, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
                Animated.timing(bob, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            ])),
        ];
        if (maxed) {
            loops.push(
                Animated.loop(Animated.sequence([
                    Animated.timing(shine, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
                    Animated.delay(900),
                    Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: false }),
                ])),
                Animated.loop(Animated.sequence([
                    Animated.timing(glint, { toValue: 1, duration: 700, useNativeDriver: true }),
                    Animated.timing(glint, { toValue: 0, duration: 700, useNativeDriver: true }),
                    Animated.delay(500),
                ])),
            );
        }
        loops.forEach((loop) => loop.start());
        return () => loops.forEach((loop) => loop.stop());
    }, [animated, maxed, bob, shine, glint]);

    const jump = () => {
        onPress?.();
        if (hopping.current) return;
        hopping.current = true;
        Animated.sequence([
            Animated.timing(hop, { toValue: 1, duration: 140, useNativeDriver: true }),
            Animated.timing(hop, { toValue: 0, duration: 180, easing: Easing.bounce, useNativeDriver: true }),
        ]).start(() => {
            hopping.current = false;
        });
    };

    // Body shape and colours by stage.
    const adult = stage.id === "adult" || stage.id === "golden";
    const shape =
        stage.id === "chick" ? { cy: 82, rx: 24, ry: 18, headCy: 60, headR: 15, legTop: 96 }
        : stage.id === "youngster" ? { cy: 78, rx: 26, ry: 21, headCy: 52, headR: 16, legTop: 97 }
        : { cy: 74, rx: 28, ry: 24, headCy: 46, headR: 17, legTop: 97 };
    const body = maxed ? "url(#gold)" : adult ? "#1d2440" : "#262b3d";
    const chest = maxed ? "#fff3b0" : "#3b4fb8";
    const beak = maxed ? "#e0a21b" : "#e5484d";

    const sway = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
    const lift = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });
    const shineX = shine.interpolate({ inputRange: [0, 1], outputRange: [-60, 130] });

    const sparkle = (left: number, top: number, delay: number) => (
        <Animated.View
            key={`${left}-${top}`}
            pointerEvents="none"
            style={[s.sparkle, { left: left * size, top: top * size, opacity: glint, transform: [{ scale: glint.interpolate({ inputRange: [0, 1], outputRange: [0.4 + delay, 1.1] }) }] }]}
        >
            <MaterialCommunityIcons name="star-four-points" size={size * 0.13} color="#ffe58a" />
        </Animated.View>
    );

    const eyes = (
        <G>
            <Ellipse cx={52} cy={shape.headCy - 2} rx={3.6} ry={4} fill="#ffffff" />
            <Ellipse cx={68} cy={shape.headCy - 2} rx={3.6} ry={4} fill="#ffffff" />
            <Circle cx={52.6} cy={shape.headCy - 1.6} r={2.1} fill="#0c0b0d" />
            <Circle cx={68.6} cy={shape.headCy - 1.6} r={2.1} fill="#0c0b0d" />
            <Circle cx={53.3} cy={shape.headCy - 2.6} r={0.8} fill="#ffffff" />
            <Circle cx={69.3} cy={shape.headCy - 2.6} r={0.8} fill="#ffffff" />
        </G>
    );

    const egg = stage.id === "egg";
    const crack = lvl >= 5;
    const hatchling = stage.id === "hatchling";

    // Where accessories go: on the egg's top and middle, on the hatchling's head in its shell, or on the grown head.
    const anchors: Anchors = egg
        ? { cx: 60, headTop: 36, eyeY: 62, neckY: 88, r: 17 }
        : hatchling
            ? { cx: 60, headTop: 53, eyeY: 68, neckY: 86, r: 17 }
            : { cx: 60, headTop: shape.headCy - shape.headR, eyeY: shape.headCy - 2, neckY: shape.headCy + shape.headR - 3, r: shape.headR };
    const worn = (
        <G>
            {renderAccessory(look.scarf, anchors)}
            {renderAccessory(look.glasses, anchors)}
            {renderAccessory(look.hat, anchors)}
        </G>
    );

    return (
        <Pressable onPress={jump} disabled={!onPress && !animated} accessibilityRole="image" accessibilityLabel={`${stage.name}, level ${lvl}`} style={{ width: size, height: size }}>
            <Animated.View style={{ width: size, height: size, transform: [{ translateY: Animated.add(sway, lift) }] }}>
                <Svg width={size} height={size} viewBox="0 0 120 120">
                    <Defs>
                        <LinearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
                            <Stop offset="0" stopColor={GOLD[0]} />
                            <Stop offset="0.5" stopColor={GOLD[1]} />
                            <Stop offset="1" stopColor={GOLD[2]} />
                        </LinearGradient>
                        <LinearGradient id="shell" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor="#fbf8ef" />
                            <Stop offset="1" stopColor="#dcd5c3" />
                        </LinearGradient>
                        <ClipPath id="silhouette">
                            <Ellipse cx={60} cy={shape.cy} rx={shape.rx} ry={shape.ry} />
                            <Circle cx={60} cy={shape.headCy} r={shape.headR} />
                        </ClipPath>
                    </Defs>

                    <Ellipse cx={60} cy={112} rx={egg ? 24 : 28} ry={4} fill="#000000" opacity={0.18} />

                    {egg ? (
                        <G>
                            <Ellipse cx={60} cy={70} rx={27} ry={35} fill="url(#shell)" stroke="#bdb5a1" strokeWidth={1.2} />
                            {[[50, 52, 2.4], [68, 60, 2], [56, 78, 2.6], [70, 82, 1.8], [48, 70, 1.8], [62, 44, 1.6]].map(([x, y, r]) => (
                                <Circle key={`${x}${y}`} cx={x} cy={y} r={r} fill="#7a86c9" opacity={0.55} />
                            ))}
                            {crack ? <Path d={`M60 36 l-6 9 l7 5 l-8 9 ${lvl >= 8 ? "M61 50 l8 6 l-5 6" : ""}`} stroke="#6b6554" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
                            {lvl >= 8 ? <Circle cx={57} cy={63} r={2.2} fill="#0c0b0d" opacity={0.7} /> : null}
                            {worn}
                        </G>
                    ) : (
                        <G>
                            {/* legs */}
                            <G stroke={beak} strokeWidth={adult ? 3 : 2.6} strokeLinecap="round" fill="none">
                                <Path d={`M52 ${shape.legTop} L52 111 M52 111 l-6 1 M52 111 l5 1.4`} />
                                <Path d={`M68 ${shape.legTop} L68 111 M68 111 l-6 1.4 M68 111 l6 1`} />
                            </G>
                            {hatchling ? null : <Ellipse cx={60} cy={shape.cy} rx={shape.rx} ry={shape.ry} fill={body} />}
                            {hatchling ? null : adult ? <Ellipse cx={60} cy={shape.cy + shape.ry * 0.35} rx={shape.rx * 0.7} ry={shape.ry * 0.55} fill={chest} opacity={maxed ? 0.9 : 0.75} /> : null}
                            <Circle cx={60} cy={hatchling ? 70 : shape.headCy} r={hatchling ? 17 : shape.headR} fill={body} />
                            {/* red shield on the forehead of a grown pukeko */}
                            {adult ? <Path d={`M54 ${shape.headCy - shape.headR + 3} Q60 ${shape.headCy - shape.headR - 3} 66 ${shape.headCy - shape.headR + 3} L64 ${shape.headCy - shape.headR + 8} L56 ${shape.headCy - shape.headR + 8} Z`} fill={beak} /> : null}
                            {hatchling ? (
                                <G>
                                    <G transform="translate(0 24)">{eyes}</G>
                                    <Polygon points="55,76 65,76 60,83" fill={beak} />
                                    <Path d="M32 92 l6 -7 l6 7 l6 -7 l6 7 l6 -7 l6 7 l6 -7 l6 7 l6 -7 l6 7 Q94 114 60 114 Q26 114 32 92 Z" fill="url(#shell)" stroke="#bdb5a1" strokeWidth={1.2} />
                                </G>
                            ) : (
                                <G>
                                    {eyes}
                                    <Polygon points={`${60 - 5},${shape.headCy + 4} ${60 + 5},${shape.headCy + 4} 60,${shape.headCy + 11}`} fill={beak} />
                                    <Circle cx={45} cy={shape.headCy + 5} r={3} fill="#ff8fb8" opacity={0.55} />
                                    <Circle cx={75} cy={shape.headCy + 5} r={3} fill="#ff8fb8" opacity={0.55} />
                                </G>
                            )}
                            {worn}
                            {/* the gold shine sweeps across the body and head only */}
                            {maxed && animated ? (
                                <G clipPath="url(#silhouette)">
                                    <AnimatedRect x={shineX} y={0} width={16} height={120} fill="#ffffff" opacity={0.55} rotation={20} origin="60, 60" />
                                </G>
                            ) : null}
                        </G>
                    )}
                </Svg>
            </Animated.View>
            {maxed && animated ? (
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                    {sparkle(0.12, 0.2, 0)}
                    {sparkle(0.8, 0.15, 0.2)}
                    {sparkle(0.78, 0.62, 0.1)}
                    {sparkle(0.08, 0.58, 0.3)}
                </View>
            ) : null}
        </Pressable>
    );
}

/** How far through its current stage the pet is, for a small caption. */
export const growthFraction = stageProgress;

const s = StyleSheet.create({
    sparkle: { position: "absolute" },
});

