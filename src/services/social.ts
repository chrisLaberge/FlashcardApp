import type { UploadDay } from "../models/Progression";
import { authHeaders } from "./auth";
import { API_URL } from "./imageApi";

export type Profile = {
    username: string;
    friendCode: string;
    totalXp: number;
    level: number;
    totalReviews: number;
    totalTimeMs: number;
    currentStreak: number;
    longestStreak: number;
};

export type Person = { uid: string; username: string; level: number; totalXp: number; currentStreak: number };
export type Friends = { friends: Person[]; incoming: Person[]; outgoing: Person[] };
export type Period = "week" | "all";
export type LeaderboardEntry = Person & { rank: number; xp: number; isMe: boolean };

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
export const uploadDays = async (days: UploadDay[]) => (await request<{ profile: Profile }>("PUT", "/me/days", { days })).profile;
export const deleteMyData = () => request<void>("DELETE", "/me");

export const getFriends = () => request<Friends>("GET", "/friends");
export const requestFriend = async (friendCode: string) =>
    (await request<{ status: "requested" | "friends" }>("POST", "/friends/requests", { friendCode })).status;
export const acceptRequest = (uid: string) => request<void>("POST", `/friends/requests/${encodeURIComponent(uid)}/accept`);
export const removeRequest = (uid: string) => request<void>("DELETE", `/friends/requests/${encodeURIComponent(uid)}`);
export const removeFriend = (uid: string) => request<void>("DELETE", `/friends/${encodeURIComponent(uid)}`);

export const getLeaderboard = async (period: Period) =>
    (await request<{ period: Period; entries: LeaderboardEntry[] }>("GET", `/leaderboard?period=${period}`)).entries;
