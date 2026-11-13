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
        case "chef":
            return (
                <G>
                    <Rect x={cx - r * 0.7} y={base - 10} width={r * 1.4} height={10} rx={2} fill="#f4f4f4" stroke="#cfcfcf" strokeWidth={1} />
                    <Circle cx={cx - r * 0.45} cy={base - 14} r={r * 0.5} fill="#ffffff" stroke="#d6d6d6" strokeWidth={1} />
                    <Circle cx={cx + r * 0.45} cy={base - 14} r={r * 0.5} fill="#ffffff" stroke="#d6d6d6" strokeWidth={1} />
                    <Circle cx={cx} cy={base - 20} r={r * 0.6} fill="#ffffff" stroke="#d6d6d6" strokeWidth={1} />
                </G>
            );
        case "ninja":
            return (
                <G>
                    <Path d={`M${cx - r * 1.0} ${base - 2} Q${cx} ${base - 9} ${cx + r * 1.0} ${base - 2} L${cx + r * 1.0} ${base + 5} Q${cx} ${base - 2} ${cx - r * 1.0} ${base + 5} Z`} fill="#1b1b22" />
                    <Rect x={cx - 6} y={base - 4} width={12} height={7} rx={1.5} fill="#c9ccd6" />
                    <Path d={`M${cx + r * 1.0} ${base} l7 -4 M${cx + r * 1.0} ${base + 2} l8 3`} stroke="#1b1b22" strokeWidth={3} strokeLinecap="round" />
                </G>
            );
        case "cowboy":
            return (
                <G>
                    <Path d={`M${cx - r * 0.6} ${base} Q${cx - r * 0.7} ${top - r * 0.9} ${cx - r * 0.2} ${top - r * 0.6} Q${cx} ${top - r * 0.2} ${cx + r * 0.2} ${top - r * 0.6} Q${cx + r * 0.7} ${top - r * 0.9} ${cx + r * 0.6} ${base} Z`} fill="#a9743f" />
                    <Path d={`M${cx - r * 0.62} ${base - 4} L${cx + r * 0.62} ${base - 4}`} stroke="#5d3b1c" strokeWidth={3} />
                    <Path d={`M${cx - r * 1.5} ${base - 4} Q${cx - r * 1.0} ${base + 5} ${cx} ${base + 2} Q${cx + r * 1.0} ${base + 5} ${cx + r * 1.5} ${base - 4} Q${cx + r * 1.0} ${base - 1} ${cx} ${base - 2} Q${cx - r * 1.0} ${base - 1} ${cx - r * 1.5} ${base - 4} Z`} fill="#8c5d2c" />
                </G>
            );
        case "headphones":
            return (
                <G>
                    <Path d={`M${cx - r * 1.0} ${base + 6} Q${cx} ${top - r * 1.05} ${cx + r * 1.0} ${base + 6}`} stroke="#c9ccd6" strokeWidth={4} fill="none" strokeLinecap="round" />
                    <Rect x={cx - r * 1.2} y={base - 1} width={7} height={13} rx={3} fill="#5fdcf0" stroke="#c9ccd6" strokeWidth={1.5} />
                    <Rect x={cx + r * 1.2 - 7} y={base - 1} width={7} height={13} rx={3} fill="#5fdcf0" stroke="#c9ccd6" strokeWidth={1.5} />
                </G>
            );
        case "knight":
            return (
                <G>
                    <Path d={`M${cx - r * 0.95} ${base + 6} L${cx - r * 0.95} ${top - r * 0.1} Q${cx} ${top - r * 1.3} ${cx + r * 0.95} ${top - r * 0.1} L${cx + r * 0.95} ${base + 6} Z`} fill="#b7c0cc" stroke="#7b8594" strokeWidth={1.2} />
                    <Rect x={cx - r * 0.7} y={base - 3} width={r * 1.4} height={4} rx={1.5} fill="#2b2f3d" />
                    <Path d={`M${cx} ${top - r * 1.15} Q${cx + 6} ${top - r * 1.9} ${cx - 2} ${top - r * 2.1}`} stroke="#e5484d" strokeWidth={4} strokeLinecap="round" fill="none" />
                </G>
            );
        case "pirate":
            return (
                <G>
                    <Path d={`M${cx - r * 1.45} ${base + 2} Q${cx - r * 0.6} ${top - r * 1.1} ${cx} ${top - r * 1.0} Q${cx + r * 0.6} ${top - r * 1.1} ${cx + r * 1.45} ${base + 2} Q${cx} ${base - 4} ${cx - r * 1.45} ${base + 2} Z`} fill="#1b1b22" />
                    <Circle cx={cx} cy={top - r * 0.35} r={3.2} fill="#f4efe0" />
                    <Path d={`M${cx - 4.5} ${top - r * 0.05} l9 -5 M${cx - 4.5} ${top - r * 0.65} l9 5`} stroke="#f4efe0" strokeWidth={1.4} />
                </G>
            );
        case "antlers":
            return (
                <G stroke="#8c5d2c" strokeWidth={3} strokeLinecap="round" fill="none">
                    <Path d={`M${cx - r * 0.55} ${base} L${cx - r * 0.9} ${top - r * 1.1} M${cx - r * 0.75} ${top - r * 0.5} L${cx - r * 1.25} ${top - r * 0.75} M${cx - r * 0.85} ${top - r * 0.9} L${cx - r * 0.55} ${top - r * 1.35}`} />
                    <Path d={`M${cx + r * 0.55} ${base} L${cx + r * 0.9} ${top - r * 1.1} M${cx + r * 0.75} ${top - r * 0.5} L${cx + r * 1.25} ${top - r * 0.75} M${cx + r * 0.85} ${top - r * 0.9} L${cx + r * 0.55} ${top - r * 1.35}`} />
                </G>
            );
        case "flames":
            return (
                <G>
                    <Path d={`M${cx - r * 0.8} ${base} Q${cx - r * 1.0} ${top - r * 0.6} ${cx - r * 0.55} ${top - r * 1.1} Q${cx - r * 0.5} ${top - r * 0.5} ${cx - r * 0.25} ${top - r * 0.4} Q${cx - r * 0.2} ${top - r * 1.3} ${cx} ${top - r * 1.7} Q${cx + r * 0.2} ${top - r * 1.3} ${cx + r * 0.25} ${top - r * 0.4} Q${cx + r * 0.5} ${top - r * 0.5} ${cx + r * 0.55} ${top - r * 1.1} Q${cx + r * 1.0} ${top - r * 0.6} ${cx + r * 0.8} ${base} Z`} fill="#ff6a1a" />
                    <Path d={`M${cx - r * 0.45} ${base} Q${cx - r * 0.5} ${top - r * 0.2} ${cx} ${top - r * 0.9} Q${cx + r * 0.5} ${top - r * 0.2} ${cx + r * 0.45} ${base} Z`} fill="#ffd23f" />
                </G>
            );
        case "stonks":
            return (
                <G>
                    <Path d={`M${cx - r * 1.1} ${top + r * 0.2} L${cx - r * 0.45} ${top - r * 0.25} L${cx - r * 0.1} ${top - r * 0.0} L${cx + r * 0.75} ${top - r * 0.95}`} stroke="#1fb36b" strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    <Polygon points={`${cx + r * 1.15},${top - r * 1.25} ${cx + r * 0.35},${top - r * 1.05} ${cx + r * 0.95},${top - r * 0.45}`} fill="#1fb36b" />
                    <Rect x={cx - r * 0.9} y={base - 4} width={r * 1.8} height={4} rx={2} fill="#1b1b22" />
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
        case "3d":
            return (
                <G>
                    <Rect x={cx - dx - lens} y={y - lens * 0.75} width={lens * 2} height={lens * 1.5} rx={1.5} fill="#e5484d" fillOpacity={0.75} stroke="#ffffff" strokeWidth={1.8} />
                    <Rect x={cx + dx - lens} y={y - lens * 0.75} width={lens * 2} height={lens * 1.5} rx={1.5} fill="#2f9fe0" fillOpacity={0.75} stroke="#ffffff" strokeWidth={1.8} />
                </G>
            );
        case "goggles":
            return (
                <G>
                    <Path d={`M${cx - r * 1.0} ${y} L${cx + r * 1.0} ${y}`} stroke="#6b4a2b" strokeWidth={4} />
                    <Circle cx={cx - dx} cy={y} r={lens * 1.15} fill="#9be7ff" fillOpacity={0.5} stroke="#b8860b" strokeWidth={2.6} />
                    <Circle cx={cx + dx} cy={y} r={lens * 1.15} fill="#9be7ff" fillOpacity={0.5} stroke="#b8860b" strokeWidth={2.6} />
                </G>
            );
        case "pixel": {
            const px = lens * 0.85;
            const block = (x0: number, y0: number, w: number, h: number) => <Rect key={`${x0}${y0}`} x={x0} y={y0} width={w} height={h} fill="#1b1b22" stroke="#c9ccd6" strokeWidth={0.8} />;
            return (
                <G>
                    {block(cx - dx - lens, y - px, lens * 2, px)}
                    {block(cx - dx - lens + px, y, lens * 2 - px * 2, px)}
                    {block(cx + dx - lens, y - px, lens * 2, px)}
                    {block(cx + dx - lens + px, y, lens * 2 - px * 2, px)}
                    {block(cx - dx + lens, y - px, dx * 2 - lens * 2, px)}
                </G>
            );
        }
        case "cyber":
            return (
                <G>
                    <Rect x={cx - r * 1.0} y={y - lens * 0.45} width={r * 2.0} height={lens * 0.9} rx={lens * 0.45} fill="#12121a" stroke="#ff2e63" strokeWidth={1.6} />
                    <Rect x={cx - r * 0.82} y={y - 1.2} width={r * 1.64} height={2.4} rx={1.2} fill="#ff2e63" />
                    <Circle cx={cx + r * 0.7} cy={y} r={2.2} fill="#ffffff" />
                </G>
            );
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
    if (id === "bandana") {
        return (
            <G>
                <Path d={`M${cx - half} ${y - 1} L${cx + half} ${y - 1} L${cx} ${y + 16} Z`} fill="#e5484d" />
                <Circle cx={cx - 5} cy={y + 3} r={1.4} fill="#ffffff" />
                <Circle cx={cx + 5} cy={y + 3} r={1.4} fill="#ffffff" />
                <Circle cx={cx} cy={y + 8} r={1.4} fill="#ffffff" />
            </G>
        );
    }
    if (id === "bowtie") {
        return (
            <G>
                <Polygon points={`${cx},${y + 3} ${cx - 11},${y - 3} ${cx - 11},${y + 9}`} fill="#1b1b22" />
                <Polygon points={`${cx},${y + 3} ${cx + 11},${y - 3} ${cx + 11},${y + 9}`} fill="#1b1b22" />
                <Circle cx={cx} cy={y + 3} r={3} fill="#e5484d" />
            </G>
        );
    }
    if (id === "cape") {
        return (
            <G>
                <Path d={`M${cx - half} ${y - 1} Q${cx - half - 12} ${y + 24} ${cx - half - 6} ${y + 34} Q${cx} ${y + 26} ${cx + half + 6} ${y + 34} Q${cx + half + 12} ${y + 24} ${cx + half} ${y - 1} Q${cx} ${y + 6} ${cx - half} ${y - 1} Z`} fill="#c0392b" />
                <Circle cx={cx} cy={y + 4} r={3} fill={GOLD} />
            </G>
        );
    }
    if (id === "neon") {
        return (
            <G fill="none" strokeLinecap="round">
                <Path d={`M${cx - half} ${y} Q${cx} ${y + 7} ${cx + half} ${y}`} stroke="#39ff88" strokeOpacity={0.35} strokeWidth={10} />
                <Path d={`M${cx - half} ${y} Q${cx} ${y + 7} ${cx + half} ${y}`} stroke="#39ff88" strokeWidth={4} />
                <Path d={`M${cx - half} ${y} Q${cx} ${y + 7} ${cx + half} ${y}`} stroke="#eafff3" strokeWidth={1.4} />
            </G>
        );
    }
    if (id === "gigachad") {
        return (
            <G>
                <Path d={`M${cx - half * 1.05} ${y - 4} L${cx - half * 0.95} ${y + 9} L${cx - half * 0.5} ${y + 19} L${cx + half * 0.5} ${y + 19} L${cx + half * 0.95} ${y + 9} L${cx + half * 1.05} ${y - 4} Z`} fill="#d9b08c" stroke="#a67c58" strokeWidth={1.2} strokeLinejoin="round" />
                <Path d={`M${cx} ${y + 11} L${cx} ${y + 19}`} stroke="#a67c58" strokeWidth={1.4} />
                <Path d={`M${cx - half * 0.9} ${y + 5} Q${cx - half * 0.7} ${y + 14} ${cx - half * 0.35} ${y + 17} M${cx + half * 0.9} ${y + 5} Q${cx + half * 0.7} ${y + 14} ${cx + half * 0.35} ${y + 17}`} stroke="#b88d66" strokeWidth={1.2} fill="none" />
                {[[-0.6, 11], [-0.3, 14], [0.3, 14], [0.6, 11], [-0.45, 8], [0.45, 8]].map(([dx, dy]) => (
                    <Circle key={`${dx}${dy}`} cx={cx + half * dx} cy={y + dy} r={0.7} fill="#7d5a3c" />
                ))}
            </G>
        );
    }
    if (id === "cosmos") {
        return (
            <G>
                <Path d={`M${cx - half} ${y} Q${cx} ${y + 7} ${cx + half} ${y}`} stroke="#2b1b6b" strokeWidth={8} fill="none" strokeLinecap="round" />
                <Path d={`M${cx + half * 0.45} ${y + 4} l3 13`} stroke="#2b1b6b" strokeWidth={6} strokeLinecap="round" />
                <Circle cx={cx - half * 0.6} cy={y + 2} r={1.2} fill="#ffffff" />
                <Circle cx={cx - half * 0.1} cy={y + 5} r={1.5} fill="#ff4fa3" />
                <Circle cx={cx + half * 0.35} cy={y + 3} r={1.1} fill="#5fdcf0" />
                <Circle cx={cx + half * 0.75} cy={y + 1} r={1.3} fill="#ffffff" />
                <Circle cx={cx + half * 0.5} cy={y + 12} r={1.2} fill="#ffe58a" />
            </G>
        );
    }
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
    if (["cap", "beanie", "party", "tophat", "wizard", "viking", "halo", "crown", "egghat", "chef", "ninja", "cowboy", "headphones", "knight", "pirate", "antlers", "flames", "stonks"].includes(id)) return "hat";
    if (["round", "shades", "hearts", "monocle", "visor", "stars", "3d", "goggles", "pixel", "cyber"].includes(id)) return "glasses";
    if (["scarfred", "scarfblue", "stripes", "rainbow", "goldscarf", "bandana", "bowtie", "cape", "neon", "cosmos", "gigachad"].includes(id)) return "scarf";
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
