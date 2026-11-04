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
    /** Today as "YYYY-MM-DD". */
    today: string;
};

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const SHADES = ["", "40", "80", "BF", "FF"] as const; // alpha steps appended to the colour
/** A month calendar coloured by how much happened each day, like GitHub's contribution squares. */
export default function ActivityCalendar({ reviewDays, addedDays, today }: Props) {
    const t = useTheme();
    const s = useMemo(() => makeS(t), [t]);
    const [cursor, setCursor] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }));
    const [selected, setSelected] = useState<string>(today);

    const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
    const shown = selected;
    const color = t.green;
    const countOf = (day: string) => reviewDays.get(day)?.reviews ?? 0;

    const monthDays = grid.weeks.flat().flatMap((cell) => (cell ? [cell.day] : []));
    const max = Math.max(0, ...monthDays.map(countOf));

    const atCurrentMonth = cursor.year === Number(today.slice(0, 4)) && cursor.month === Number(today.slice(5, 7)) - 1;
    const move = (delta: number) => {
        setCursor((c) => shiftMonth(c.year, c.month, delta));
        setSelected(today);
    };

    return (
        <View style={s.card}>
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
                            <Pressable key={ci} style={s.cellSlot} onPress={() => setSelected(cell.day)} disabled={isFuture}>
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
                                    {(addedDays.get(cell.day) ?? 0) > 0 && <View style={[s.dot, { backgroundColor: t.blue, borderColor: t.surface }]} />}
                                </View>
                            </Pressable>
                        );
                    })}
                </View>
            ))}

            <View style={s.counts}>
                <View style={s.count}>
                    <Text style={s.countValue}>{reviewDays.get(shown)?.reviews ?? 0}</Text>
                    <Text style={s.countLabel}>Cards reviewed</Text>
                </View>
                <View style={s.count}>
                    <Text style={s.countValue}>{addedDays.get(shown) ?? 0}</Text>
                    <Text style={s.countLabel}>Cards added</Text>
                </View>
            </View>
            <View style={s.legend}>
                <View style={[s.legendDot, { backgroundColor: t.green }]} /><Text style={s.legendText}>reviewed</Text>
                <View style={[s.legendDot, { backgroundColor: t.blue }]} /><Text style={s.legendText}>cards added</Text>
            </View>
        </View>
    );
}

const makeS = (t: Palette) => StyleSheet.create({
    card: { backgroundColor: t.surface, borderRadius: 14, padding: 16, gap: 6 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
    title: { color: t.text, fontSize: 16, fontWeight: "600" },
    arrow: { color: t.text, fontSize: 28, paddingHorizontal: 12, lineHeight: 30 },
    arrowOff: { color: t.surfaceTop },
    row: { flexDirection: "row" },
    weekday: { flex: 1, textAlign: "center", color: t.muted, fontSize: 12, paddingBottom: 2 },
    cellSlot: { flex: 1, aspectRatio: 1, padding: 2 },
    cell: { flex: 1, borderRadius: 6, alignItems: "center", justifyContent: "center" },
    dot: { position: "absolute", top: 2, right: 2, width: 8, height: 8, borderRadius: 4, borderWidth: 1 },
    date: { color: t.text, fontSize: 12 },
    legend: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { color: t.muted, fontSize: 12, marginRight: 8 },
    counts: { flexDirection: "row", marginTop: 10, gap: 10 },
    count: { flex: 1, backgroundColor: t.bg, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
    countValue: { color: t.text, fontSize: 22, fontWeight: "bold" },
    countLabel: { color: t.muted, fontSize: 12 },
});
