/** The profile pictures people can pick from (the server accepts exactly these). */
export const AVATARS = [
    "🦊", "🐼", "🐯", "🦁", "🐸", "🐵", "🐙", "🦉", "🐧", "🦄", "🐢", "🐳",
    "🦋", "🐝", "🦖", "🐺", "🐨", "🐰", "🦈", "🦜", "🐲", "🦅", "🐬", "🦔",
] as const;

/** A stable number from a name, so someone without a picture always gets the same colour and animal. */
export function nameHash(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return hash;
}

/** The picture to show: the chosen one, or a stand-in picked from the name. */
export function avatarFor(avatar: string | null | undefined, name: string): string {
    return avatar && (AVATARS as readonly string[]).includes(avatar) ? avatar : AVATARS[nameHash(name) % AVATARS.length];
}
