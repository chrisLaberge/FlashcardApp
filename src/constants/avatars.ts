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
export function avatarFor(avatar: string | null | undefined, name: string): (typeof AVATARS)[number] {
    return avatar && (AVATARS as readonly string[]).includes(avatar) ? (avatar as (typeof AVATARS)[number]) : AVATARS[nameHash(name) % AVATARS.length];
}

/** What each picture looks like on screen. The saved value stays the one the server knows; only the drawing is an icon. */
export const AVATAR_ICONS: Record<(typeof AVATARS)[number], string> = {
    "🦊": "cat", "🐼": "panda", "🐯": "paw", "🦁": "horse", "🐸": "snail", "🐵": "rodent", "🐙": "jellyfish", "🦉": "owl",
    "🐧": "penguin", "🦄": "unicorn", "🐢": "turtle", "🐳": "fish", "🦋": "butterfly", "🐝": "bee", "🦖": "snake", "🐺": "dog",
    "🐨": "koala", "🐰": "rabbit", "🦈": "shark", "🦜": "bird", "🐲": "bat", "🦅": "duck", "🐬": "dolphin", "🦔": "pig",
};

/** A profile picture can also be the person's Google account photo, saved as "photo:<address>". */
export const PHOTO_PREFIX = "photo:";

/** The saved value for a Google photo, or null if the address is not one the server accepts. */
export function googlePhotoAvatar(photoUrl: string | null | undefined): string | null {
    if (!photoUrl || !/^https:\/\/lh3\.googleusercontent\.com\/[A-Za-z0-9_\-./=%]{1,300}$/.test(photoUrl)) return null;
    return PHOTO_PREFIX + photoUrl;
}
