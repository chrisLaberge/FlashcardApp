import Svg from "react-native-svg";
import { renderAccessory, slotOf, type Anchors } from "./Accessories";

/** Where the pet's head sits on a grown pet, so a hat, glasses or scarf is drawn exactly as it is worn. */
const ANCHORS: Anchors = { cx: 60, headTop: 29, eyeY: 44, neckY: 60, r: 17 };
/** The window of the drawing to show for each kind of item (60 wide, centred on the item). */
const WINDOW = { hat: "30 -10 60 60", glasses: "30 14 60 60", scarf: "30 35 60 60" } as const;

/** One accessory by itself, drawn with the same shapes as on the pet. */
export default function AccessoryIcon({ id, size = 36 }: { id: string; size?: number }) {
    const slot = slotOf(id);
    if (!slot) return null;
    return (
        <Svg width={size} height={size} viewBox={WINDOW[slot]}>
            {renderAccessory(id, ANCHORS)}
        </Svg>
    );
}
