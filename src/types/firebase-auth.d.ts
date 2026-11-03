import type { Persistence } from "firebase/auth";

/**
 * Firebase ships this helper only in its React Native build, so the default typings don't list it.
 * Metro picks the React Native build at runtime (the "react-native" field of @firebase/auth).
 */
declare module "firebase/auth" {
    export function getReactNativePersistence(storage: {
        setItem(key: string, value: string): Promise<void>;
        getItem(key: string): Promise<string | null>;
        removeItem(key: string): Promise<void>;
    }): Persistence;
}
