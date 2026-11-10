import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { SectionList, StyleSheet, Text } from "react-native";
import Pressable from "./Pressable";
import { getAddedWords } from "../database/database";
import { dayHeading, groupByDay, type AddedDay } from "../models/AddedWords";
import { localDay } from "../models/Stats";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

/** Every card you added, newest first, grouped by day. Tap one to edit it. */
export default function AddedHistory() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const [days, setDays] = useState<AddedDay[] | null>(null);
    const [today, setToday] = useState("");

    useFocusEffect(
        useCallback(() => {
            let active = true;
            getAddedWords().then((words) => {
                if (!active) return;
                setToday(localDay(Date.now()));
                setDays(groupByDay(words));
            });
            return () => {
                active = false;
            };
        }, []),
    );

    if (days === null) return null;
    if (days.length === 0) return <Text style={s.empty}>No cards added yet.</Text>;

    return (
        <SectionList
            sections={days.map((d) => ({ title: `${dayHeading(d.day, today)} · ${d.words.length}`, data: d.words }))}
            keyExtractor={(w) => String(w.id)}
            contentContainerStyle={s.list}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => <Text style={s.heading}>{section.title}</Text>}
            renderItem={({ item }) => (
                <Pressable
                    style={({ pressed }) => [s.row, pressed && s.pressed]}
                    onPress={() => router.push({ pathname: "/editCard", params: { id: String(item.id) } })}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${item.learningText}`}
                >
                    <Text style={s.word}>{item.learningText}</Text>
                    <Text style={s.meaning} numberOfLines={2}>{item.localizedText}</Text>
                </Pressable>
            )}
        />
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    list: { paddingBottom: 40 },
    heading: { color: t.yellow, fontSize: 13, fontWeight: "700", textTransform: "uppercase", marginTop: 8, marginBottom: 8 },
    row: { backgroundColor: t.surface, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: t.surfaceHigh },
    pressed: { opacity: 0.7 },
    word: { color: t.text, fontSize: 17, fontWeight: "600" },
    meaning: { color: t.muted, fontSize: 14, marginTop: 2 },
    empty: { color: t.muted, textAlign: "center", marginTop: 60, paddingHorizontal: 30 },
});
