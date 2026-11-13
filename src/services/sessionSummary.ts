import { getDecks, getReviewLog } from "../database/database";
import { resetRun } from "./cheers";
import { latestSession, SESSION_GAP_MS, type StudySession } from "../models/Stats";

/** The study session in progress, from the review log; null if there is none right now. */
export async function currentSession(nowMs = Date.now()): Promise<StudySession | null> {
    return latestSession(await getReviewLog(nowMs - 12 * 60 * 60 * 1000), nowMs, SESSION_GAP_MS);
}

export type SessionSummary = { session: StudySession; deckName: string | null; dueInDeck: number | null; dueTotal: number };

/** What the "you left the study screen" popup shows, or null when there was nothing to report. */
export async function buildSummary(deckId: number | null): Promise<SessionSummary | null> {
    const session = await currentSession();
    if (!session) return null;
    const decks = await getDecks();
    const deck = deckId === null ? undefined : decks.find((d) => d.id === deckId);
    return {
        session,
        deckName: deck?.name ?? null,
        dueInDeck: deck ? deck.due_count : null,
        dueTotal: decks.reduce((sum, d) => sum + d.due_count, 0),
    };
}

type Listener = (deckId: number | null) => void;
const listeners = new Set<Listener>();

export function onStudyScreenLeft(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Called by the study screen when it is closed (not when another screen opens on top of it). */
export function announceStudyScreenLeft(deckId: number | null): void {
    resetRun(); // a run of right answers belongs to one sitting
    for (const listener of listeners) listener(deckId);
}
