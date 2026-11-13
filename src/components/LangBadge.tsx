import { Text } from "react-native";
import { getLanguage } from "../constants/languages";

/** A language's country flag (a globe when no language is given). Kept as the flag emoji on purpose. */
export default function LangBadge({ code, size = 28 }: { code?: string | null; size?: number }) {
    return <Text style={{ fontSize: size * 0.9 }}>{(code ? getLanguage(code)?.flag : null) ?? "🌐"}</Text>;
}
