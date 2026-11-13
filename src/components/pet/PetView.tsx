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
    const hatchling0 = stage.id === "hatchling";
    const shape =
        stage.id === "chick" ? { cy: 82, rx: 22, ry: 17, headCy: 60, headR: 14, legTop: 94 }
        : stage.id === "youngster" ? { cy: 72, rx: 25, ry: 19, headCy: 48, headR: 15, legTop: 87 }
        : stage.id === "adult" ? { cy: 64, rx: 27, ry: 21, headCy: 38, headR: 16, legTop: 81 }
        : stage.id === "golden" ? { cy: 62, rx: 28, ry: 23, headCy: 35, headR: 16, legTop: 80 }
        : hatchling0 ? { cy: 74, rx: 28, ry: 24, headCy: 46, headR: 17, legTop: 97 }
        : { cy: 74, rx: 28, ry: 24, headCy: 46, headR: 17, legTop: 97 };
    const body = maxed ? "url(#gold)" : adult ? "#20244a" : stage.id === "youngster" ? "#232a55" : "#262b3d";
    const chest = maxed ? "#fff3b0" : stage.id === "youngster" ? "#3b4fb8" : "#4a55d6";
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

    // The grown-up bird: a pukeko with a big red shield and beak, a blue chest and long legs with huge feet.
    const bigger = stage.id === "adult" || stage.id === "golden";
    const hc = shape.headCy;
    const hr = shape.headR;
    const sh = stage.id === "chick" ? 0 : stage.id === "youngster" ? 0.55 : 1;
    const bk = stage.id === "chick" ? 0.55 : stage.id === "youngster" ? 0.8 : 1;
    const toe = stage.id === "chick" ? 8 : stage.id === "youngster" ? 11 : 14;
    const legW = stage.id === "chick" ? 3 : stage.id === "youngster" ? 3.8 : 4.6;
    const foot = (x: number, y: number) => `M${x} ${y} L${x + toe} ${y + 3} M${x} ${y} L${x + 2} ${y + 4.5} M${x} ${y} L${x - toe * 0.8} ${y + 3.5}`;
    const bird = (
        <G>
            {maxed ? (
                <G>
                    <Circle cx={60} cy={62} r={50} fill="#ffd25a" opacity={0.13} />
                    {Array.from({ length: 14 }, (_, i) => {
                        const a = (Math.PI * 2 * i) / 14;
                        return <Path key={i} d={`M${60 + Math.cos(a) * 40} ${62 + Math.sin(a) * 40} L${60 + Math.cos(a) * 58} ${62 + Math.sin(a) * 58}`} stroke="#ffd25a" strokeWidth={3} strokeLinecap="round" opacity={0.5} />;
                    })}
                </G>
            ) : null}
            {/* legs: one planted, one lifted mid-stomp (both planted for the chick) */}
            <G stroke={beak} strokeWidth={legW} strokeLinecap="round" strokeLinejoin="round" fill="none">
                <Path d={`M70 ${shape.legTop} L72 108 ${foot(72, 108)}`} />
                {stage.id === "chick"
                    ? <Path d={`M50 ${shape.legTop} L48 108 ${foot(48, 108)}`} />
                    : <Path d={`M50 ${shape.legTop} L45 ${shape.legTop + 9} L36 ${shape.legTop + 12} ${foot(36, shape.legTop + 12)}`} />}
            </G>
            {bigger ? (
                <G>
                    {maxed
                        ? [-1, 0, 1].map((i) => <Path key={i} d={`M${60 + shape.rx - 6} ${shape.cy} Q${60 + shape.rx + 14 + i * 3} ${shape.cy + i * 9 - 6} ${60 + shape.rx + 12 + i * 4} ${shape.cy + i * 12 - 18}`} stroke="url(#gold)" strokeWidth={6} strokeLinecap="round" fill="none" />)
                        : <Path d={`M${60 + shape.rx - 5} ${shape.cy - 4} Q${60 + shape.rx + 13} ${shape.cy - 10} ${60 + shape.rx + 9} ${shape.cy - 18} Q${60 + shape.rx + 12} ${shape.cy + 2} ${60 + shape.rx - 2} ${shape.cy + 6} Z`} fill={body} />}
                    <Polygon points={`${60 + shape.rx - 2},${shape.cy + 3} ${60 + shape.rx + 9},${shape.cy - 1} ${60 + shape.rx + 3},${shape.cy + 9}`} fill="#ffffff" />
                </G>
            ) : null}
            <Ellipse cx={60} cy={shape.cy} rx={shape.rx} ry={shape.ry} fill={body} />
            {bigger ? <Path d={`M${60 - shape.rx * 0.1} ${shape.cy - shape.ry * 0.55} Q${60 + shape.rx * 0.75} ${shape.cy - shape.ry * 0.75} ${60 + shape.rx * 0.88} ${shape.cy + shape.ry * 0.1} Q${60 + shape.rx * 0.35} ${shape.cy + shape.ry * 0.55} ${60 - shape.rx * 0.1} ${shape.cy - shape.ry * 0.55} Z`} fill={maxed ? "#c98f1c" : "#13173a"} opacity={0.7} /> : null}
            {stage.id !== "chick" ? <Ellipse cx={58} cy={shape.cy + shape.ry * 0.3} rx={shape.rx * 0.66} ry={shape.ry * 0.62} fill={chest} opacity={maxed ? 0.95 : 0.9} /> : null}
            {stage.id !== "chick" && !maxed ? <Ellipse cx={55} cy={shape.cy + shape.ry * 0.15} rx={shape.rx * 0.34} ry={shape.ry * 0.3} fill="#7f8aff" opacity={0.45} /> : null}
            {maxed ? [-1, 0, 1].map((i) => <Path key={`c${i}`} d={`M${60 + i * 5} ${hc - hr + 2} Q${60 + i * 9} ${hc - hr - 7} ${60 + i * 14} ${hc - hr - 11 + Math.abs(i) * 3}`} stroke="url(#gold)" strokeWidth={3.2} strokeLinecap="round" fill="none" />) : null}
            <Circle cx={60} cy={hc} r={hr} fill={body} />
            {stage.id === "chick" ? <Path d={`M54 ${hc - hr + 1} l-2 -5 M60 ${hc - hr} l0 -6 M66 ${hc - hr + 1} l2 -5`} stroke={body} strokeWidth={2.4} strokeLinecap="round" /> : null}
            {sh > 0 ? (
                <G>
                    <Path d={`M${60 - 6.5 * sh} ${hc - 3} Q${60 - 8.5 * sh} ${hc - hr + 1} 60 ${hc - hr - 1} Q${60 + 8.5 * sh} ${hc - hr + 1} ${60 + 6.5 * sh} ${hc - 3} Z`} fill={maxed ? "#d63a3a" : beak} />
                    <Rect x={58.4} y={hc - 4} width={3.2} height={7} fill={maxed ? "#d63a3a" : beak} />
                </G>
            ) : null}
            {eyes}
            <Polygon points={`${60 - 7 * bk},${hc + 2} ${60 + 7 * bk},${hc + 2} 60,${hc + 2 + 11 * bk}`} fill={beak} />
            <Polygon points={`${60 - 2.6 * bk},${hc + 2 + 8 * bk} ${60 + 2.6 * bk},${hc + 2 + 8 * bk} 60,${hc + 2 + 11 * bk}`} fill="#ffd9a0" />
            {bigger ? null : (
                <G>
                    <Circle cx={60 - hr * 0.8} cy={hc + 5} r={3} fill="#ff8fb8" opacity={0.5} />
                    <Circle cx={60 + hr * 0.8} cy={hc + 5} r={3} fill="#ff8fb8" opacity={0.5} />
                </G>
            )}
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
                            {hatchling ? (
                                <G>
                                    <Circle cx={60} cy={70} r={17} fill={body} />
                                    <G transform="translate(0 24)">{eyes}</G>
                                    <Polygon points="55,76 65,76 60,83" fill={beak} />
                                    <Path d="M32 92 l6 -7 l6 7 l6 -7 l6 7 l6 -7 l6 7 l6 -7 l6 7 l6 -7 l6 7 Q94 114 60 114 Q26 114 32 92 Z" fill="url(#shell)" stroke="#bdb5a1" strokeWidth={1.2} />
                                </G>
                            ) : bird}
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

