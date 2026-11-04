import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_THEME_ID, themeById, type Palette, type Theme, type ThemeId } from "./themes";

const KEY = "app-theme";

type ThemeContextValue = { theme: Theme; setThemeId: (id: ThemeId) => void };

const ThemeContext = createContext<ThemeContextValue>({ theme: themeById(DEFAULT_THEME_ID), setThemeId: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [id, setId] = useState<ThemeId>(DEFAULT_THEME_ID);

    useEffect(() => {
        AsyncStorage.getItem(KEY)
            .then((saved) => setId(themeById(saved).id))
            .catch(() => undefined);
    }, []);

    const setThemeId = useCallback((next: ThemeId) => {
        setId(next);
        AsyncStorage.setItem(KEY, next).catch(() => undefined);
    }, []);

    const value = useMemo(() => ({ theme: themeById(id), setThemeId }), [id, setThemeId]);
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useThemeControls = () => useContext(ThemeContext);

/** The active colours. Screens build their styles from this so a theme change repaints everything. */
export const useTheme = (): Palette => useContext(ThemeContext).theme.colors;
