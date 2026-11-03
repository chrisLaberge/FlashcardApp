export type RefreshReason = "focus" | "tick" | "resume";

/** The slice of React Native's AppState the loop needs (kept narrow so tests can fake it). */
export type AppStateLike = {
    currentState: string | null | undefined;
    addEventListener(type: "change", listener: (state: string) => void): { remove(): void };
};

/**
 * Runs `refresh` once straight away ("focus"), then every `intervalMs` ("tick") while the app is
 * in the foreground. When the app goes to the background the timer is stopped; when it comes
 * back the refresh runs immediately ("resume") and the timer restarts. Refreshes never overlap:
 * if one is still running when the next is due, that tick is skipped.
 *
 * Returns a cleanup function that stops the timer and unsubscribes. Call it when the screen
 * loses focus or unmounts.
 */
export function startRefreshLoop(
    refresh: (reason: RefreshReason) => void | Promise<void>,
    intervalMs: number,
    appState: AppStateLike,
): () => void {
    let timer: ReturnType<typeof setInterval> | undefined;
    let running = false;
    let stopped = false;

    const run = async (reason: RefreshReason) => {
        if (running || stopped) return;
        running = true;
        try {
            await refresh(reason);
        } catch (error) {
            console.error("Refresh failed:", error);
        } finally {
            running = false;
        }
    };

    const stopTimer = () => {
        if (timer !== undefined) clearInterval(timer);
        timer = undefined;
    };

    const startTimer = () => {
        stopTimer();
        timer = setInterval(() => void run("tick"), intervalMs);
    };

    void run("focus");
    if (appState.currentState === "active") startTimer();

    const subscription = appState.addEventListener("change", (state) => {
        if (state === "active") {
            void run("resume");
            startTimer();
        } else {
            stopTimer();
        }
    });

    return () => {
        stopped = true;
        stopTimer();
        subscription.remove();
    };
}
