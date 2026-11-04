/** A month as a calendar grid, plus the colour intensity of a day (like GitHub's contribution squares). */

export type MonthCell = { day: string; date: number } | null;

export type MonthGrid = {
    year: number;
    /** 0 = January. */
    month: number;
    title: string;
    /** Weeks starting on Monday; null cells pad the first and last week. */
    weeks: MonthCell[][];
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad = (value: number) => String(value).padStart(2, "0");

export function monthGrid(year: number, month: number): MonthGrid {
    const first = new Date(year, month, 1);
    const length = new Date(year, month + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // Monday = 0
    const cells: MonthCell[] = Array(lead).fill(null);
    for (let date = 1; date <= length; date++) cells.push({ day: `${year}-${pad(month + 1)}-${pad(date)}`, date });
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: MonthCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return { year, month, title: `${MONTHS[month]} ${year}`, weeks };
}

/** The month `delta` months away; the year rolls over correctly. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
    const index = year * 12 + month + delta;
    return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}

/** 0 for nothing, otherwise 1 to 4 relative to the busiest day shown. */
export function intensity(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
    if (count <= 0 || max <= 0) return 0;
    return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as 1 | 2 | 3 | 4;
}

/** Counts per local day ("YYYY-MM-DD") for a list of timestamps. */
export function countByDay(timestamps: readonly number[], dayOf: (ms: number) => string): Map<string, number> {
    const counts = new Map<string, number>();
    for (const ms of timestamps) {
        const day = dayOf(ms);
        counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return counts;
}
