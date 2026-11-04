import { useMemo } from "react";
import { Text, type TextProps } from "react-native";
import { tokenize } from "../models/Tokens";

type Props = TextProps & {
    text: string;
    /** A word was tapped. */
    onWord: (word: string) => void;
    /** A word was held down: the whole text is meant. */
    onSentence: (text: string) => void;
};

/** Text where each word can be tapped (the word) or held (the whole text). Looks like plain text. */
export default function TappableText({ text, onWord, onSentence, ...rest }: Props) {
    const tokens = useMemo(() => tokenize(text), [text]);
    return (
        <Text {...rest}>
            {tokens.map((token, i) =>
                token.word ? (
                    <Text key={i} suppressHighlighting onPress={() => onWord(token.text)} onLongPress={() => onSentence(text)}>
                        {token.text}
                    </Text>
                ) : (
                    token.text
                ),
            )}
        </Text>
    );
}
