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

    // The bird by age. Young ones are round and soft; the grown-up pukeko is sharp and serious, with one giant foot.
    const sharp = stage.id === "adult" || stage.id === "golden";
    const hc = shape.headCy;
    const hr = shape.headR;
    const cy = shape.cy;
    const rx = shape.rx;
    const ry = shape.ry;
    const baby = stage.id === "chick";
    const toe = baby ? 10 : stage.id === "youngster" ? 17 : 29;
    const legW = baby ? 3.2 : stage.id === "youngster" ? 4.4 : 6;
    const red = maxed ? "#d63a3a" : beak;

    // A foot made of long toes: the grown-up's is huge and drawn last, over everything, like it is stepping at you.
    const foot = (x: number, y: number, size: number) => (
        <G stroke={beak} strokeWidth={legW} strokeLinecap="round" fill="none">
            <Path d={`M${x} ${y} L${x - size} ${y + size * 0.3} M${x} ${y} L${x - size * 0.45} ${y + size * 0.52} M${x} ${y} L${x + size * 0.2} ${y + size * 0.55} M${x} ${y} L${x + size * 0.7} ${y + size * 0.25}`} />
            <G fill={maxed ? "#7a5a10" : "#2b0d0d"} stroke="none">
                <Circle cx={x - size} cy={y + size * 0.3} r={legW * 0.45} />
                <Circle cx={x - size * 0.45} cy={y + size * 0.52} r={legW * 0.45} />
                <Circle cx={x + size * 0.2} cy={y + size * 0.55} r={legW * 0.45} />
                <Circle cx={x + size * 0.7} cy={y + size * 0.25} r={legW * 0.45} />
            </G>
        </G>
    );

    const roundEyes = eyes;
    const seriousEyes = (
        <G>
            <Path d={`M45 ${hc - 1.5} L56 ${hc - 1.5} L56 ${hc + 2.4} L47 ${hc + 2.4} Z`} fill="#ffffff" />
            <Path d={`M75 ${hc - 1.5} L64 ${hc - 1.5} L64 ${hc + 2.4} L73 ${hc + 2.4} Z`} fill="#ffffff" />
            <Circle cx={53.6} cy={hc + 0.4} r={1.9} fill="#0c0b0d" />
            <Circle cx={66.4} cy={hc + 0.4} r={1.9} fill="#0c0b0d" />
            <Path d={`M43 ${hc - 6} L57.5 ${hc - 1.6} M77 ${hc - 6} L62.5 ${hc - 1.6}`} stroke="#0c0b0d" strokeWidth={2.6} strokeLinecap="round" />
        </G>
    );

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

            {/* legs: the chick has two small ones; the others stand on one leg with a big foot (drawn after the body) */}
            {baby ? (
                <G stroke={beak} strokeWidth={legW} strokeLinecap="round" fill="none">
                    <Path d={`M50 ${shape.legTop} L48 108`} />
                    <Path d={`M70 ${shape.legTop} L72 108`} />
                </G>
            ) : (
                <Path d={`M${sharp ? 58 : 60} ${shape.legTop} L${sharp ? 60 : 60} 101`} stroke={beak} strokeWidth={legW} strokeLinecap="round" />
            )}

            {sharp ? (
                <G>
                    {/* tail: sharp spikes (gold fan when golden) */}
                    {maxed
                        ? [-1, 0, 1].map((i) => <Path key={i} d={`M${60 + rx - 8} ${cy} L${60 + rx + 16 + i * 2} ${cy + i * 11 - 18} L${60 + rx + 2} ${cy + i * 6 - 4} Z`} fill="url(#gold)" />)
                        : <Path d={`M${60 + rx - 8} ${cy - 2} L${60 + rx + 16} ${cy - 20} L${60 + rx + 6} ${cy - 2} L${60 + rx + 14} ${cy + 6} L${60 + rx - 6} ${cy + 8} Z`} fill={body} />}
                    <Polygon points={`${60 + rx - 4},${cy + 6} ${60 + rx + 11},${cy + 1} ${60 + rx + 3},${cy + 11}`} fill="#ffffff" />
                    {/* broad shoulders narrowing to the waist */}
                    <Path d={`M${60 - rx} ${cy - ry * 0.35} Q${60 - rx * 0.85} ${cy - ry * 1.05} 60 ${cy - ry * 1.1} Q${60 + rx * 0.85} ${cy - ry * 1.05} ${60 + rx} ${cy - ry * 0.35} L${60 + rx * 0.5} ${cy + ry * 0.95} L${60 - rx * 0.5} ${cy + ry * 0.95} Z`} fill={body} />
                    <Polygon points={`${60 - rx * 0.72},${cy - ry * 0.62} ${60 + rx * 0.72},${cy - ry * 0.62} ${60 + rx * 0.28},${cy + ry * 0.7} ${60 - rx * 0.28},${cy + ry * 0.7}`} fill={chest} />
                    {!maxed ? <Polygon points={`${60 - rx * 0.4},${cy - ry * 0.45} ${60 + rx * 0.4},${cy - ry * 0.45} 60,${cy + ry * 0.25}`} fill="#7f8aff" opacity={0.4} /> : null}
                    <Polygon points={`${60 - rx - 3},${cy - ry * 0.5} ${60 - rx * 0.6},${cy - ry * 0.7} ${60 - rx * 0.62},${cy + ry * 0.5}`} fill={maxed ? "#c98f1c" : "#13173a"} />
                    <Polygon points={`${60 + rx + 3},${cy - ry * 0.5} ${60 + rx * 0.6},${cy - ry * 0.7} ${60 + rx * 0.62},${cy + ry * 0.5}`} fill={maxed ? "#c98f1c" : "#13173a"} />
                </G>
            ) : (
                <G>
                    <Ellipse cx={60} cy={cy} rx={rx} ry={ry} fill={body} />
                    {stage.id !== "chick" ? <Ellipse cx={58} cy={cy + ry * 0.3} rx={rx * 0.66} ry={ry * 0.62} fill={chest} opacity={0.9} /> : null}
                    {stage.id !== "chick" ? <Ellipse cx={55} cy={cy + ry * 0.15} rx={rx * 0.34} ry={ry * 0.3} fill="#7f8aff" opacity={0.45} /> : null}
                </G>
            )}

            {maxed ? [-1, 0, 1].map((i) => <Path key={`c${i}`} d={`M${60 + i * 5} ${hc - hr + 2} Q${60 + i * 9} ${hc - hr - 7} ${60 + i * 14} ${hc - hr - 11 + Math.abs(i) * 3}`} stroke="url(#gold)" strokeWidth={3.2} strokeLinecap="round" fill="none" />) : null}

            {sharp ? (
                <Path d={`M${60 - hr} ${hc - hr * 0.1} L${60 - hr * 0.82} ${hc - hr * 0.95} L${60 + hr * 0.82} ${hc - hr * 0.95} L${60 + hr} ${hc - hr * 0.1} L${60 + hr * 0.55} ${hc + hr * 0.85} L${60 - hr * 0.55} ${hc + hr * 0.85} Z`} fill={body} strokeLinejoin="round" />
            ) : (
                <Circle cx={60} cy={hc} r={hr} fill={body} />
            )}
            {baby ? <Path d={`M54 ${hc - hr + 1} l-2 -5 M60 ${hc - hr} l0 -6 M66 ${hc - hr + 1} l2 -5`} stroke={body} strokeWidth={2.4} strokeLinecap="round" /> : null}

            {/* red shield on the forehead: a point on the grown-up, a soft bump on the young one */}
            {sharp ? (
                <G>
                    <Polygon points={`${60 - 5},${hc - 2} ${60 - 7.5},${hc - hr + 4} 60,${hc - hr - 2} ${60 + 7.5},${hc - hr + 4} ${60 + 5},${hc - 2}`} fill={red} />
                    <Rect x={58.2} y={hc - 4} width={3.6} height={7} fill={red} />
                </G>
            ) : stage.id === "youngster" ? (
                <G>
                    <Path d={`M${60 - 4} ${hc - 3} Q${60 - 5} ${hc - hr + 1} 60 ${hc - hr} Q${60 + 5} ${hc - hr + 1} ${60 + 4} ${hc - 3} Z`} fill={beak} />
                    <Rect x={58.4} y={hc - 4} width={3.2} height={7} fill={beak} />
                </G>
            ) : null}

            {sharp ? seriousEyes : roundEyes}

            {sharp ? (
                <G>
                    <Polygon points={`${60 - 6},${hc + 3} ${60 + 6},${hc + 3} 60,${hc + 16}`} fill={red} />
                    <Polygon points={`${60 - 2},${hc + 11} ${60 + 2},${hc + 11} 60,${hc + 16}`} fill="#ffd9a0" />
                </G>
            ) : (
                <G>
                    <Polygon points={`${60 - (baby ? 4 : 5.6)},${hc + 2} ${60 + (baby ? 4 : 5.6)},${hc + 2} 60,${hc + (baby ? 8 : 11)}`} fill={beak} />
                    <Circle cx={60 - hr * 0.8} cy={hc + 5} r={3} fill="#ff8fb8" opacity={0.5} />
                    <Circle cx={60 + hr * 0.8} cy={hc + 5} r={3} fill="#ff8fb8" opacity={0.5} />
                </G>
            )}

            {baby ? (
                <G stroke={beak} strokeWidth={legW} strokeLinecap="round" fill="none">
                    <Path d={`M48 108 L38 111 M48 108 L40 113 M48 108 L51 113 M48 108 L58 111`} />
                    <Path d={`M72 108 L62 111 M72 108 L66 113 M72 108 L75 113 M72 108 L82 111`} />
                </G>
            ) : foot(sharp ? 62 : 60, 101, toe)}
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

