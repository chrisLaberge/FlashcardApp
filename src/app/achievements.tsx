import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { getCardsAdded, getReviewLog } from "../database/database";
import { achievements, TIERS, tierSummary, type Achievement } from "../models/Achievements";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

export default function AchievementsScreen() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const [list, setList] = useState<Achievement[] | null>(null);

    useFocusEffect(
        useCallback(() => {
            let active = true;
            Promise.all([getReviewLog(), getCardsAdded()]).then(([log, added]) => {
                if (active) setList(achievements({ reviews: log, cardsAdded: added.addedAt.length + added.undated, nowMs: Date.now() }));
            });
            return () => {
                active = false;
            };
        }, []),
    );

    const summary = list ? tierSummary(list) : null;

    return (
        <ScrollView style={s.container} contentContainerStyle={s.content}>
            <Stack.Screen options={{ title: "Achievements" }} />
            {summary ? <Text style={s.summary}>{summary.earned} / {summary.total}</Text> : null}
            {list?.map((a) => {
                const color = a.tier > 0 ? TIERS[a.tier - 1].color : t.surfaceTop;
                // The God tier lights up the whole card in its colour.
                const god = a.tier === TIERS.length;
                return (
                    <View
                        key={a.id}
                        style={[s.card, god && { backgroundColor: `${color}26`, borderWidth: 2, borderColor: color, shadowColor: color, shadowOpacity: 0.9, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 12 }]}
                    >
                        <View style={s.top}>
                            <View style={[s.medal, { borderColor: color }]}>
                                <Text style={s.icon}>{a.icon}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.title}>{a.title}</Text>
                                <Text style={[s.tierName, a.tier > 0 && { color }]}>
                                    {a.tier > 0 ? TIERS[a.tier - 1].name : "Not started"}
                                </Text>
                            </View>
                            <Text style={s.value}>{a.value.toLocaleString("en-US")}</Text>
                        </View>

                        <View style={s.pips}>
                            {TIERS.map((tier, i) => (
                                <View key={tier.id} style={[s.pip, { backgroundColor: i < a.tier ? tier.color : t.surfaceHigh }]} />
                            ))}
                        </View>

                        {a.nextTarget !== null ? (
                            <>
                                <View style={s.track}>
                                    <View style={[s.fill, { width: `${Math.round(a.fraction * 100)}%`, backgroundColor: TIERS[a.tier].color }]} />
                                </View>
                                <Text style={s.goal}>
                                    {a.nextGoal} for {TIERS[a.tier].name} ({a.value.toLocaleString("en-US")} / {a.nextTarget.toLocaleString("en-US")})
                                </Text>
                            </>
                        ) : null}
                    </View>
                );
            })}
        </ScrollView>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, gap: 12, paddingBottom: 60 },
    summary: { color: t.muted, textAlign: "center", fontSize: 14 },
    card: { backgroundColor: t.surface, borderRadius: 14, padding: 14, gap: 10 },
    top: { flexDirection: "row", alignItems: "center", gap: 12 },
    medal: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, alignItems: "center", justifyContent: "center", backgroundColor: t.bg },
    icon: { fontSize: 22 },
    title: { color: t.text, fontSize: 16, fontWeight: "600" },
    tierName: { color: t.muted, fontSize: 13, fontWeight: "600" },
    value: { color: t.text, fontSize: 18, fontWeight: "bold" },
    pips: { flexDirection: "row", gap: 6 },
    pip: { flex: 1, height: 6, borderRadius: 3 },
    track: { height: 8, borderRadius: 4, backgroundColor: t.bg, overflow: "hidden" },
    fill: { height: 8, borderRadius: 4 },
    goal: { color: t.muted, fontSize: 13 },
});
