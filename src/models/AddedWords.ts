import { localDay } from "./Stats";

export type AddedWord = { id: number; learningText: string; localizedText: string; deckName: string; addedAt: number };
export type AddedDay = { day: string; words: AddedWord[] };

/** Groups words by the local day they were added; newest day first, and newest word first inside a day. */
export function groupByDay(words: AddedWord[]): AddedDay[] {
    const sorted = [...words].sort((a, b) => b.addedAt - a.addedAt || b.id - a.id);
    const days: AddedDay[] = [];
    for (const word of sorted) {
        const day = localDay(word.addedAt);
        const last = days[days.length - 1];
        if (last && last.day === day) last.words.push(word);
        else days.push({ day, words: [word] });
    }
    return days;
}

/** "Today", "Yesterday", or "Mon, Nov 2" (with the year when it is not this year). */
export function dayHeading(day: string, today: string): string {
    if (day === today) return "Today";
    const [y, m, d] = day.split("-").map(Number);
    const [ty, tm, td] = today.split("-").map(Number);
    if (Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86_400_000) === 1) return "Yesterday";
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(y !== ty ? { year: "numeric" } : {}) });
}
