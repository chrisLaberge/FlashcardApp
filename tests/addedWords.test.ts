import { dayHeading, groupByDay, type AddedWord } from "../src/models/AddedWords";

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const word = (id: number, addedAt: number): AddedWord => ({ id, learningText: `w${id}`, localizedText: `m${id}`, deckName: "Deck", addedAt });

describe("words added, by day", () => {
    test("newest day first, newest word first within a day", () => {
        const days = groupByDay([word(1, at(2026, 11, 2, 9)), word(2, at(2026, 11, 4, 8)), word(3, at(2026, 11, 4, 15)), word(4, at(2026, 11, 2, 20))]);
        expect(days.map((d) => d.day)).toEqual(["2026-11-04", "2026-11-02"]);
        expect(days[0].words.map((w) => w.id)).toEqual([3, 2]);
        expect(days[1].words.map((w) => w.id)).toEqual([4, 1]);
    });

    test("nothing added gives no days", () => {
        expect(groupByDay([])).toEqual([]);
    });

    test("headings: today, yesterday, a date, a date with the year", () => {
        expect(dayHeading("2026-11-04", "2026-11-04")).toBe("Today");
        expect(dayHeading("2026-11-03", "2026-11-04")).toBe("Yesterday");
        expect(dayHeading("2026-10-30", "2026-11-04")).toBe("Fri, Oct 30");
        expect(dayHeading("2025-12-31", "2026-11-04")).toBe("Wed, Dec 31, 2025");
    });
});
