import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { REVIEW_REFRESH_MS } from "../config";
import { startRefreshLoop, type RefreshReason } from "../utils/refreshLoop";

/**
 * Calls `callback` when the screen gains focus, then every `intervalMs` while the screen is
 * focused and the app is in the foreground. Timers are cleaned up on blur and unmount.
 */
export function useFocusedInterval(
    callback: (reason: RefreshReason) => void | Promise<void>,
    intervalMs: number = REVIEW_REFRESH_MS,
) {
    // Always call the newest callback without restarting the timer on every render.
    const latest = useRef(callback);
    useEffect(() => {
        latest.current = callback;
    });

    useFocusEffect(
        useCallback(
            () => startRefreshLoop((reason) => latest.current(reason), intervalMs, AppState),
            [intervalMs],
        ),
    );
}
