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

export type ThemeId = "gruvbox" | "light" | "dark" | "nord" | "dracula" | "sepia" | "ocean" | "amethyst" | "forest" | "rose" | "sky";

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
        id: "light", name: "Light", isDark: false,
        colors: {
            bg: "#f6f7f9", bgSoft: "#eceef2", surface: "#ffffff", surfaceHigh: "#e3e6ec", surfaceTop: "#cfd4dc",
            subtle: "#6f7887", muted: "#566070", text: "#1c2330", textBright: "#000000", textDim: "#3b4350",
            blue: "#1f6feb", green: "#1a7f37", yellow: "#8a5a00", gold: "#a86f00", red: "#cf222e", redDark: "#a40e26",
            aqua: "#1b7c83", orange: "#bc4c00", success: "#116329",
            paper: "#ffffff", paperBorder: "#d0d7de", paperText: "#1c2330",
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
        id: "ocean", name: "Ocean", isDark: true,
        colors: {
            bg: "#0b1e2d", bgSoft: "#0e2638", surface: "#12304a", surfaceHigh: "#1b4262", surfaceTop: "#2a5a82",
            subtle: "#6f93b0", muted: "#9bbbd4", text: "#e6f1fa", textBright: "#ffffff", textDim: "#c3d9ea",
            blue: "#5eb4ff", green: "#4fdc9a", yellow: "#5fdcf0", gold: "#38bdf8", red: "#ff7a90", redDark: "#d6455e",
            aqua: "#5eead4", orange: "#f08fd0", success: "#1f9d6a",
            paper: "#e6f1fa", paperBorder: "#c3d9ea", paperText: "#0b1e2d",
        },
    },
    {
        id: "amethyst", name: "Amethyst", isDark: true,
        colors: {
            bg: "#17132a", bgSoft: "#1d1836", surface: "#262042", surfaceHigh: "#352d5a", surfaceTop: "#4a3f78",
            subtle: "#8c82b8", muted: "#b0a8d6", text: "#ece8fa", textBright: "#ffffff", textDim: "#cfc9ea",
            blue: "#8fb4ff", green: "#5fe0a8", yellow: "#c4a7ff", gold: "#a78bfa", red: "#ff7a9c", redDark: "#d6456b",
            aqua: "#67e8f9", orange: "#f48fd0", success: "#24a06e",
            paper: "#ece8fa", paperBorder: "#cfc9ea", paperText: "#17132a",
        },
    },
    {
        id: "forest", name: "Forest", isDark: true,
        colors: {
            bg: "#0c1f19", bgSoft: "#10281f", surface: "#16352a", surfaceHigh: "#1f4a3a", surfaceTop: "#2c6350",
            subtle: "#74a898", muted: "#9fcbbb", text: "#e4f5ee", textBright: "#ffffff", textDim: "#bfe0d3",
            blue: "#6fc2ff", green: "#6ee79a", yellow: "#7af0d0", gold: "#34d399", red: "#ff7a8a", redDark: "#d14456",
            aqua: "#5eead4", orange: "#f2a0d6", success: "#1f9d62",
            paper: "#e4f5ee", paperBorder: "#bfe0d3", paperText: "#0c1f19",
        },
    },
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
