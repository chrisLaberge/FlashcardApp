import { countByDay, intensity, monthGrid, shiftMonth } from "../src/models/Calendar";
import { localDay } from "../src/models/Stats";

describe("monthGrid", () => {
    test("weeks start on Monday and are padded to full rows", () => {
        const grid = monthGrid(2026, 10); // November 2026 starts on a Sunday
        expect(grid.title).toBe("November 2026");
        expect(grid.weeks.every((w) => w.length === 7)).toBe(true);
        expect(grid.weeks[0].slice(0, 6).every((c) => c === null)).toBe(true);
        expect(grid.weeks[0][6]).toEqual({ day: "2026-11-01", date: 1 });
        expect(grid.weeks.flat().filter(Boolean)).toHaveLength(30);
        expect(grid.weeks.at(-1)!.at(-1)).toBeNull(); // November 30 is a Monday
    });

    test("a month that starts on Monday has no leading blanks", () => {
        const grid = monthGrid(2026, 5); // June 2026 starts on a Monday
        expect(grid.weeks[0][0]).toEqual({ day: "2026-06-01", date: 1 });
    });

    test("leap years", () => {
        expect(monthGrid(2028, 1).weeks.flat().filter(Boolean)).toHaveLength(29);
        expect(monthGrid(2026, 1).weeks.flat().filter(Boolean)).toHaveLength(28);
    });
});

describe("shiftMonth", () => {
    test("rolls the year both ways", () => {
        expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
        expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
        expect(shiftMonth(2026, 5, 0)).toEqual({ year: 2026, month: 5 });
        expect(shiftMonth(2026, 2, -14)).toEqual({ year: 2025, month: 0 });
    });
});

describe("intensity", () => {
    test("0 for nothing, 1 to 4 relative to the busiest day", () => {
        expect(intensity(0, 10)).toBe(0);
        expect(intensity(1, 100)).toBe(1);
        expect(intensity(25, 100)).toBe(1);
        expect(intensity(26, 100)).toBe(2);
        expect(intensity(75, 100)).toBe(3);
        expect(intensity(100, 100)).toBe(4);
        expect(intensity(5, 0)).toBe(0);
    });
});

describe("countByDay", () => {
    test("groups timestamps by local day", () => {
        const a = new Date(2026, 10, 3, 9).getTime();
        const b = new Date(2026, 10, 3, 23).getTime();
        const c = new Date(2026, 10, 4, 0, 5).getTime();
        const counts = countByDay([a, b, c], localDay);
        expect(counts.get("2026-11-03")).toBe(2);
        expect(counts.get("2026-11-04")).toBe(1);
    });
});
