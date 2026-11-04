import { router, useFocusEffect } from "expo-router";
import { useCallback, useState, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ActivityCalendar from "../../components/ActivityCalendar";
import { getCardsAdded, getReviewLog, type CardsAdded } from "../../database/database";
import { achievements, TIERS, tierSummary, type Achievement } from "../../models/Achievements";
import { getBonusXp } from "../../services/achievementUnlocks";
import { countByDay } from "../../models/Calendar";
import { streakWithFreezes } from "../../models/StreakFreeze";
import { levelProgress, totalXp } from "../../models/Progression";
import { dailyStats, localDay, totals, type DayStats, type LoggedReview } from "../../models/Stats";
import { useTheme } from "../../theme/ThemeProvider";
import type { Palette } from "../../theme/themes";

type Summary = {
    xp: number;
    reviews: number;
    accuracy: number;
    timeMs: number;
    current: number;
    longest: number;
    studiedToday: boolean;
    freezes: number;
    today: string;
    reviewDays: Map<string, DayStats>;
    addedDays: Map<string, number>;
    achievements: Achievement[];
};

function summarize(log: LoggedReview[], added: CardsAdded, bonusXp: number, nowMs: number): Summary {
    const days = dailyStats(log);
    const sum = totals(log);
    const today = localDay(nowMs);
    const run = streakWithFreezes(days.filter((d) => d.reviews > 0).map((d) => d.day), today);
    return {
        xp: totalXp(log) + bonusXp, // reviews plus achievement bonuses
        reviews: sum.reviews,
        accuracy: sum.accuracy,
        timeMs: sum.timeMs,
        current: run.current,
        longest: run.longest,
        studiedToday: run.studiedToday,
        today,
        freezes: run.freezes,
        reviewDays: new Map(days.map((d) => [d.day, d])),
        addedDays: countByDay(added.addedAt, localDay),
        achievements: achievements({ reviews: log, cardsAdded: added.addedAt.length + added.undated, nowMs }),
    };
}

function formatTime(ms: number): string {
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export default function StatsScreen() {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const [summary, setSummary] = useState<Summary | null>(null);

    useFocusEffect(
        useCallback(() => {
            let active = true;
            Promise.all([getReviewLog(), getCardsAdded(), getBonusXp()]).then(([log, added, bonusXp]) => {
                if (active) setSummary(summarize(log, added, bonusXp, Date.now()));
            });
            return () => {
                active = false;
            };
        }, []),
    );

    if (!summary) return <View style={s.container} />;

    const level = levelProgress(summary.xp);
    const tiers = tierSummary(summary.achievements);

    return (
        <ScrollView style={s.container} contentContainerStyle={s.content}>
            <View style={s.card}>
                <Text style={s.levelLabel}>Level {level.level}</Text>
                <View style={s.track}>
                    <View style={[s.fill, { width: `${Math.round(level.fraction * 100)}%` }]} />
                </View>
                <Text style={s.muted}>
                    {level.xpIntoLevel} / {level.xpForNext} XP to level {level.level + 1} · {summary.xp} XP total
                </Text>
            </View>

            <View style={s.grid}>
                <Tile label="Streak" value={`${summary.current} 🔥`} note={`${summary.studiedToday ? "done today" : "study today"} · ${summary.freezes} ❄️`} />
                <Tile label="Best streak" value={String(summary.longest)} note="days" />
                <Tile label="Reviews" value={summary.reviews.toLocaleString("en-US")} note={`${summary.accuracy}% correct`} />
                <Tile label="Time" value={formatTime(summary.timeMs)} note="in reviews" />
            </View>

            <ActivityCalendar reviewDays={summary.reviewDays} addedDays={summary.addedDays} today={summary.today} />

            <Pressable style={s.card} onPress={() => router.push("/achievements")} accessibilityRole="button">
                <View style={s.goalRow}>
                    <Text style={s.heading}>Achievements</Text>
                    <Text style={s.muted}>{tiers.earned} / {tiers.total}  ›</Text>
                </View>
                <View style={s.medals}>
                    {summary.achievements.map((a) => (
                        <View key={a.id} style={[s.medal, { borderColor: a.tier > 0 ? TIERS[a.tier - 1].color : t.surfaceHigh }]}>
                            <Text style={[s.medalIcon, a.tier === 0 && { opacity: 0.35 }]}>{a.icon}</Text>
                        </View>
                    ))}
                </View>
            </Pressable>

            <View style={s.links}>
                <Pressable style={s.linkButton} onPress={() => router.push("/leaderboard")}>
                    <Text style={s.linkText}>🏆 Leaderboard</Text>
                </Pressable>
                <Pressable style={s.linkButton} onPress={() => router.push("/friends")}>
                    <Text style={s.linkText}>👥 Friends</Text>
                </Pressable>
            </View>
            <Pressable style={[s.linkButton, { flex: 0, marginTop: 10 }]} onPress={() => router.push("/addedWords")}>
                <Text style={s.linkText}>📖 Words you added</Text>
            </Pressable>
        </ScrollView>
    );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    return (
        <View style={s.tile}>
            <Text style={s.muted}>{label}</Text>
            <Text style={s.tileValue}>{value}</Text>
            <Text style={s.tileNote}>{note}</Text>
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, paddingBottom: 60, gap: 14 },
    card: { backgroundColor: t.surface, borderRadius: 14, padding: 16, gap: 10 },
    levelLabel: { color: t.yellow, fontSize: 26, fontWeight: "bold" },
    heading: { color: t.text, fontSize: 17, fontWeight: "600" },
    muted: { color: t.muted, fontSize: 13 },
    track: { height: 10, borderRadius: 5, backgroundColor: t.surfaceHigh, overflow: "hidden" },
    fill: { height: "100%", backgroundColor: t.green },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
    tile: { flexGrow: 1, flexBasis: "45%", backgroundColor: t.surface, borderRadius: 14, padding: 14 },
    tileValue: { color: t.text, fontSize: 24, fontWeight: "bold", marginTop: 2 },
    tileNote: { color: t.subtle, fontSize: 12, marginTop: 2 },
    goalRow: { flexDirection: "row", justifyContent: "space-between" },
    medals: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    medal: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, alignItems: "center", justifyContent: "center", backgroundColor: t.bg },
    medalIcon: { fontSize: 18 },
    links: { flexDirection: "row", gap: 14 },
    linkButton: { flex: 1, backgroundColor: t.surfaceHigh, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
    linkText: { color: t.text, fontSize: 15, fontWeight: "600" },
});
