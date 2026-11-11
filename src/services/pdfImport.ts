/**
 * The list of PDFs being prepared (pages read, words counted). It lives outside any screen, so leaving
 * the Library does not stop the work; screens only watch it.
 */
export type ImportPhase = "waiting" | "reading" | "counting" | "failed";
export type ImportJob = { id: number; phase: ImportPhase; done: number; total: number; error?: string };

let jobs: readonly ImportJob[] = [];
const listeners = new Set<() => void>();

const set = (next: readonly ImportJob[]) => {
    jobs = next;
    listeners.forEach((listener) => listener());
};

export const getJobs = (): readonly ImportJob[] => jobs;

export function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Puts a book in line. A book already in line is left alone, except a failed one, which starts again. */
export function enqueue(id: number): void {
    const existing = jobs.find((j) => j.id === id);
    if (existing && existing.phase !== "failed") return;
    set([...jobs.filter((j) => j.id !== id), { id, phase: "waiting", done: 0, total: 0 }]);
}

export function update(id: number, patch: Partial<Omit<ImportJob, "id">>): void {
    if (!jobs.some((j) => j.id === id)) return;
    set(jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)));
}

export const fail = (id: number, error: string): void => update(id, { phase: "failed", error });

/** Takes a book out of the list (finished, or deleted). */
export function drop(id: number): void {
    if (jobs.some((j) => j.id === id)) set(jobs.filter((j) => j.id !== id));
}

/** The job being worked on: the first one that has not failed. */
export const currentJob = (): ImportJob | undefined => jobs.find((j) => j.phase !== "failed");

/** 0 to 1 across both steps: reading the pages is most of the work, counting the words the rest. */
export function fractionOf(job: ImportJob): number {
    const part = job.total > 0 ? Math.min(1, job.done / job.total) : 0;
    if (job.phase === "reading") return part * 0.85;
    if (job.phase === "counting") return 0.85 + part * 0.15;
    return 0;
}

export function resetJobs(): void {
    set([]);
}
