/**
 * Study levels: how a card is shown depends on how well you know it.
 *
 * Recognising a word ("pomme" -> apple) is much easier than recalling it ("apple" -> pomme), and
 * hearing it with no text is harder again. So a new card starts as recognition only, gradually
 * mixes in recall, and mature cards also get listening-only reviews.
 *
 * The level is stored separately from the FSRS schedule: FSRS decides WHEN a card is due, the
 * level decides HOW it is shown. A right swipe moves a card up a level, a left swipe halves it.
 */

/** What the front of the card shows. */
export type PromptSide =
    | "learning" // the word in the language you are learning (recognition: "pomme")
    | "localized" // the meaning (recall: "apple")
    | "audio"; // sound only, no text (listening)

export const MAX_LEVEL = 8;

/** Cards that were already mastered when levels were introduced start here (a mixed review). */
export const MASTERED_START_LEVEL = 4;

type Mix = { learning: number; localized: number; audio: number };

/**
 * Probability of each kind of prompt at every level. Each row sums to 1.
 * Level 0 (a card's first showing) is recognition only; from the first right answer recall
 * ("apple" -> pomme) is a real share of reviews and takes over by level 3. Listening appears
 * from level 4.
 */
const MIX: readonly Mix[] = [
    { learning: 1.0, localized: 0.0, audio: 0.0 }, // 0
    { learning: 0.6, localized: 0.4, audio: 0.0 }, // 1
    { learning: 0.4, localized: 0.6, audio: 0.0 }, // 2
    { learning: 0.35, localized: 0.65, audio: 0.0 }, // 3
    { learning: 0.25, localized: 0.65, audio: 0.1 }, // 4
    { learning: 0.2, localized: 0.65, audio: 0.15 }, // 5
    { learning: 0.15, localized: 0.65, audio: 0.2 }, // 6
    { learning: 0.1, localized: 0.65, audio: 0.25 }, // 7
    { learning: 0.05, localized: 0.65, audio: 0.3 }, // 8
];

export function clampLevel(level: number | undefined): number {
    if (level === undefined || !Number.isFinite(level)) return 0;
    return Math.min(MAX_LEVEL, Math.max(0, Math.trunc(level)));
}

/**
 * Right swipe: one level up. Left swipe: the level is halved (rounded down), so a forgotten card
 * falls back towards the easy direction instead of staying on a hard prompt it just failed.
 */
export function nextLevel(level: number | undefined, direction: "left" | "right"): number {
    const current = clampLevel(level);
    return direction === "right" ? clampLevel(current + 1) : Math.floor(current / 2);
}

export function initialLevel(mastered: boolean): number {
    return mastered ? MASTERED_START_LEVEL : 0;
}

/**
 * The prompt probabilities at a level. With listening switched off (it is not available, or you
 * cannot listen right now) the listening share goes back to the learning word ("pomme").
 */
export function promptMix(level: number | undefined, listening: boolean): Mix {
    const mix = MIX[clampLevel(level)];
    if (listening) return mix;
    return { learning: mix.learning + mix.audio, localized: mix.localized, audio: 0 };
}

/** Chooses what to show for one card. `random` returns a number in [0, 1). */
export function pickPromptSide(
    level: number | undefined,
    listening: boolean,
    random: () => number = Math.random,
): PromptSide {
    const mix = promptMix(level, listening);
    const roll = random();
    if (roll < mix.learning) return "learning";
    if (roll < mix.learning + mix.localized) return "localized";
    return "audio";
}

/** The side the answer is checked against (what you type, and what the back of the card leads with). */
export function answerSideFor(prompt: PromptSide): "learning" | "localized" {
    return prompt === "learning" ? "localized" : prompt === "localized" ? "learning" : "localized";
}
