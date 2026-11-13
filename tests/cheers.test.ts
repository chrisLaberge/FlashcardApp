import { currentRun, onCorrectRun, recordAnswer, resetRun, undoAnswer } from "@/services/cheers";

describe("correct runs", () => {
    beforeEach(() => resetRun());

    test("cheers on every 10th right answer in a row", () => {
        const seen: number[] = [];
        const stop = onCorrectRun((n) => seen.push(n));
        for (let i = 0; i < 20; i++) recordAnswer(true);
        stop();
        expect(seen).toEqual([10, 20]);
    });

    test("a wrong answer starts the run again", () => {
        const seen: number[] = [];
        const stop = onCorrectRun((n) => seen.push(n));
        for (let i = 0; i < 9; i++) recordAnswer(true);
        recordAnswer(false);
        for (let i = 0; i < 9; i++) recordAnswer(true);
        stop();
        expect(seen).toEqual([]);
        expect(currentRun()).toBe(9);
    });

    test("undo takes the last answer back, so it cannot count twice", () => {
        const seen: number[] = [];
        const stop = onCorrectRun((n) => seen.push(n));
        for (let i = 0; i < 9; i++) recordAnswer(true);
        recordAnswer(true); // 10: cheer
        undoAnswer();
        expect(currentRun()).toBe(9);
        recordAnswer(true); // 10 again: the same moment, cheers again (the earlier one was undone)
        stop();
        expect(seen).toEqual([10, 10]);
    });

    test("undoing a wrong answer brings the run back", () => {
        for (let i = 0; i < 4; i++) recordAnswer(true);
        recordAnswer(false);
        expect(currentRun()).toBe(0);
        undoAnswer();
        expect(currentRun()).toBe(4);
    });
});
