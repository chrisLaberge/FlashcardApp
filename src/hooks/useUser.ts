import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "../services/firebase";

/** The signed-in user, `null` when signed out, `undefined` until Firebase has restored the session. */
export function useUser(): User | null | undefined {
    const [user, setUser] = useState<User | null | undefined>(undefined);
    useEffect(() => onAuthStateChanged(auth, setUser), []);
    return user;
}
