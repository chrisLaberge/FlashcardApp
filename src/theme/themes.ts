/**
 * Colour themes. Every screen reads its colours from the active palette, so adding a theme is
 * just adding an entry here (tests/themes.test.ts checks that text stays readable).
 */

export type Palette = {
    /** Screen background. */
    bg: string;
    /** Slightly different from bg: bar tracks, wells. */
    bgSoft: string;
    /** Cards and rows sitting on the background. */
    surface: string;
    surfaceHigh: string;
    surfaceTop: string;
    /** Placeholders and faint lines. */
    subtle: string;
    muted: string;
    text: string;
    textBright: string;
    textDim: string;
    blue: string;
    green: string;
    yellow: string;
    gold: string;
    red: string;
    redDark: string;
    aqua: string;
    orange: string;
    success: string;
    /** The flashcard itself. */
    paper: string;
    paperBorder: string;
    paperText: string;
};

export type ThemeId = "gruvbox" | "dark" | "nord" | "dracula" | "sepia" | "rose" | "sky";

export type Theme = { id: ThemeId; name: string; isDark: boolean; colors: Palette };

export const THEMES: readonly Theme[] = [
    {
        id: "gruvbox", name: "Gruvbox", isDark: true,
        colors: {
            bg: "#282828", bgSoft: "#32302f", surface: "#3c3836", surfaceHigh: "#504945", surfaceTop: "#665c54",
            subtle: "#7c6f64", muted: "#a89984", text: "#ebdbb2", textBright: "#fbf1c7", textDim: "#d5c4a1",
            blue: "#83a598", green: "#b8bb26", yellow: "#fabd2f", gold: "#d79921", red: "#fb4934", redDark: "#cc241d",
            aqua: "#8ec07c", orange: "#fe8019", success: "#136d18",
            paper: "#ebdbb2", paperBorder: "#d5c4a1", paperText: "#282828",
        },
    },
    {
        id: "dark", name: "Dark", isDark: true,
        colors: {
            bg: "#0d0d0f", bgSoft: "#141417", surface: "#1b1b20", surfaceHigh: "#2a2a31", surfaceTop: "#3a3a43",
            subtle: "#7a7a88", muted: "#9a9aa8", text: "#ececf1", textBright: "#ffffff", textDim: "#c9c9d3",
            blue: "#6cb6ff", green: "#57d364", yellow: "#f5c542", gold: "#e0a21b", red: "#ff6b6b", redDark: "#d03b3b",
            aqua: "#4fd1c5", orange: "#ff9f43", success: "#2e9e44",
            paper: "#ececf1", paperBorder: "#c9c9d3", paperText: "#0d0d0f",
        },
    },
    {
        id: "nord", name: "Nord", isDark: true,
        colors: {
            bg: "#2e3440", bgSoft: "#292e39", surface: "#3b4252", surfaceHigh: "#434c5e", surfaceTop: "#4c566a",
            subtle: "#7b88a1", muted: "#a3adc0", text: "#eceff4", textBright: "#ffffff", textDim: "#d8dee9",
            blue: "#88c0d0", green: "#a3be8c", yellow: "#ebcb8b", gold: "#d4a85a", red: "#d9737d", redDark: "#bf616a",
            aqua: "#8fbcbb", orange: "#d08770", success: "#6f9a58",
            paper: "#eceff4", paperBorder: "#d8dee9", paperText: "#2e3440",
        },
    },
    {
        id: "dracula", name: "Dracula", isDark: true,
        colors: {
            bg: "#282a36", bgSoft: "#21222c", surface: "#343746", surfaceHigh: "#44475a", surfaceTop: "#585b73",
            subtle: "#7b86b8", muted: "#a9afd1", text: "#f8f8f2", textBright: "#ffffff", textDim: "#d6d6e0",
            blue: "#bd93f9", green: "#50fa7b", yellow: "#f1fa8c", gold: "#ffb86c", red: "#ff5555", redDark: "#d63c3c",
            aqua: "#69e0c8", orange: "#ffb86c", success: "#2fbf5e",
            paper: "#f8f8f2", paperBorder: "#d6d6e0", paperText: "#282a36",
        },
    },
    {
        id: "sepia", name: "Sepia", isDark: false,
        colors: {
            bg: "#f4ecd8", bgSoft: "#ebe1c8", surface: "#fbf5e6", surfaceHigh: "#e3d7b9", surfaceTop: "#cdbf9c",
            subtle: "#7d6e52", muted: "#6b5d45", text: "#3b3226", textBright: "#1f1a12", textDim: "#54483a",
            blue: "#2f6f8f", green: "#4f7a17", yellow: "#8a5d00", gold: "#9a6a05", red: "#b3362a", redDark: "#8f2a20",
            aqua: "#3d7d6b", orange: "#b5541c", success: "#3f6b1c",
            paper: "#fbf5e6", paperBorder: "#d8caa6", paperText: "#3b3226",
        },
    },
    // The next five have no brown, orange or yellow anywhere. The palette still has yellow / gold /
    // orange slots (highlights, buttons, streak colours), so those slots hold cyan, violet and pink.
    {
        id: "rose", name: "Rose", isDark: false,
        colors: {
            bg: "#fdf1f6", bgSoft: "#f8e4ed", surface: "#ffffff", surfaceHigh: "#f3d6e3", surfaceTop: "#e6b9cf",
            subtle: "#8a5f74", muted: "#6e4659", text: "#2a1520", textBright: "#000000", textDim: "#4a2a39",
            blue: "#2563eb", green: "#15803d", yellow: "#be185d", gold: "#9d174d", red: "#c81e1e", redDark: "#991b1b",
            aqua: "#0f766e", orange: "#a21caf", success: "#116329",
            paper: "#ffffff", paperBorder: "#ebc8d9", paperText: "#2a1520",
        },
    },
    {
        id: "sky", name: "Sky", isDark: false,
        colors: {
            bg: "#eef6fd", bgSoft: "#e0eefa", surface: "#ffffff", surfaceHigh: "#d3e5f6", surfaceTop: "#b7d2ea",
            subtle: "#587794", muted: "#42607c", text: "#10243a", textBright: "#000000", textDim: "#2c425a",
            blue: "#1d4ed8", green: "#15803d", yellow: "#0369a1", gold: "#0e7490", red: "#c81e1e", redDark: "#991b1b",
            aqua: "#0f766e", orange: "#6d28d9", success: "#116329",
            paper: "#ffffff", paperBorder: "#c4daee", paperText: "#10243a",
        },
    },
];

export const DEFAULT_THEME_ID: ThemeId = "gruvbox";

export function themeById(id: string | null | undefined): Theme {
    return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function contrast(a: string, b: string): number {
    const luminance = (hex: string) => {
        const [r, g, bl] = [1, 3, 5].map((i) => {
            const v = parseInt(hex.slice(i, i + 2), 16) / 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}
