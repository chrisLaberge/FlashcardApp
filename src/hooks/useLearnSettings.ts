import { useCallback, useEffect, useRef, useState } from "react";
import {
    DEFAULT_LEARN_SETTINGS,
    loadLearnSettings,
    saveLearnSettings,
    type LearnSettings,
} from "../settings";

/** Loads the learn settings once and saves every change. `loaded` is false until the stored values are in. */
export function useLearnSettings() {
    const [settings, setSettings] = useState<LearnSettings>(DEFAULT_LEARN_SETTINGS);
    const [loaded, setLoaded] = useState(false);
    const latest = useRef(settings);

    useEffect(() => {
        let cancelled = false;
        loadLearnSettings().then((stored) => {
            if (cancelled) return;
            latest.current = stored;
            setSettings(stored);
            setLoaded(true);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const update = useCallback((patch: Partial<LearnSettings>) => {
        const next = { ...latest.current, ...patch };
        latest.current = next;
        setSettings(next);
        void saveLearnSettings(next);
    }, []);

    return { settings, loaded, update };
}
