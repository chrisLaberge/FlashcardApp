import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { Keyboard, Platform, View, type KeyboardEvent, type ViewProps } from "react-native";
import { keyboardOverlap } from "../utils/keyboard";

/**
 * A View that keeps its content above the keyboard on both platforms.
 *
 * It pads its own bottom edge by the measured overlap between the view and the keyboard, so it is
 * correct whether or not Android resizes the window for us (it does not when the app draws edge to
 * edge, which is why KeyboardAvoidingView did nothing there) and it never double-counts.
 * Use it as the root of a screen or of a <Modal> (with `statusBarTranslucent` on the Modal).
 */
export default function KeyboardInsetView({ style, onLayout, ...rest }: ViewProps) {
    const ref = useRef<ComponentRef<typeof View>>(null);
    const keyboardTop = useRef<number | null>(null);
    const [inset, setInset] = useState(0);

    const measure = useCallback(() => {
        const view = ref.current;
        if (!view || keyboardTop.current === null) {
            setInset(0);
            return;
        }
        view.measureInWindow((_x, y, _width, height) => {
            setInset(keyboardOverlap(y + height, keyboardTop.current));
        });
    }, []);

    useEffect(() => {
        const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

        const show = Keyboard.addListener(showEvent, (event: KeyboardEvent) => {
            keyboardTop.current = event.endCoordinates.screenY;
            measure();
        });
        const hide = Keyboard.addListener(hideEvent, () => {
            keyboardTop.current = null;
            setInset(0);
        });

        return () => {
            show.remove();
            hide.remove();
        };
    }, [measure]);

    return (
        <View
            {...rest}
            ref={ref}
            onLayout={(event) => {
                measure();
                onLayout?.(event);
            }}
            style={[style, { paddingBottom: inset }]}
        />
    );
}
