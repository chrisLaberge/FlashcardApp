/** Turns a Firebase / Google sign-in error into a sentence for the user. */
export function authErrorMessage(error: unknown): string {
    const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";

    switch (code) {
        case "auth/invalid-email":
            return "That email address doesn't look right.";
        case "auth/missing-password":
        case "auth/weak-password":
            return "Choose a password with at least 6 characters.";
        case "auth/email-already-in-use":
            return "An account with this email already exists. Try signing in instead.";
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
            return "Wrong email or password.";
        case "auth/user-disabled":
            return "This account has been disabled.";
        case "auth/too-many-requests":
            return "Too many attempts. Wait a few minutes and try again.";
        case "auth/requires-recent-login":
            return "For your security, sign out, sign in again, and then delete the account.";
        case "auth/network-request-failed":
            return "No connection. Check your internet and try again.";
        case "auth/account-exists-with-different-credential":
            return "This email is already registered with another sign-in method.";
        case "SIGN_IN_CANCELLED":
            return "";
        case "IN_PROGRESS":
            return "Sign-in is already in progress.";
        case "PLAY_SERVICES_NOT_AVAILABLE":
            return "Google Play services are missing or out of date on this phone.";
    }
    return error instanceof Error && error.message ? error.message : "Something went wrong. Try again.";
}

/** Basic shape check so obvious typos are caught before a network call. */
export function isPlausibleEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
