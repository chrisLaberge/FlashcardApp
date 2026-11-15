/**
 * Notices when something is written to the database, so the app knows its saved copy in the cloud is out of date.
 * Writes made while the app is itself loading data from the cloud (or taking its settings snapshot) are not counted.
 */
let count = 0;
let paused = 0;
const listeners = new Set<() => void>();

export function noteChange(): void {
    if (paused > 0) return;
    count += 1;
    listeners.forEach((listener) => listener());
}

export const changeCount = (): number => count;

export function onChange(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export async function untracked<T>(work: () => Promise<T>): Promise<T> {
    paused += 1;
    try {
        return await work();
    } finally {
        paused -= 1;
    }
}
