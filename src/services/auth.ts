import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import {
    createUserWithEmailAndPassword,
    deleteUser,
    GoogleAuthProvider,
    sendPasswordResetEmail,
    signInWithCredential,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
} from "firebase/auth";
import { auth, GOOGLE_WEB_CLIENT_ID } from "./firebase";
import { deleteMyData } from "./social";

let googleConfigured = false;

function configureGoogle() {
    if (googleConfigured) return;
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    googleConfigured = true;
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
    configureGoogle();
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
        configureGoogle();
        await GoogleSignin.signOut();
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

/**
 * Deletes the online profile, stats and friendships, then the sign-in account itself.
 * Firebase only allows deleting an account shortly after signing in; otherwise it throws
 * "auth/requires-recent-login" and the caller should ask the user to sign in again first.
 * Decks and progress on this phone are not touched.
 */
export async function deleteAccount() {
    const user = auth.currentUser;
    if (!user) return;
    await deleteMyData();
    await deleteUser(user);
}
