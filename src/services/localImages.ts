import { Directory, File, Paths } from "expo-file-system";
import {
    getImage,
    getImagesWithoutLocalCopy,
    setImageLocalPath,
    type CardImage,
} from "../database/database";
import { imageFileName } from "../utils/imageFiles";
import { resolveImageUrl } from "./imageApi";

/**
 * Pictures are kept on the phone as well as on the server, so cards keep their images offline
 * and if the server ever goes away. The server address stays in the database as a fallback.
 */

function imagesDirectory(): Directory {
    return new Directory(Paths.document, "images");
}

/** The stored copy of an image if it is really there, otherwise undefined. */
export function localImageUri(image?: Pick<CardImage, "local_path"> | null): string | undefined {
    const path = image?.local_path;
    if (!path) return undefined;
    try {
        return new File(path).exists ? path : undefined;
    } catch {
        return undefined;
    }
}

/** What to show for an image: the copy on the phone if there is one, else the server address. */
export function imageDisplayUrl(image?: CardImage | null): string | undefined {
    return localImageUri(image) ?? resolveImageUrl(image?.file_path);
}

/** Downloads one image to the phone and remembers where. Returns the local uri, or null if it failed. */
export async function downloadImageLocally(image: CardImage): Promise<string | null> {
    if (localImageUri(image)) return image.local_path;

    const remote = resolveImageUrl(image.file_path);
    if (!remote) return null;

    try {
        const directory = imagesDirectory();
        directory.create({ intermediates: true, idempotent: true });
        const target = new File(directory, imageFileName(image.id, remote));
        const file = await File.downloadFileAsync(remote, target, { idempotent: true });
        await setImageLocalPath(image.id, file.uri);
        return file.uri;
    } catch (error) {
        console.warn(`Could not keep a copy of image ${image.id}:`, error);
        return null;
    }
}

/** Keeps a copy of a just-saved image. Never throws: the card is already saved without it. */
export async function keepLocalCopy(imageId: number): Promise<void> {
    try {
        const image = await getImage(imageId);
        if (image) await downloadImageLocally(image);
    } catch (error) {
        console.warn("Could not keep a copy of the image:", error);
    }
}

let backfilling: Promise<number> | null = null;

/**
 * Copies every image that has no copy on the phone yet (the ones saved before this existed).
 * One at a time, in the background; failures are skipped and tried again next launch.
 * Returns how many were downloaded.
 */
export function backfillLocalImages(): Promise<number> {
    backfilling ??= (async () => {
        let downloaded = 0;
        try {
            for (const image of await getImagesWithoutLocalCopy()) {
                if (await downloadImageLocally(image)) downloaded++;
            }
        } catch (error) {
            console.warn("Image backfill stopped:", error);
        }
        return downloaded;
    })().finally(() => {
        backfilling = null;
    });
    return backfilling;
}
