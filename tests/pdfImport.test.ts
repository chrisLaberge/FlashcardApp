import { currentJob, drop, enqueue, fail, fractionOf, getJobs, resetJobs, subscribe, update } from "../src/services/pdfImport";

beforeEach(() => resetJobs());

describe("PDF preparation list", () => {
    test("books wait in line and the first one that has not failed is current", () => {
        enqueue(1);
        enqueue(2);
        expect(currentJob()?.id).toBe(1);
        fail(1, "bad file");
        expect(currentJob()?.id).toBe(2);
        expect(getJobs().find((j) => j.id === 1)).toMatchObject({ phase: "failed", error: "bad file" });
    });

    test("adding a book twice does not duplicate it; a failed one starts again", () => {
        enqueue(1);
        enqueue(1);
        expect(getJobs()).toHaveLength(1);
        fail(1, "x");
        enqueue(1);
        expect(getJobs()).toEqual([{ id: 1, phase: "waiting", done: 0, total: 0 }]);
    });

    test("progress covers both steps, reading first then counting", () => {
        enqueue(1);
        update(1, { phase: "reading", done: 50, total: 100 });
        expect(fractionOf(getJobs()[0])).toBeCloseTo(0.425);
        update(1, { phase: "counting", done: 0, total: 10 });
        expect(fractionOf(getJobs()[0])).toBeCloseTo(0.85);
        update(1, { done: 10 });
        expect(fractionOf(getJobs()[0])).toBeCloseTo(1);
        update(1, { phase: "reading", done: 5, total: 0 });
        expect(fractionOf(getJobs()[0])).toBe(0);
    });

    test("screens are told about changes, dropping removes the book, unknown ids are ignored", () => {
        let calls = 0;
        const stop = subscribe(() => { calls++; });
        enqueue(1);
        update(1, { done: 3 });
        update(99, { done: 3 });
        drop(1);
        drop(1);
        stop();
        enqueue(2);
        expect(calls).toBe(3);
        expect(getJobs().map((j) => j.id)).toEqual([2]);
    });
});
