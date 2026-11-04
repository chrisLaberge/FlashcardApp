/** People you chose not to see on the global leaderboard (kept on this phone only). */

export function parseHidden(raw: string | null): string[] {
    if (!raw) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    } catch {
        return [];
    }
}

export function addHidden(list: readonly string[], uid: string): string[] {
    return list.includes(uid) ? [...list] : [...list, uid];
}

/** Drops hidden people and renumbers the ranks; your own row is never hidden. */
export function withoutHidden<T extends { uid: string; rank: number; isMe: boolean }>(rows: readonly T[], hidden: readonly string[]): T[] {
    const gone = new Set(hidden);
    return rows.filter((r) => r.isMe || !gone.has(r.uid)).map((r, i) => ({ ...r, rank: i + 1 }));
}
