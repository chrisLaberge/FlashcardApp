import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";

/**
 * Firebase project "stompacard-7a65b". These values identify the project and are not secrets
 * (they ship inside every copy of the app); access is controlled by the backend and Firebase rules.
 */
export const firebaseConfig = {
    apiKey: "AIzaSyBV8UJ0S3iwyIwRkjxvqeVukXyC06FuFcc",
    authDomain: "stompacard-7a65b.firebaseapp.com",
    projectId: "stompacard-7a65b",
    storageBucket: "stompacard-7a65b.firebasestorage.app",
    messagingSenderId: "353195028025",
    appId: "1:353195028025:android:642a4f077e6b5ba7c227e8",
};

/** OAuth "web" client of the same project: Google sign-in needs it to produce an ID token. */
export const GOOGLE_WEB_CLIENT_ID = "353195028025-l0gn1f7tcq9b69jo2bl9d8f6881h9p7k.apps.googleusercontent.com";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createAuth() {
    try {
        // Keeps the user signed in between launches.
        return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    } catch {
        // Already initialised (fast refresh in development).
        return getAuth(app);
    }
}

export const auth = createAuth();
