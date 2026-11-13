/** Small celebrations while studying: so far, a run of correct answers. */

export const CHEER_EVERY = 10;

type Listener = (run: number) => void;
const listeners = new Set<Listener>();
let run = 0;
const history: boolean[] = [];

/** Calls `listener` every 10th correct answer in a row. Returns the way to stop listening. */
export function onCorrectRun(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Counts an answer. A wrong answer starts the run again. */
export function recordAnswer(correct: boolean): void {
    history.push(correct);
    if (history.length > 200) history.shift();
    run = correct ? run + 1 : 0;
    if (correct && run % CHEER_EVERY === 0) listeners.forEach((listener) => listener(run));
}

/** Takes the last answer back (the Undo button), so undoing and answering again cannot count twice. */
export function undoAnswer(): void {
    const last = history.pop();
    if (last === undefined) return;
    if (last) run = Math.max(0, run - 1);
    else {
        // Rebuild the run from what is left of the history.
        run = 0;
        for (let i = history.length - 1; i >= 0 && history[i]; i--) run++;
    }
}

export function currentRun(): number {
    return run;
}

export function resetRun(): void {
    run = 0;
    history.length = 0;
}
