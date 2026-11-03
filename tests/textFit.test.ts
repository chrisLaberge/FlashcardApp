import { charWidthEm, fitText, widthEm } from "@/utils/textFit";

const opts = { baseSize: 36, maxWidth: 250, maxLines: 2 };

describe("fitText: words are never split", () => {
    test("a short word keeps the full size on one line", () => {
        expect(fitText("hello", opts)).toEqual({ fontSize: 36, numberOfLines: 1 });
    });

    test("a long single word is shrunk until it fits on ONE line", () => {
        const fit = fitText("Entschuldigung", opts);
        expect(fit.numberOfLines).toBe(1);
        expect(fit.fontSize).toBeLessThan(36);
        expect(widthEm("Entschuldigung") * fit.fontSize).toBeLessThanOrEqual(250);
    });

    test("an extremely long word still ends up one line, at the minimum scale", () => {
        const fit = fitText("Donaudampfschifffahrtsgesellschaftskapitän", opts);
        expect(fit.numberOfLines).toBe(1);
        expect(fit.fontSize).toBe(36 * 0.4);
    });

    test("several words may wrap, but the font is sized so the longest word fits on a line", () => {
        const fit = fitText("Ich möchte Entschuldigung sagen", opts);
        expect(fit.numberOfLines).toBe(2);
        expect(widthEm("Entschuldigung") * fit.fontSize).toBeLessThanOrEqual(250);
    });

    test("several short words keep the full size and may use all lines", () => {
        expect(fitText("good morning my friend", { ...opts, maxLines: 3 })).toEqual({ fontSize: 36, numberOfLines: 3 });
    });

    test("never grows past the base size", () => {
        expect(fitText("a", { ...opts, maxWidth: 1000 }).fontSize).toBe(36);
    });

    test("leading, trailing and repeated spaces do not matter", () => {
        expect(fitText("   hello   ", opts)).toEqual(fitText("hello", opts));
    });

    test("empty text is harmless", () => {
        expect(fitText("", opts)).toEqual({ fontSize: 36, numberOfLines: 2 });
        expect(fitText("   ", opts)).toEqual({ fontSize: 36, numberOfLines: 2 });
    });
});

describe("fitText: languages without spaces", () => {
    test("a short Chinese word is kept on one line", () => {
        const fit = fitText("你好", opts);
        expect(fit).toEqual({ fontSize: 36, numberOfLines: 1 });
    });

    test("a longer Chinese word is shrunk to stay on one line", () => {
        const fit = fitText("图书馆里面", opts); // 5 characters x 36px = 180px: fits
        expect(fit.numberOfLines).toBe(1);
        const longer = fitText("中华人民共和", opts); // 6 x 36 = 216: fits
        expect(longer.fontSize).toBe(36);
    });

    test("a long Chinese sentence without spaces may wrap between characters (there are no word gaps to respect)", () => {
        const fit = fitText("我想去商店买一些新鲜的水果和蔬菜", opts);
        expect(fit).toEqual({ fontSize: 36, numberOfLines: 2 });
    });

    test("Japanese and Korean count as full-width", () => {
        expect(charWidthEm("あ")).toBe(1);
        expect(charWidthEm("한")).toBe(1);
        expect(charWidthEm("中")).toBe(1);
    });
});

describe("charWidthEm", () => {
    test("narrow < normal < capital < wide", () => {
        expect(charWidthEm("i")).toBeLessThan(charWidthEm("a"));
        expect(charWidthEm("a")).toBeLessThan(charWidthEm("A"));
        expect(charWidthEm("A")).toBeLessThan(charWidthEm("W"));
    });

    test("emoji are wide", () => {
        expect(charWidthEm("😀")).toBeGreaterThan(1);
    });
});
