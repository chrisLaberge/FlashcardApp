import { deleteUser } from "firebase/auth";
import { auth } from "./firebase";
import { deleteMyData } from "./social";

/**
 * Deletes the online profile, stats and friendships, then the sign-in account itself.
 * Firebase only allows deleting an account shortly after signing in; otherwise it throws
 * "auth/requires-recent-login" and the caller should ask the user to sign in again first.
 * Decks and progress on this phone are not touched.
 *
 * Lives apart from auth.ts because social.ts uses auth.ts: putting this there made them import each other.
 */
export async function deleteAccount() {
    const user = auth.currentUser;
    if (!user) return;
    await deleteMyData();
    await deleteUser(user);
}
