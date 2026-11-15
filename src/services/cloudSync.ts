import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SQLite from "expo-sqlite";
import { AsyncGzip, AsyncGunzip } from "fflate";
import { changeCount, onChange, untracked } from "../database/changes";
import { hasLocalData, restoreFromBackup, serializeDatabase } from "../database/database";
import { asRollbackJournal } from "../models/BackupBundle";
import { crc32, crcHex } from "../models/crc32";
import { decideSync } from "../models/syncDecision";
import { authHeaders } from "./auth";
import { applySettings, snapshotSettings } from "./backupSettings";
import { API_URL } from "./imageApi";

const CHUNK = 700 * 1024;
const BASE_KEY = "sync-base";
const DIRTY_KEY = "sync-dirty";
const DEVICE_KEY = "sync-device";
const LAST_KEY = "sync-last";

export type SyncState = {
    status: "idle" | "syncing" | "conflict" | "error";
    /** When the account's copy last matched this phone (ms), if ever. */
    lastSynced: number | null;
    message?: string;
    /** Set while the user must choose which copy to keep. */
    cloud?: { updatedAt: number; device: string; size: number };
};

let state: SyncState = { status: "idle", lastSynced: null };
const listeners = new Set<(s: SyncState) => void>();
let running = false;
let dirty = false;
let loaded = false;
let timer: ReturnType<typeof setTimeout> | undefined;

function set(next: Partial<SyncState>) {
    state = { ...state, ...next };
    listeners.forEach((l) => l(state));
}
export const getSyncState = (): SyncState => state;
export function subscribeSync(listener: (s: SyncState) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

type Meta = { version: number; size?: number; chunks?: number; crc?: string; updatedAt?: number; device?: string };

async function api(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`${API_URL}/sync${path}`, { ...init, headers: { ...(init.headers as object), ...(await authHeaders()) } });
}

async function deviceId(): Promise<string> {
    let id = await AsyncStorage.getItem(DEVICE_KEY);
    if (!id) {
        id = [...Array(20)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
        await AsyncStorage.setItem(DEVICE_KEY, id);
    }
    return id;
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function compress(bytes: Uint8Array): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const parts: Uint8Array[] = [];
        const gzip = new AsyncGzip({ level: 6 });
        gzip.ondata = (error, data, final) => {
            if (error) return reject(error);
            parts.push(data);
            if (final) resolve(concat(parts));
        };
        gzip.push(bytes, true);
    });
}

function decompress(bytes: Uint8Array): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const parts: Uint8Array[] = [];
        const gunzip = new AsyncGunzip();
        gunzip.ondata = (error, data, final) => {
            if (error) return reject(error);
            parts.push(data);
            if (final) resolve(concat(parts));
        };
        gunzip.push(bytes, true);
    });
}

function concat(parts: Uint8Array[]): Uint8Array {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
        out.set(p, at);
        at += p.length;
    }
    return out;
}

async function loadLocal() {
    if (loaded) return;
    dirty = (await AsyncStorage.getItem(DIRTY_KEY)) === "1";
    const last = Number(await AsyncStorage.getItem(LAST_KEY));
    if (last) state = { ...state, lastSynced: last };
    loaded = true;
}

const baseVersion = async () => Number(await AsyncStorage.getItem(BASE_KEY)) || 0;

async function markClean(version: number) {
    dirty = false;
    const now = Date.now();
    await AsyncStorage.multiSet([[BASE_KEY, String(version)], [DIRTY_KEY, "0"], [LAST_KEY, String(now)]]);
    set({ lastSynced: now });
}

/** Saves this phone's copy to the account. `base` is the saved version this phone is replacing. */
async function upload(base: number): Promise<"done" | "raced"> {
    const seen = changeCount();
    await untracked(() => snapshotSettings().catch(() => undefined));
    const raw = await serializeDatabase();
    const packed = await compress(raw);
    const check = crcHex(crc32(0, packed));
    const chunks = Math.max(1, Math.ceil(packed.length / CHUNK));

    const begin = await api("/begin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base, chunks, size: packed.length, crc: check, device: await deviceId() }),
    });
    if (begin.status === 409) return "raced";
    if (begin.status === 413) throw new Error("Your decks are too big to save online (25 MB limit).");
    if (!begin.ok) throw new Error("Could not start saving online.");
    const { upload: id } = (await begin.json()) as { upload: string };

    for (let i = 0; i < chunks; i++) {
        const piece = packed.slice(i * CHUNK, (i + 1) * CHUNK);
        const put = await api(`/chunk/${id}/${i}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: piece as unknown as BodyInit });
        if (!put.ok) throw new Error("Could not send your data.");
        await tick();
    }
    const commit = await api("/commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ upload: id, base }) });
    if (commit.status === 409) return "raced";
    if (!commit.ok) throw new Error("Could not finish saving online.");
    const { version } = (await commit.json()) as { version: number };
    await markClean(version);
    // Something changed while this was uploading: it still needs saving.
    if (changeCount() !== seen) {
        dirty = true;
        await AsyncStorage.setItem(DIRTY_KEY, "1");
    }
    return "done";
}

/** Replaces this phone's cards and progress with the account's saved copy. */
async function download(meta: Meta): Promise<"done" | "raced"> {
    const parts: Uint8Array[] = [];
    let check = 0;
    for (let i = 0; i < (meta.chunks ?? 0); i++) {
        const res = await api(`/chunk/${i}?version=${meta.version}`);
        if (res.status === 409) return "raced";
        if (!res.ok) throw new Error("Could not load your data.");
        const piece = new Uint8Array(await res.arrayBuffer());
        check = crc32(check, piece);
        parts.push(piece);
        await tick();
    }
    if (crcHex(check) !== meta.crc) throw new Error("The downloaded data was damaged. Try again.");
    const raw = await decompress(concat(parts));
    const backup = await SQLite.deserializeDatabaseAsync(asRollbackJournal(raw));
    try {
        await untracked(async () => {
            await restoreFromBackup(backup, { replace: true });
            const settings = await backup.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM app_settings").catch(() => []);
            await applySettings(settings).catch(() => undefined);
        });
    } finally {
        await backup.closeAsync().catch(() => undefined);
    }
    await markClean(meta.version);
    return "done";
}

async function readMeta(): Promise<Meta> {
    const res = await api("/meta");
    if (!res.ok) throw new Error("Could not reach the server.");
    return (await res.json()) as Meta;
}

/** Brings the phone and the account's saved copy together. Safe to call any time; one run at a time. */
export async function syncNow(): Promise<void> {
    if (running) return;
    running = true;
    try {
        await loadLocal();
        set({ status: "syncing", message: undefined });
        for (let attempt = 0; attempt < 3; attempt++) {
            const meta = await readMeta();
            const base = await baseVersion();
            const choice = decideSync({ base, dirty, hasData: await hasLocalData(), remote: meta.version });
            if (choice === "ask") {
                set({ status: "conflict", cloud: { updatedAt: meta.updatedAt ?? 0, device: meta.device ?? "", size: meta.size ?? 0 } });
                return;
            }
            if (choice === "nothing") break;
            const result = choice === "upload" ? await upload(meta.version) : await download(meta);
            if (result === "done") break;
        }
        set({ status: "idle", cloud: undefined });
    } catch (error) {
        set({ status: "error", message: error instanceof Error ? error.message : "Sync failed." });
    } finally {
        running = false;
    }
}

/** The user's answer to "both have changes": keep this phone's copy or the account's. */
export async function resolveConflict(keep: "phone" | "cloud"): Promise<void> {
    if (running) return;
    running = true;
    try {
        set({ status: "syncing" });
        const meta = await readMeta();
        if (keep === "phone") await upload(meta.version);
        else await download(meta);
        set({ status: "idle", cloud: undefined });
    } catch (error) {
        set({ status: "error", message: error instanceof Error ? error.message : "Sync failed." });
    } finally {
        running = false;
    }
}

/** Starts watching: marks the phone as changed on any write, and saves a little after the writes stop. */
export function startAutoSync(): () => void {
    void loadLocal().then(() => syncNow());
    const off = onChange(() => {
        if (!dirty) {
            dirty = true;
            void AsyncStorage.setItem(DIRTY_KEY, "1").catch(() => undefined);
        }
        clearTimeout(timer);
        timer = setTimeout(() => void syncNow(), 60_000);
    });
    return () => {
        off();
        clearTimeout(timer);
    };
}

/** For sign-out / account deletion: forget what this phone knew about the saved copy. */
export async function forgetSyncState(): Promise<void> {
    dirty = false;
    loaded = false;
    state = { status: "idle", lastSynced: null };
    await AsyncStorage.multiRemove([BASE_KEY, DIRTY_KEY, LAST_KEY]);
}
