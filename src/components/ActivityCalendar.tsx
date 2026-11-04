import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { intensity, monthGrid, shiftMonth } from "../models/Calendar";
import type { DayStats } from "../models/Stats";
import { useTheme } from "../theme/ThemeProvider";
import type { Palette } from "../theme/themes";

type Props = {
    /** Reviews, correct answers and time per day. */
    reviewDays: ReadonlyMap<string, DayStats>;
    /** Cards added per day. */
    addedDays: ReadonlyMap<string, number>;
    /** Cards added before dates were recorded (they cannot be placed on the calendar). */
    undated: number;
    /** Today as "YYYY-MM-DD". */
    today: string;
};

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const SHADES = ["", "40", "80", "BF", "FF"] as const; // alpha steps appended to the colour
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMinutes(ms: number): string {
    const minutes = Math.round(ms / 60000);
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** A month calendar coloured by how much happened each day, like GitHub's contribution squares. */
export default function ActivityCalendar({ reviewDays, addedDays, undated, today }: Props) {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const [mode, setMode] = useState<"reviews" | "added">("reviews");
    const [cursor, setCursor] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }));
    const [selected, setSelected] = useState<string | null>(null);

    const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
    const color = mode === "reviews" ? t.green : t.blue;
    const countOf = (day: string) => (mode === "reviews" ? (reviewDays.get(day)?.reviews ?? 0) : (addedDays.get(day) ?? 0));

    const monthDays = grid.weeks.flat().flatMap((cell) => (cell ? [cell.day] : []));
    const max = Math.max(0, ...monthDays.map(countOf));
    const total = monthDays.reduce((sum, day) => sum + countOf(day), 0);
    const activeDays = monthDays.filter((day) => countOf(day) > 0).length;

    const atCurrentMonth = cursor.year === Number(today.slice(0, 4)) && cursor.month === Number(today.slice(5, 7)) - 1;
    const move = (delta: number) => {
        setCursor((c) => shiftMonth(c.year, c.month, delta));
        setSelected(null);
    };

    const detail = (() => {
        if (!selected) return null;
        const [y, m, d] = selected.split("-").map(Number);
        const label = `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
        const review = reviewDays.get(selected);
        const added = addedDays.get(selected) ?? 0;
        const parts: string[] = [];
        if (review) parts.push(`${review.reviews} reviews`, `${Math.round((review.correct / review.reviews) * 100)}% correct`, formatMinutes(review.timeMs));
        if (added) parts.push(`${added} ${added === 1 ? "card" : "cards"} added`);
        return `${label}: ${parts.length ? parts.join(" · ") : "nothing"}`;
    })();

    return (
        <View style={s.card}>
            <View style={s.toggle}>
                {(["reviews", "added"] as const).map((m) => (
                    <Pressable key={m} style={[s.tab, mode === m && s.tabOn]} onPress={() => setMode(m)}>
                        <Text style={[s.tabText, mode === m && s.tabTextOn]}>{m === "reviews" ? "Reviews" : "Cards added"}</Text>
                    </Pressable>
                ))}
            </View>

            <View style={s.header}>
                <Pressable onPress={() => move(-1)} hitSlop={12} accessibilityLabel="Previous month">
                    <Text style={s.arrow}>‹</Text>
                </Pressable>
                <Text style={s.title}>{grid.title}</Text>
                <Pressable onPress={() => move(1)} hitSlop={12} disabled={atCurrentMonth} accessibilityLabel="Next month">
                    <Text style={[s.arrow, atCurrentMonth && s.arrowOff]}>›</Text>
                </Pressable>
            </View>

            <View style={s.row}>
                {WEEKDAYS.map((w, i) => <Text key={i} style={s.weekday}>{w}</Text>)}
            </View>
            {grid.weeks.map((week, wi) => (
                <View key={wi} style={s.row}>
                    {week.map((cell, ci) => {
                        if (!cell) return <View key={ci} style={s.cellSlot} />;
                        const level = intensity(countOf(cell.day), max);
                        const isToday = cell.day === today;
                        const isFuture = cell.day > today;
                        return (
                            <Pressable key={ci} style={s.cellSlot} onPress={() => setSelected(cell.day === selected ? null : cell.day)} disabled={isFuture}>
                                <View
                                    style={[
                                        s.cell,
                                        { backgroundColor: level === 0 ? t.surfaceHigh : `${color}${SHADES[level]}` },
                                        isToday && { borderColor: t.yellow, borderWidth: 2 },
                                        cell.day === selected && { borderColor: t.text, borderWidth: 2 },
                                        isFuture && { opacity: 0.35 },
                                    ]}
                                >
                                    <Text style={[s.date, level >= 3 && { color: t.bg }]}>{cell.date}</Text>
                                </View>
                            </Pressable>
                        );
                    })}
                </View>
            ))}

            <Text style={s.summary}>
                {total === 0
                    ? mode === "reviews" ? "No reviews this month." : "No cards added this month."
                    : mode === "reviews"
                        ? `${total.toLocaleString("en-US")} reviews on ${activeDays} ${activeDays === 1 ? "day" : "days"}`
                        : `${total.toLocaleString("en-US")} ${total === 1 ? "card" : "cards"} added on ${activeDays} ${activeDays === 1 ? "day" : "days"}`}
            </Text>
            {detail ? <Text style={s.detail}>{detail}</Text> : <Text style={s.hint}>Tap a day for details.</Text>}
            {mode === "added" && undated > 0 ? (
                <Text style={s.hint}>{undated.toLocaleString("en-US")} older {undated === 1 ? "card was" : "cards were"} added before dates were recorded, so they are not on the calendar.</Text>
            ) : null}
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    card: { backgroundColor: t.surface, borderRadius: 14, padding: 16, gap: 6 },
    toggle: { flexDirection: "row", backgroundColor: t.bg, borderRadius: 10, padding: 3, marginBottom: 6 },
    tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
    tabOn: { backgroundColor: t.surfaceHigh },
    tabText: { color: t.muted, fontWeight: "600", fontSize: 13 },
    tabTextOn: { color: t.text },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
    title: { color: t.text, fontSize: 16, fontWeight: "600" },
    arrow: { color: t.text, fontSize: 28, paddingHorizontal: 12, lineHeight: 30 },
    arrowOff: { color: t.surfaceTop },
    row: { flexDirection: "row" },
    weekday: { flex: 1, textAlign: "center", color: t.muted, fontSize: 12, paddingBottom: 2 },
    cellSlot: { flex: 1, aspectRatio: 1, padding: 2 },
    cell: { flex: 1, borderRadius: 6, alignItems: "center", justifyContent: "center" },
    date: { color: t.text, fontSize: 12 },
    summary: { color: t.text, textAlign: "center", marginTop: 8, fontSize: 14 },
    detail: { color: t.yellow, textAlign: "center", fontSize: 13 },
    hint: { color: t.muted, textAlign: "center", fontSize: 12 },
});
