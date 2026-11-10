/**
 * The pet: it hatches from an egg and grows with your player level, up to level 100.
 * Everything here is worked out from the level, so it never needs saving.
 */

export const MAX_PET_LEVEL = 100;
export const PET_NAME_MAX = 16;
export const DEFAULT_PET_NAME = "Stompa";

export type PetStageId = "egg" | "hatchling" | "chick" | "youngster" | "adult" | "golden";
export type PetStage = { id: PetStageId; name: string; from: number };

export const PET_STAGES: readonly PetStage[] = [
    { id: "egg", name: "Egg", from: 1 },
    { id: "hatchling", name: "Hatchling", from: 10 },
    { id: "chick", name: "Chick", from: 25 },
    { id: "youngster", name: "Youngster", from: 50 },
    { id: "adult", name: "Pukeko", from: 75 },
    { id: "golden", name: "Golden Pukeko", from: MAX_PET_LEVEL },
];

export const petLevel = (playerLevel: number): number => Math.min(MAX_PET_LEVEL, Math.max(1, Math.floor(playerLevel)));

export function petStage(level: number): PetStage {
    const l = petLevel(level);
    let stage = PET_STAGES[0];
    for (const candidate of PET_STAGES) if (l >= candidate.from) stage = candidate;
    return stage;
}

export const isMaxed = (level: number): boolean => petLevel(level) >= MAX_PET_LEVEL;

/** How far through its current stage the pet is, 0 to 1 (1 when maxed). */
export function stageProgress(level: number): number {
    const l = petLevel(level);
    const index = PET_STAGES.indexOf(petStage(l));
    const next = PET_STAGES[index + 1];
    if (!next) return 1;
    return (l - PET_STAGES[index].from) / (next.from - PET_STAGES[index].from);
}

/** A name kept to what the server accepts: letters, digits, spaces, ' and -, 1 to 16 characters. */
export function cleanPetName(input: string): string {
    const kept = input.replace(/[^\p{L}\p{N} '\-]/gu, "").replace(/\s+/g, " ").trim().slice(0, PET_NAME_MAX);
    return /^[\p{L}\p{N}]/u.test(kept) ? kept : "";
}
