import { keyboardOverlap } from "@/utils/keyboard";

describe("keyboardOverlap", () => {
    test("no keyboard means no inset", () => {
        expect(keyboardOverlap(800, null)).toBe(0);
    });

    test("the keyboard covering the bottom of the screen pads by exactly the covered amount", () => {
        expect(keyboardOverlap(800, 500)).toBe(300);
    });

    test("when the system already resized the window above the keyboard there is nothing to add", () => {
        expect(keyboardOverlap(500, 500)).toBe(0);
        expect(keyboardOverlap(450, 500)).toBe(0);
    });

    test("fractional pixels are rounded", () => {
        expect(keyboardOverlap(800.4, 500)).toBe(300);
        expect(keyboardOverlap(800.6, 500)).toBe(301);
    });
});
