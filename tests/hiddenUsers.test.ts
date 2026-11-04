import { addHidden, parseHidden, withoutHidden } from "../src/utils/hiddenUsers";

const row = (uid: string, rank: number, isMe = false) => ({ uid, rank, isMe });

describe("hidden leaderboard users", () => {
    test("reads a saved list and survives missing or broken data", () => {
        expect(parseHidden('["a","b"]')).toEqual(["a", "b"]);
        expect(parseHidden(null)).toEqual([]);
        expect(parseHidden("not json")).toEqual([]);
        expect(parseHidden('{"a":1}')).toEqual([]);
        expect(parseHidden('["a",5,null]')).toEqual(["a"]);
    });

    test("adding the same person twice keeps one entry", () => {
        expect(addHidden(["a"], "b")).toEqual(["a", "b"]);
        expect(addHidden(["a"], "a")).toEqual(["a"]);
    });

    test("hidden people disappear and the ranks close up", () => {
        const rows = [row("a", 1), row("b", 2), row("c", 3)];
        expect(withoutHidden(rows, ["b"])).toEqual([row("a", 1), row("c", 2)]);
    });

    test("you are never hidden from yourself", () => {
        const rows = [row("me", 1, true), row("x", 2)];
        expect(withoutHidden(rows, ["me", "x"])).toEqual([row("me", 1, true)]);
    });
});
