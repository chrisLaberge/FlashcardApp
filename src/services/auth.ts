import {
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    sendPasswordResetEmail,
    signInWithCredential,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
} from "firebase/auth";
import { auth, GOOGLE_WEB_CLIENT_ID } from "./firebase";

type GoogleModule = typeof import("@react-native-google-signin/google-signin");

let googleModule: GoogleModule | null | undefined;
let googleConfigured = false;

/**
 * Google sign-in is a native module. Builds made before it was added (and Expo Go) do not contain
 * it, and importing it there crashes at start-up, so it is loaded only when first needed.
 * Returns null when this build does not have it.
 */
async function loadGoogle(): Promise<GoogleModule | null> {
    if (googleModule !== undefined) return googleModule;
    try {
        googleModule = await import("@react-native-google-signin/google-signin");
    } catch {
        googleModule = null;
    }
    return googleModule;
}

async function configuredGoogle(): Promise<GoogleModule | null> {
    const google = await loadGoogle();
    if (google && !googleConfigured) {
        google.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
        googleConfigured = true;
    }
    return google;
}

export async function signUpWithEmail(email: string, password: string) {
    await createUserWithEmailAndPassword(auth, email.trim(), password);
}

export async function signInWithEmail(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email.trim());
}

/** Returns false when the user closed the Google dialog. */
export async function signInWithGoogle(): Promise<boolean> {
    const google = await configuredGoogle();
    if (!google) {
        throw new Error("Google sign-in isn't available in this version of the app. Use email, or install the latest build.");
    }
    const { GoogleSignin, statusCodes } = google;
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    try {
        const response = await GoogleSignin.signIn();
        if (response.type !== "success" || !response.data.idToken) return false;
        await signInWithCredential(auth, GoogleAuthProvider.credential(response.data.idToken));
        return true;
    } catch (error) {
        if (typeof error === "object" && error !== null && (error as { code?: unknown }).code === statusCodes.SIGN_IN_CANCELLED) {
            return false;
        }
        throw error;
    }
}

export async function signOut() {
    await firebaseSignOut(auth);
    try {
        await (await configuredGoogle())?.GoogleSignin.signOut();
    } catch {
        // Not signed in with Google; nothing to do.
    }
}

/**
 * Headers for calls to our backend: the signed-in user's token when there is one.
 * Signed-out calls still work while the backend runs in "log" mode.
 */
export async function authHeaders(): Promise<Record<string, string>> {
    const user = auth.currentUser;
    if (!user) return {};
    try {
        return { Authorization: `Bearer ${await user.getIdToken()}` };
    } catch {
        return {};
    }
}
