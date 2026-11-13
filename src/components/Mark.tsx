import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeProvider";

const NAMES = { close: "close", check: "checkmark", box: "square-outline", boxOn: "checkbox" } as const;

/** The small marks the app uses in place of text symbols: a cross, a tick and checkboxes. */
export default function Mark({ kind, size = 20, color }: { kind: keyof typeof NAMES; size?: number; color?: string }) {
    const t = useTheme();
    return <Ionicons name={NAMES[kind]} size={size} color={color ?? t.muted} />;
}
