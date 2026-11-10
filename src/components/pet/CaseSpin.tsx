import { useEffect, useMemo, useState } from "react";
import { Animated, Easing, Modal, StyleSheet, Text, View } from "react-native";
import Pressable from "../Pressable";
import { CASE_POOL, RARITY_COLOR, type Accessory } from "../../models/Shop";
import { useTheme } from "../../theme/ThemeProvider";
import type { Palette } from "../../theme/themes";

const TILE = 92;
const GAP = 8;
const STEP = TILE + GAP;
const WINNER_INDEX = 38;
const COUNT = 46;
const SPIN_MS = 5200;

type Props = {
    /** What the case dropped (already decided and saved). */
    prize: Accessory;
    duplicate: boolean;
    refund: number;
    onClose: () => void;
};

/** The case opening: a strip of items rolls past a marker and slows to a stop on the prize. */
export default function CaseSpin({ prize, duplicate, refund, onClose }: Props) {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const [width, setWidth] = useState(0);
    const [scroll] = useState(() => new Animated.Value(0));
    const [done, setDone] = useState(false);

    // Random items to pass by, with the prize at a fixed place. Built once.
    const [strip] = useState<Accessory[]>(() =>
        Array.from({ length: COUNT }, (_, i) => (i === WINNER_INDEX ? prize : CASE_POOL[Math.floor(Math.random() * CASE_POOL.length)])),
    );

    useEffect(() => {
        if (width === 0) return;
        // Land somewhere inside the winning tile, not always dead centre.
        const jitter = (Math.random() - 0.5) * (TILE * 0.6);
        const target = WINNER_INDEX * STEP + TILE / 2 + jitter - width / 2;
        const animation = Animated.timing(scroll, { toValue: target, duration: SPIN_MS, easing: Easing.bezier(0.08, 0.7, 0.12, 1), useNativeDriver: true });
        animation.start(({ finished }) => {
            if (finished) setDone(true);
        });
        return () => animation.stop();
    }, [width, scroll]);

    return (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={done ? onClose : undefined}>
            <View style={s.backdrop}>
                <Text style={s.title}>{done ? (duplicate ? "You already had it" : "You got it!") : "Opening case…"}</Text>

                <View style={s.window} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
                    <Animated.View style={[s.strip, { transform: [{ translateX: Animated.multiply(scroll, -1) }] }]}>
                        {strip.map((item, i) => (
                            <View key={i} style={[s.tile, { borderColor: RARITY_COLOR[item.rarity] }]}>
                                <Text style={s.emoji}>{item.emoji}</Text>
                                <Text style={s.tileName} numberOfLines={2}>{item.name}</Text>
                                <View style={[s.rarityBar, { backgroundColor: RARITY_COLOR[item.rarity] }]} />
                            </View>
                        ))}
                    </Animated.View>
                    <View pointerEvents="none" style={s.marker} />
                </View>

                {done ? (
                    <View style={s.result}>
                        <Text style={[s.rarity, { color: RARITY_COLOR[prize.rarity] }]}>{prize.rarity.toUpperCase()}</Text>
                        <Text style={s.prizeName}>{prize.emoji} {prize.name}</Text>
                        {duplicate ? <Text style={s.note}>Duplicate: {refund} gems back.</Text> : <Text style={s.note}>Added to your wardrobe.</Text>}
                        <Pressable style={s.button} onPress={onClose} accessibilityRole="button">
                            <Text style={s.buttonText}>Done</Text>
                        </Pressable>
                    </View>
                ) : null}
            </View>
        </Modal>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", gap: 24 },
    title: { color: "#ffffff", fontSize: 22, fontWeight: "700", textAlign: "center" },
    window: { height: TILE + 24, overflow: "hidden", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" },
    strip: { flexDirection: "row", gap: GAP, paddingHorizontal: 0 },
    tile: { width: TILE, height: TILE + 8, borderRadius: 12, borderWidth: 2, backgroundColor: "#1b1d27", alignItems: "center", justifyContent: "center", padding: 6, overflow: "hidden" },
    emoji: { fontSize: 34 },
    tileName: { color: "#d8dbe6", fontSize: 11, textAlign: "center", marginTop: 2 },
    rarityBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 4 },
    marker: { position: "absolute", top: 0, bottom: 0, left: "50%", width: 3, marginLeft: -1.5, backgroundColor: "#ffffff" },
    result: { alignItems: "center", gap: 6, paddingHorizontal: 24 },
    rarity: { fontSize: 13, fontWeight: "800", letterSpacing: 2 },
    prizeName: { color: "#ffffff", fontSize: 24, fontWeight: "700" },
    note: { color: t.muted, fontSize: 14 },
    button: { marginTop: 10, backgroundColor: t.green, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 40 },
    buttonText: { color: t.bg, fontWeight: "600", fontSize: 16 },
});
