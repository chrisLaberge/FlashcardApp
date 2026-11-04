import { contrast, DEFAULT_THEME_ID, THEMES, themeById, type Palette } from "../src/theme/themes";

describe("themes", () => {
    test("there are at least six, with unique ids, and every colour is a #rrggbb value", () => {
        expect(THEMES.length).toBeGreaterThanOrEqual(6);
        expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
        const keys = Object.keys(THEMES[0].colors).sort();
        for (const theme of THEMES) {
            expect(Object.keys(theme.colors).sort()).toEqual(keys);
            for (const value of Object.values(theme.colors)) expect(value).toMatch(/^#[0-9a-f]{6}$/);
        }
    });

    test("unknown or missing ids fall back to the default", () => {
        expect(themeById(undefined).id).toBe(DEFAULT_THEME_ID);
        expect(themeById("nope").id).toBe(DEFAULT_THEME_ID);
        expect(themeById("nord").id).toBe("nord");
    });

    describe.each(THEMES.map((t) => [t.name, t.colors, t.isDark] as const))("%s stays readable", (_name, c: Palette, isDark) => {
        test("text on the background and on cards", () => {
            expect(contrast(c.text, c.bg)).toBeGreaterThanOrEqual(7);
            expect(contrast(c.text, c.surface)).toBeGreaterThanOrEqual(7);
            expect(contrast(c.muted, c.bg)).toBeGreaterThanOrEqual(4.5);
            expect(contrast(c.muted, c.surface)).toBeGreaterThanOrEqual(4);
        });
        test("accent colours on the background", () => {
            for (const accent of [c.blue, c.green, c.yellow, c.red]) expect(contrast(accent, c.bg)).toBeGreaterThanOrEqual(3);
        });
        test("button labels (drawn in the background colour) on green and gold buttons", () => {
            expect(contrast(c.bg, c.green)).toBeGreaterThanOrEqual(3);
            expect(contrast(c.bg, c.gold)).toBeGreaterThanOrEqual(3);
        });
        test("the flashcard text on the card", () => {
            expect(contrast(c.paperText, c.paper)).toBeGreaterThanOrEqual(7);
        });
        test("dark themes have a dark background and light themes a light one", () => {
            expect(contrast(c.bg, "#000000") > contrast(c.bg, "#ffffff")).toBe(!isDark);
        });
    });
});
