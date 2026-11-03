import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getReviewLog } from "../database/database";
import { levelProgress, milestones, nextMilestones, totalXp, type Milestone } from "../models/Progression";
import { dailyStats, localDay, shiftDay, streaks, totals, type LoggedReview } from "../models/Stats";

type Summary = {
    xp: number;
    reviews: number;
    accuracy: number;
    timeMs: number;
    current: number;
    longest: number;
    studiedToday: boolean;
    week: { day: string; reviews: number }[];
    milestones: Milestone[];
};

function summarize(log: LoggedReview[], nowMs: number): Summary {
    const days = dailyStats(log);
    const sum = totals(log);
    const run = streaks(days, nowMs);
    const today = localDay(nowMs);
    const byDay = new Map(days.map((d) => [d.day, d.reviews]));
    const week = Array.from({ length: 7 }, (_, i) => {
        const day = shiftDay(today, i - 6);
        return { day, reviews: byDay.get(day) ?? 0 };
    });
    return {
        xp: totalXp(log),
        reviews: sum.reviews,
        accuracy: sum.accuracy,
        timeMs: sum.timeMs,
        current: run.current,
        longest: run.longest,
        studiedToday: run.studiedToday,
        week,
        milestones: milestones(log, days, nowMs),
    };
}

function formatTime(ms: number): string {
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export default function StatsScreen() {
    const [summary, setSummary] = useState<Summary | null>(null);

    useFocusEffect(
        useCallback(() => {
            let active = true;
            getReviewLog().then((log) => {
                if (active) setSummary(summarize(log, Date.now()));
            });
            return () => {
                active = false;
            };
        }, []),
    );

    if (!summary) return <View style={s.container} />;

    const level = levelProgress(summary.xp);
    const maxDay = Math.max(1, ...summary.week.map((d) => d.reviews));
    const next = nextMilestones(summary.milestones);
    const achieved = summary.milestones.filter((m) => m.achieved);

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
                <Tile label="Streak" value={`${summary.current} 🔥`} note={summary.studiedToday ? "done today" : "study today to keep it"} />
                <Tile label="Best streak" value={String(summary.longest)} note="days" />
                <Tile label="Reviews" value={summary.reviews.toLocaleString("en-US")} note={`${summary.accuracy}% correct`} />
                <Tile label="Time" value={formatTime(summary.timeMs)} note="in reviews" />
            </View>

            <View style={s.card}>
                <Text style={s.heading}>Last 7 days</Text>
                <View style={s.chart}>
                    {summary.week.map((d) => (
                        <View key={d.day} style={s.barCol}>
                            <View style={s.barSlot}>
                                <View style={[s.barFill, { height: `${(d.reviews / maxDay) * 100}%` }]} />
                            </View>
                            <Text style={s.barCount}>{d.reviews}</Text>
                            <Text style={s.barDay}>{d.day.slice(8)}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={s.card}>
                <Text style={s.heading}>Next goals</Text>
                {next.map((m) => (
                    <View key={m.id} style={s.goal}>
                        <View style={s.goalRow}>
                            <Text style={s.goalTitle}>{m.description}</Text>
                            <Text style={s.muted}>{m.value.toLocaleString("en-US")} / {m.target.toLocaleString("en-US")}</Text>
                        </View>
                        <View style={s.track}>
                            <View style={[s.fill, { width: `${Math.min(100, Math.round((m.value / m.target) * 100))}%` }]} />
                        </View>
                    </View>
                ))}
            </View>

            <View style={s.card}>
                <Text style={s.heading}>Milestones reached ({achieved.length})</Text>
                {achieved.length === 0 ? (
                    <Text style={s.muted}>Your first one is not far away.</Text>
                ) : (
                    <View style={s.badges}>
                        {achieved.map((m) => (
                            <Text key={m.id} style={s.badge}>🏅 {m.title}</Text>
                        ))}
                    </View>
                )}
            </View>

            <View style={s.links}>
                <Pressable style={s.linkButton} onPress={() => router.push("/leaderboard")}>
                    <Text style={s.linkText}>🏆 Leaderboard</Text>
                </Pressable>
                <Pressable style={s.linkButton} onPress={() => router.push("/friends")}>
                    <Text style={s.linkText}>👥 Friends</Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
    return (
        <View style={s.tile}>
            <Text style={s.muted}>{label}</Text>
            <Text style={s.tileValue}>{value}</Text>
            <Text style={s.tileNote}>{note}</Text>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#282828" },
    content: { padding: 20, paddingBottom: 60, gap: 14 },
    card: { backgroundColor: "#3c3836", borderRadius: 14, padding: 16, gap: 10 },
    levelLabel: { color: "#fabd2f", fontSize: 26, fontWeight: "bold" },
    heading: { color: "#ebdbb2", fontSize: 17, fontWeight: "600" },
    muted: { color: "#a89984", fontSize: 13 },
    track: { height: 10, borderRadius: 5, backgroundColor: "#504945", overflow: "hidden" },
    fill: { height: "100%", backgroundColor: "#b8bb26" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
    tile: { flexGrow: 1, flexBasis: "45%", backgroundColor: "#3c3836", borderRadius: 14, padding: 14 },
    tileValue: { color: "#ebdbb2", fontSize: 24, fontWeight: "bold", marginTop: 2 },
    tileNote: { color: "#7c6f64", fontSize: 12, marginTop: 2 },
    chart: { flexDirection: "row", gap: 6, height: 120 },
    barCol: { flex: 1, alignItems: "center" },
    barSlot: { flex: 1, width: "70%", justifyContent: "flex-end", backgroundColor: "#32302f", borderRadius: 4, overflow: "hidden" },
    barFill: { width: "100%", backgroundColor: "#83a598" },
    barCount: { color: "#ebdbb2", fontSize: 11, marginTop: 4 },
    barDay: { color: "#7c6f64", fontSize: 11 },
    goal: { gap: 6 },
    goalRow: { flexDirection: "row", justifyContent: "space-between" },
    goalTitle: { color: "#ebdbb2", fontSize: 14 },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    links: { flexDirection: "row", gap: 14 },
    linkButton: { flex: 1, backgroundColor: "#504945", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
    linkText: { color: "#ebdbb2", fontSize: 15, fontWeight: "600" },
    badge: { color: "#ebdbb2", backgroundColor: "#504945", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13 },
});
