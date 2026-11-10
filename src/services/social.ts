import type { UploadDay } from "../models/Progression";
import { authHeaders } from "./auth";
import { API_URL } from "./imageApi";

/** The pet shown on a profile: its name and what it wears (ids from models/Shop). */
export type PetLook = { name: string; hat: string | null; glasses: string | null; scarf: string | null };

export type Profile = {
    username: string;
    friendCode: string;
    totalXp: number;
    level: number;
    totalReviews: number;
    totalTimeMs: number;
    currentStreak: number;
    longestStreak: number;
    /** Shown on the global leaderboard. */
    showGlobal: boolean;
    /** The chosen profile picture, or null until one is picked. */
    avatar: string | null;
    pet: PetLook | null;
    banner: string | null;
};

export type Person = { uid: string; username: string; avatar: string | null; pet: PetLook | null; banner: string | null; level: number; totalXp: number; currentStreak: number };
export type Friends = { friends: Person[]; incoming: Person[]; outgoing: Person[] };
export type LeaderboardEntry = Person & { rank: number; xp: number; isMe: boolean };

export type GlobalRow = { rank: number; uid: string; username: string; avatar: string | null; pet: PetLook | null; banner: string | null; level: number; xp: number; currentStreak: number; isMe: boolean };
export type GlobalBoard = {
    entries: GlobalRow[];
    /** Your own standing, even when you are outside the top list. `rank` is null with no XP or when hidden. */
    me: { visible: boolean; xp: number; rank: number | null };
};

export class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

const TIMEOUT_MS = 15_000;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { ...(await authHeaders()) };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
        response = await fetch(`${API_URL}/social${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal,
        });
    } catch {
        throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
    } finally {
        clearTimeout(timer);
    }

    if (response.status === 204) return undefined as T;
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        throw new ApiError(response.status, typeof data?.error === "string" ? data.error : `Request failed (${response.status})`);
    }
    return data as T;
}

export const getProfile = async () => (await request<{ profile: Profile | null }>("GET", "/me")).profile;
export const saveUsername = async (username: string) => (await request<{ profile: Profile }>("POST", "/me", { username })).profile;
export const uploadDays = async (days: UploadDay[], bonusXp = 0, freezeDays: string[] = []) =>
    (await request<{ profile: Profile }>("PUT", "/me/days", { days, bonusXp, freezeDays })).profile;
/** Saves the pet and banner shown to friends. Resolves quietly when there is no profile yet. */
export const saveLook = async (pet: PetLook | null, banner: string | null) => {
    try {
        await request("PUT", "/me/settings", { pet, banner });
    } catch (error) {
        if (error instanceof ApiError && (error.status === 404 || error.status === 401)) return;
        throw error;
    }
};
export const deleteMyData = () => request<void>("DELETE", "/me");

export const getFriends = () => request<Friends>("GET", "/friends");
export const requestFriend = async (friendCode: string) =>
    (await request<{ status: "requested" | "friends" }>("POST", "/friends/requests", { friendCode })).status;
export const acceptRequest = (uid: string) => request<void>("POST", `/friends/requests/${encodeURIComponent(uid)}/accept`);
export const removeRequest = (uid: string) => request<void>("DELETE", `/friends/requests/${encodeURIComponent(uid)}`);
export const removeFriend = (uid: string) => request<void>("DELETE", `/friends/${encodeURIComponent(uid)}`);

export const getLeaderboard = async () => (await request<{ entries: LeaderboardEntry[] }>("GET", "/leaderboard")).entries;

export const getGlobalLeaderboard = () => request<GlobalBoard>("GET", "/leaderboard/global");
export const setAvatar = async (avatar: string) =>
    (await request<{ profile: Profile }>("PUT", "/me/settings", { avatar })).profile;
export const setShowGlobal = async (showGlobal: boolean) =>
    (await request<{ profile: Profile }>("PUT", "/me/settings", { showGlobal })).profile;
