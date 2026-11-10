import { Circle, Ellipse, G, Path, Polygon, Rect } from "react-native-svg";

/** Where the parts of the pet's head are, so every accessory sits in the right place. */
export type Anchors = { cx: number; headTop: number; eyeY: number; neckY: number; r: number };

const GOLD = "#f2c94c";
const GOLD_DARK = "#b8860b";

const hat = (id: string, { cx, headTop: top, r }: Anchors) => {
    const base = top + 5;
    switch (id) {
        case "cap":
            return (
                <G>
                    <Path d={`M${cx - r * 0.95} ${base} Q${cx} ${top - r * 0.95} ${cx + r * 0.95} ${base} Z`} fill="#4f9dff" />
                    <Path d={`M${cx + r * 0.1} ${base} L${cx + r * 1.5} ${base} Q${cx + r * 1.4} ${base - 4} ${cx + r * 0.5} ${base - 4} Z`} fill="#2f6fd0" />
                </G>
            );
        case "beanie":
            return (
                <G>
                    <Path d={`M${cx - r * 0.95} ${base} Q${cx} ${top - r * 1.0} ${cx + r * 0.95} ${base} Z`} fill="#e5484d" />
                    <Rect x={cx - r * 0.98} y={base - 4} width={r * 1.96} height={6} rx={3} fill="#c0353a" />
                    <Circle cx={cx} cy={top - r * 0.55} r={4} fill="#ffffff" />
                </G>
            );
        case "party":
            return (
                <G>
                    <Polygon points={`${cx - r * 0.6},${base} ${cx + r * 0.6},${base} ${cx},${top - r * 1.3}`} fill="#b25cff" />
                    <Path d={`M${cx - r * 0.38} ${base - 9} L${cx + r * 0.38} ${base - 9}`} stroke="#ff4fa3" strokeWidth={3} />
                    <Path d={`M${cx - r * 0.2} ${base - 18} L${cx + r * 0.2} ${base - 18}`} stroke="#5fdcf0" strokeWidth={3} />
                    <Circle cx={cx} cy={top - r * 1.3} r={3.5} fill={GOLD} />
                </G>
            );
        case "tophat":
            return (
                <G>
                    <Rect x={cx - r * 0.62} y={top - r * 1.1} width={r * 1.24} height={r * 1.25 + 4} rx={2} fill="#1b1b22" />
                    <Rect x={cx - r * 0.62} y={base - 8} width={r * 1.24} height={4} fill="#b25cff" />
                    <Ellipse cx={cx} cy={base} rx={r * 1.1} ry={3.4} fill="#1b1b22" />
                </G>
            );
        case "wizard":
            return (
                <G>
                    <Polygon points={`${cx - r * 0.85},${base} ${cx + r * 0.85},${base} ${cx + 4},${top - r * 1.7}`} fill="#4b3fd1" />
                    <Ellipse cx={cx} cy={base} rx={r * 1.15} ry={3.4} fill="#3a30a8" />
                    <Circle cx={cx - 3} cy={top - r * 0.2} r={2} fill={GOLD} />
                    <Circle cx={cx + 5} cy={top - r * 0.9} r={1.6} fill={GOLD} />
                </G>
            );
        case "viking":
            return (
                <G>
                    <Path d={`M${cx - r * 0.95} ${base} Q${cx} ${top - r * 0.9} ${cx + r * 0.95} ${base} Z`} fill="#9aa7b5" />
                    <Path d={`M${cx - r * 0.9} ${base - 4} Q${cx - r * 1.5} ${base - 8} ${cx - r * 1.35} ${top - r * 0.6} Q${cx - r * 1.1} ${base - 12} ${cx - r * 0.55} ${base - 8} Z`} fill="#f4efe0" />
                    <Path d={`M${cx + r * 0.9} ${base - 4} Q${cx + r * 1.5} ${base - 8} ${cx + r * 1.35} ${top - r * 0.6} Q${cx + r * 1.1} ${base - 12} ${cx + r * 0.55} ${base - 8} Z`} fill="#f4efe0" />
                </G>
            );
        case "halo":
            return <Ellipse cx={cx} cy={top - 7} rx={r * 0.8} ry={4} fill="none" stroke={GOLD} strokeWidth={3} />;
        case "crown":
            return (
                <G>
                    <Polygon points={`${cx - r * 0.8},${base} ${cx - r * 0.8},${top - r * 0.55} ${cx - r * 0.4},${top - r * 0.1} ${cx},${top - r * 0.7} ${cx + r * 0.4},${top - r * 0.1} ${cx + r * 0.8},${top - r * 0.55} ${cx + r * 0.8},${base}`} fill={GOLD} stroke={GOLD_DARK} strokeWidth={1} />
                    <Circle cx={cx} cy={base - 5} r={2.4} fill="#ff4fa3" />
                    <Circle cx={cx - r * 0.5} cy={base - 5} r={1.8} fill="#5fdcf0" />
                    <Circle cx={cx + r * 0.5} cy={base - 5} r={1.8} fill="#5fdcf0" />
                </G>
            );
        case "egghat":
            return (
                <G>
                    <Ellipse cx={cx} cy={top - 2} rx={r * 0.7} ry={r * 0.85} fill={GOLD} stroke={GOLD_DARK} strokeWidth={1} />
                    <Path d={`M${cx - r * 0.5} ${top - 2} l4 -5 l4 5 l4 -5 l4 5 l4 -5 l4 5`} stroke={GOLD_DARK} strokeWidth={1.4} fill="none" />
                </G>
            );
        default:
            return null;
    }
};

const heart = (x: number, y: number, s: number) => (
    <Path
        d={`M${x} ${y + s * 0.9} C${x - s * 1.4} ${y - s * 0.2} ${x - s * 0.5} ${y - s * 1.1} ${x} ${y - s * 0.3} C${x + s * 0.5} ${y - s * 1.1} ${x + s * 1.4} ${y - s * 0.2} ${x} ${y + s * 0.9} Z`}
        fill="#ff4fa3"
    />
);

const star = (x: number, y: number, s: number) => {
    const points = Array.from({ length: 10 }, (_, i) => {
        const radius = i % 2 === 0 ? s : s * 0.45;
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        return `${x + radius * Math.cos(angle)},${y + radius * Math.sin(angle)}`;
    }).join(" ");
    return <Polygon points={points} fill={GOLD} stroke={GOLD_DARK} strokeWidth={0.8} />;
};

const glasses = (id: string, { cx, eyeY: y, r }: Anchors) => {
    const dx = r * 0.46;
    const lens = r * 0.34;
    switch (id) {
        case "round":
            return (
                <G stroke="#1b1b22" strokeWidth={1.6} fill="none">
                    <Circle cx={cx - dx} cy={y} r={lens} />
                    <Circle cx={cx + dx} cy={y} r={lens} />
                    <Path d={`M${cx - dx + lens} ${y} L${cx + dx - lens} ${y}`} />
                </G>
            );
        case "shades":
            return (
                <G>
                    <Rect x={cx - dx - lens} y={y - lens * 0.7} width={lens * 2} height={lens * 1.4} rx={3} fill="#1b1b22" />
                    <Rect x={cx + dx - lens} y={y - lens * 0.7} width={lens * 2} height={lens * 1.4} rx={3} fill="#1b1b22" />
                    <Path d={`M${cx - dx + lens} ${y - 1} L${cx + dx - lens} ${y - 1}`} stroke="#1b1b22" strokeWidth={1.6} />
                </G>
            );
        case "hearts":
            return <G>{heart(cx - dx, y, lens * 1.1)}{heart(cx + dx, y, lens * 1.1)}</G>;
        case "monocle":
            return (
                <G fill="none" stroke={GOLD} strokeWidth={1.8}>
                    <Circle cx={cx + dx} cy={y} r={lens * 1.15} />
                    <Path d={`M${cx + dx + lens * 0.8} ${y + lens} q6 8 2 16`} strokeWidth={1} />
                </G>
            );
        case "visor":
            return <Rect x={cx - r * 0.95} y={y - lens * 0.8} width={r * 1.9} height={lens * 1.6} rx={lens * 0.8} fill="#5fdcf0" fillOpacity={0.55} stroke="#2a9fb8" strokeWidth={1.5} />;
        case "stars":
            return <G>{star(cx - dx, y, lens * 1.25)}{star(cx + dx, y, lens * 1.25)}</G>;
        default:
            return null;
    }
};

const scarf = (id: string, { cx, neckY: y, r }: Anchors) => {
    const half = r * 0.95;
    const colors: Record<string, string[]> = {
        scarfred: ["#e5484d"], scarfblue: ["#2f6fd0"], stripes: ["#2f6fd0", "#ffffff"], goldscarf: [GOLD],
        rainbow: ["#ff4f4f", "#ff9f43", "#f5e03a", "#4fdc7a", "#4f9dff", "#b25cff"],
    };
    const list = colors[id];
    if (!list) return null;
    const band = (color: string, offset: number, width: number) => (
        <Path key={`${color}${offset}`} d={`M${cx - half} ${y + offset} Q${cx} ${y + 7 + offset} ${cx + half} ${y + offset}`} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" />
    );
    const width = id === "rainbow" ? 2.2 : 6;
    const bands = id === "rainbow" ? list.map((c, i) => band(c, i * 2 - 4, width)) : list.length === 1 ? [band(list[0], 0, 6)] : [band(list[0], 0, 6), band(list[1], 0, 2.4)];
    return (
        <G>
            {bands}
            <Path d={`M${cx + half * 0.45} ${y + 4} l3 12`} stroke={list[0]} strokeWidth={5} strokeLinecap="round" />
        </G>
    );
};

export const slotOf = (id: string): "hat" | "glasses" | "scarf" | null => {
    if (["cap", "beanie", "party", "tophat", "wizard", "viking", "halo", "crown", "egghat"].includes(id)) return "hat";
    if (["round", "shades", "hearts", "monocle", "visor", "stars"].includes(id)) return "glasses";
    if (["scarfred", "scarfblue", "stripes", "rainbow", "goldscarf"].includes(id)) return "scarf";
    return null;
};

export function renderAccessory(id: string | null | undefined, anchors: Anchors) {
    if (!id) return null;
    const slot = slotOf(id);
    if (slot === "hat") return hat(id, anchors);
    if (slot === "glasses") return glasses(id, anchors);
    if (slot === "scarf") return scarf(id, anchors);
    return null;
}
