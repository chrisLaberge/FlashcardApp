import { useMemo } from "react";
import { Text, type TextProps } from "react-native";
import { tokenize } from "../models/Tokens";
import type { WordRange } from "../models/Selection";
import { useTheme } from "../theme/ThemeProvider";

type Props = TextProps & {
    text: string;
    /** The words currently picked, shown highlighted. */
    selection?: WordRange | null;
    /** A word was tapped (its number, 0 for the first word). */
    onWord: (index: number) => void;
    /** A word was held down. */
    onHold: (index: number) => void;
};

/** Text where each word can be tapped or held. Looks like plain text until some words are picked. */
export default function TappableText({ text, selection, onWord, onHold, ...rest }: Props) {
    const t = useTheme();
    const tokens = useMemo(() => tokenize(text), [text]);
    const highlight = { backgroundColor: `${t.blue}55` };

    let words = 0;
    return (
        <Text {...rest}>
            {tokens.map((token, i) => {
                if (token.word) {
                    const index = words++;
                    const picked = !!selection && index >= selection.from && index <= selection.to;
                    return (
                        <Text key={i} suppressHighlighting style={picked ? highlight : undefined} onPress={() => onWord(index)} onLongPress={() => onHold(index)}>
                            {token.text}
                        </Text>
                    );
                }
                // The spaces and commas between two picked words are highlighted too.
                const inside = !!selection && words - 1 >= selection.from && words <= selection.to;
                return inside ? <Text key={i} style={highlight}>{token.text}</Text> : token.text;
            })}
        </Text>
    );
}
