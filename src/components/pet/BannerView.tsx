import { useId } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { getBanner } from "../../models/Shop";

/** A profile banner: a soft diagonal gradient with a few light circles. Fills whatever box it is in. */
export default function BannerView({ id, style, children }: { id: string | null | undefined; style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
    const banner = getBanner(id);
    const gradient = `banner-${useId().replace(/[^a-z0-9]/gi, "")}`;
    const [a, b, c] = banner.colors;
    return (
        <View style={[s.box, style]}>
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 300 100" preserveAspectRatio="none">
                <Defs>
                    <LinearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor={a} />
                        <Stop offset="0.55" stopColor={b} />
                        <Stop offset="1" stopColor={c} />
                    </LinearGradient>
                </Defs>
                <Rect width="300" height="100" fill={`url(#${gradient})`} />
                <Circle cx="250" cy="20" r="46" fill="#ffffff" opacity={0.08} />
                <Circle cx="40" cy="95" r="38" fill="#ffffff" opacity={0.07} />
                <Circle cx="170" cy="10" r="16" fill="#ffffff" opacity={0.06} />
            </Svg>
            {children}
        </View>
    );
}

const s = StyleSheet.create({ box: { overflow: "hidden" } });
