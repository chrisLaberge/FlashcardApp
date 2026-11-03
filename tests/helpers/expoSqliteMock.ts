/**
 * Test double for `expo-sqlite`, backed by Node's built-in `node:sqlite`.
 *
 * It implements only the calls database.ts uses (openDatabaseAsync, execAsync,
 * runAsync, getAllAsync, getFirstAsync) so the REAL database.ts runs unmodified
 * against a real SQLite engine. jest.config.js maps `expo-sqlite` to this file,
 * so no test can ever open the app's actual `flashcards.db`.
 *
 * State lives on globalThis because tests call jest.resetModules() to simulate an
 * app restart, which would otherwise reset this module's variables.
 */
import { DatabaseSync } from "node:sqlite";

type SqlParams = unknown[];

type MockState = {
    /** File to open for the next openDatabaseAsync call; null means in-memory. */
    nextFile: string | null;
    opened: DatabaseSync[];
    openCalls: number;
    failNextOpen: boolean;
};

const g = globalThis as typeof globalThis & { __sqliteMock?: MockState };
const state: MockState = (g.__sqliteMock ??= { nextFile: null, opened: [], openCalls: 0, failNextOpen: false });

function bindable(params: SqlParams): never[] {
    // expo-sqlite accepts either variadic params or a single array.
    const list = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    return list as never[];
}

class MockSQLiteDatabase {
    constructor(readonly raw: DatabaseSync) {}

    async execAsync(sql: string): Promise<void> {
        this.raw.exec(sql);
    }

    async runAsync(sql: string, ...params: SqlParams) {
        const result = this.raw.prepare(sql).run(...bindable(params));
        return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    }

    async getAllAsync<T>(sql: string, ...params: SqlParams): Promise<T[]> {
        return this.raw.prepare(sql).all(...bindable(params)).map((row) => ({ ...row })) as T[];
    }

    async getFirstAsync<T>(sql: string, ...params: SqlParams): Promise<T | null> {
        const row = this.raw.prepare(sql).get(...bindable(params));
        return row ? ({ ...row } as T) : null;
    }

    /** Like expo-sqlite: commits if the task resolves, rolls back (and rethrows) if it throws. */
    async withTransactionAsync(task: () => Promise<void>): Promise<void> {
        this.raw.exec("BEGIN");
        try {
            await task();
            this.raw.exec("COMMIT");
        } catch (error) {
            this.raw.exec("ROLLBACK");
            throw error;
        }
    }

    async closeAsync(): Promise<void> {
        this.raw.close();
    }
}

export async function openDatabaseAsync(_name: string) {
    state.openCalls += 1;
    // Yield once, like the real native call, so concurrent callers can interleave.
    await Promise.resolve();
    if (state.failNextOpen) {
        state.failNextOpen = false;
        throw new Error("simulated open failure");
    }
    const raw = new DatabaseSync(state.nextFile ?? ":memory:");
    state.opened.push(raw);
    return new MockSQLiteDatabase(raw);
}

/* ---- Test controls (used by tests/helpers/testDb.ts) ---- */

export function __useFile(file: string | null) {
    state.nextFile = file;
}

export function __failNextOpen() {
    state.failNextOpen = true;
}

export function __openCalls() {
    return state.openCalls;
}

export function __lastRawDatabase(): DatabaseSync {
    const last = state.opened[state.opened.length - 1];
    if (!last) throw new Error("No database has been opened yet");
    return last;
}

export function __reset() {
    for (const raw of state.opened) {
        try {
            raw.close();
        } catch {
            // already closed
        }
    }
    state.opened = [];
    state.openCalls = 0;
    state.nextFile = null;
    state.failNextOpen = false;
}
