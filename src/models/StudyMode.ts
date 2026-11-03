/**
 * Study levels: how a card is shown depends on how well you know it.
 *
 * Recognising a word ("pomme" -> apple) is much easier than recalling it ("apple" -> pomme), and
 * hearing it with no text is harder again. So a new card starts as recognition only, gradually
 * mixes in recall, and mature cards also get listening-only reviews.
 *
 * The level is stored separately from the FSRS schedule: FSRS decides WHEN a card is due, the
 * level decides HOW it is shown. A right swipe moves a card up a level, a left swipe down one.
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
 * Levels 0 and 1 are recognition only (the first two right answers); after that recall takes
 * over gradually, and listening appears from level 4.
 */
const MIX: readonly Mix[] = [
    { learning: 1.0, localized: 0.0, audio: 0.0 }, // 0
    { learning: 1.0, localized: 0.0, audio: 0.0 }, // 1
    { learning: 0.7, localized: 0.3, audio: 0.0 }, // 2
    { learning: 0.5, localized: 0.5, audio: 0.0 }, // 3
    { learning: 0.35, localized: 0.55, audio: 0.1 }, // 4
    { learning: 0.25, localized: 0.6, audio: 0.15 }, // 5
    { learning: 0.15, localized: 0.65, audio: 0.2 }, // 6
    { learning: 0.1, localized: 0.65, audio: 0.25 }, // 7
    { learning: 0.05, localized: 0.65, audio: 0.3 }, // 8
];

export function clampLevel(level: number | undefined): number {
    if (level === undefined || !Number.isFinite(level)) return 0;
    return Math.min(MAX_LEVEL, Math.max(0, Math.trunc(level)));
}

/** Right swipe: one level up. Left swipe: one level down. */
export function nextLevel(level: number | undefined, direction: "left" | "right"): number {
    return clampLevel(clampLevel(level) + (direction === "right" ? 1 : -1));
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

/** True if any of the voices speaks the language (e.g. ttsCode "fr-FR" matches a "fr" voice). */
export function hasVoiceFor(voices: readonly { language: string }[], ttsCode: string | undefined): boolean {
    if (!ttsCode) return false;
    if (voices.length === 0) return true; // some devices report no voices although speech works
    const wanted = ttsCode.toLowerCase().replace("_", "-").split("-")[0];
    return voices.some((voice) => voice.language.toLowerCase().replace("_", "-").split("-")[0] === wanted);
}
