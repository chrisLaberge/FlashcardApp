import { Pressable as NativePressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

/** A touch area this much bigger than the button on every side, so small buttons are easy to hit. */
export const TOUCH_MARGIN = 10;
const SLOP = { top: TOUCH_MARGIN, bottom: TOUCH_MARGIN, left: TOUCH_MARGIN, right: TOUCH_MARGIN };

/**
 * The app's button base. Same as React Native's Pressable, with two differences that matter on a phone:
 * a wider touch area, and the button dims the moment a finger lands, so every tap is answered at once
 * (before the work behind it has started). Pass dim={false} for big areas such as a modal backdrop.
 */
export default function Pressable({ hitSlop = SLOP, style, dim = true, ...rest }: PressableProps & { dim?: boolean }) {
    return (
        <NativePressable
            hitSlop={hitSlop}
            style={(state) => [typeof style === "function" ? style(state) : (style as StyleProp<ViewStyle>), dim && state.pressed && !rest.disabled ? PRESSED : null]}
            {...rest}
        />
    );
}

const PRESSED = { opacity: 0.7 } as const;
