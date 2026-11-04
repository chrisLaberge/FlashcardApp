import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { SectionList, StyleSheet, Text, View } from "react-native";
import { getAddedWords } from "../database/database";
import { dayHeading, groupByDay, type AddedDay } from "../models/AddedWords";
import { localDay } from "../models/Stats";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

export default function AddedWordsScreen() {
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

    return (
        <View style={s.container}>
            <Stack.Screen options={{ title: "Words you added" }} />
            {days && days.length === 0 && <Text style={s.empty}>No words added yet. Add a card and it shows up here.</Text>}
            {days && days.length > 0 && (
                <SectionList
                    sections={days.map((d) => ({ title: `${dayHeading(d.day, today)} · ${d.words.length}`, data: d.words }))}
                    keyExtractor={(w) => String(w.id)}
                    contentContainerStyle={s.list}
                    stickySectionHeadersEnabled={false}
                    renderSectionHeader={({ section }) => <Text style={s.heading}>{section.title}</Text>}
                    renderItem={({ item }) => (
                        <View style={s.row}>
                            <Text style={s.word}>{item.learningText}</Text>
                            <Text style={s.meaning} numberOfLines={2}>{item.localizedText}</Text>
                        </View>
                    )}
                />
            )}
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    list: { padding: 16, paddingBottom: 40 },
    heading: { color: t.yellow, fontSize: 13, fontWeight: "700", textTransform: "uppercase", marginTop: 18, marginBottom: 8 },
    row: { backgroundColor: t.surface, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 6 },
    word: { color: t.text, fontSize: 17, fontWeight: "600" },
    meaning: { color: t.muted, fontSize: 14, marginTop: 2 },
    empty: { color: t.muted, textAlign: "center", marginTop: 60, paddingHorizontal: 30 },
});
