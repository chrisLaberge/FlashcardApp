import { AppStateLike, RefreshReason, startRefreshLoop } from "@/utils/refreshLoop";

/** A fake AppState we can flip between foreground and background. */
function fakeAppState(initial = "active") {
    const listeners = new Set<(state: string) => void>();
    const appState: AppStateLike & { set(state: string): void; listenerCount(): number } = {
        currentState: initial,
        addEventListener(_type, listener) {
            listeners.add(listener);
            return { remove: () => void listeners.delete(listener) };
        },
        set(state) {
            appState.currentState = state;
            listeners.forEach((listener) => listener(state));
        },
        listenerCount: () => listeners.size,
    };
    return appState;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const flush = () => jest.advanceTimersByTimeAsync(0);

describe("startRefreshLoop", () => {
    test("refreshes immediately, then every interval", async () => {
        const calls: RefreshReason[] = [];
        const stop = startRefreshLoop((reason) => void calls.push(reason), 10_000, fakeAppState());
        await flush();
        expect(calls).toEqual(["focus"]);

        await jest.advanceTimersByTimeAsync(10_000);
        await jest.advanceTimersByTimeAsync(10_000);
        expect(calls).toEqual(["focus", "tick", "tick"]);
        stop();
    });

    test("does not refresh between ticks", async () => {
        const refresh = jest.fn();
        const stop = startRefreshLoop(refresh, 10_000, fakeAppState());
        await jest.advanceTimersByTimeAsync(9_999);
        expect(refresh).toHaveBeenCalledTimes(1); // only the initial one
        stop();
    });

    test("cleanup stops the timer and unsubscribes (screen blurred or unmounted)", async () => {
        const refresh = jest.fn();
        const appState = fakeAppState();
        const stop = startRefreshLoop(refresh, 10_000, appState);
        await flush();
        stop();
        expect(appState.listenerCount()).toBe(0);
        expect(jest.getTimerCount()).toBe(0);

        await jest.advanceTimersByTimeAsync(60_000);
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    test("pauses in the background and refreshes at once on return", async () => {
        const calls: RefreshReason[] = [];
        const appState = fakeAppState();
        const stop = startRefreshLoop((reason) => void calls.push(reason), 10_000, appState);
        await flush();

        appState.set("background");
        expect(jest.getTimerCount()).toBe(0);
        await jest.advanceTimersByTimeAsync(120_000);
        expect(calls).toEqual(["focus"]); // nothing ran while backgrounded

        appState.set("active");
        await flush();
        expect(calls).toEqual(["focus", "resume"]);
        await jest.advanceTimersByTimeAsync(10_000);
        expect(calls).toEqual(["focus", "resume", "tick"]);
        stop();
    });

    test("never runs two refreshes at once: a slow refresh makes the next tick skip", async () => {
        let finishSlow!: () => void;
        let started = 0;
        const stop = startRefreshLoop(
            () => {
                started++;
                return started === 1 ? new Promise<void>((resolve) => (finishSlow = resolve)) : undefined;
            },
            10_000,
            fakeAppState(),
        );
        await jest.advanceTimersByTimeAsync(10_000); // tick while the first is still running
        expect(started).toBe(1);

        finishSlow();
        await jest.advanceTimersByTimeAsync(10_000);
        expect(started).toBe(2);
        stop();
    });

    test("a failing refresh is reported but does not stop the loop", async () => {
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
        const refresh = jest.fn().mockRejectedValueOnce(new Error("db busy")).mockResolvedValue(undefined);
        const stop = startRefreshLoop(refresh, 10_000, fakeAppState());
        await jest.advanceTimersByTimeAsync(10_000);
        expect(refresh).toHaveBeenCalledTimes(2);
        expect(errorSpy).toHaveBeenCalled();
        stop();
        errorSpy.mockRestore();
    });

    test("a refresh that finishes after cleanup does not restart anything", async () => {
        let finish!: () => void;
        const stop = startRefreshLoop(() => new Promise<void>((resolve) => (finish = resolve)), 10_000, fakeAppState());
        stop();
        finish();
        await flush();
        expect(jest.getTimerCount()).toBe(0);
    });

    test("starts without a timer when the app is already in the background", async () => {
        const refresh = jest.fn();
        const appState = fakeAppState("background");
        const stop = startRefreshLoop(refresh, 10_000, appState);
        expect(jest.getTimerCount()).toBe(0);
        await jest.advanceTimersByTimeAsync(30_000);
        expect(refresh).toHaveBeenCalledTimes(1);
        stop();
    });
});
