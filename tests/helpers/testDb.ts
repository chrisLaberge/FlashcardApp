import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import * as sqliteMock from "./expoSqliteMock";

export type DatabaseModule = typeof import("../../src/database/database");

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Fixed "now" so scheduling tests are deterministic. */
export const T0 = Date.UTC(2026, 10, 3, 12, 0, 0);

/**
 * Loads a brand-new copy of database.ts (module state reset), simulating an app start.
 * Pass `file` to reopen the same on-disk database after a "restart"; omit for in-memory.
 */
export function startApp(file?: string): DatabaseModule {
    jest.resetModules();
    sqliteMock.__useFile(file ?? null);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../../src/database/database") as DatabaseModule;
}

/** Closes every open connection (call between tests). */
export function stopApp() {
    sqliteMock.__reset();
}

/** The Node SQLite handle behind the most recently opened database, for raw seeding/inspection. */
export function rawDb(): DatabaseSync {
    return sqliteMock.__lastRawDatabase();
}

export function openCalls(): number {
    return sqliteMock.__openCalls();
}

/** Freezes Date (only Date: promises and timers keep working). */
export function freezeTime(ms: number = T0) {
    jest.useFakeTimers({
        now: ms,
        doNotFake: [
            "nextTick",
            "setImmediate",
            "clearImmediate",
            "setTimeout",
            "clearTimeout",
            "setInterval",
            "clearInterval",
            "queueMicrotask",
            "performance",
            "hrtime",
            "requestAnimationFrame",
            "cancelAnimationFrame",
            "requestIdleCallback",
            "cancelIdleCallback",
        ],
    });
}

export function advanceTime(ms: number) {
    jest.setSystemTime(Date.now() + ms);
}

export function unfreezeTime() {
    jest.useRealTimers();
}

/** A throwaway directory for file-backed databases. */
export function makeTempDir() {
    const dir = mkdtempSync(join(tmpdir(), "flashcards-test-"));
    return { dir, path: (name: string) => join(dir, name), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Inserts a card + progress row directly, bypassing the app API (for precise states). */
export function seedCard(
    db: DatabaseSync,
    deckId: number,
    id: number,
    progress: {
        review_count?: number;
        next_review_at?: number | null;
        mastered?: number;
        fsrs_card?: string | null;
        last_review_at?: number | null;
    } = {},
) {
    db.prepare(
        "INSERT INTO cards (id, deck_id, learning_text, localized_text) VALUES (?, ?, ?, ?)",
    ).run(id, deckId, `front ${id}`, `back ${id}`);
    db.prepare(
        `INSERT OR REPLACE INTO card_progress (card_id, review_count, next_review_at, mastered, fsrs_card, last_review_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
        id,
        progress.review_count ?? 0,
        progress.next_review_at ?? null,
        progress.mastered ?? 0,
        progress.fsrs_card ?? null,
        progress.last_review_at ?? null,
    );
}
