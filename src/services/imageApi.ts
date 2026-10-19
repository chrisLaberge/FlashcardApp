export const API_URL = "https://flashcard-backend-1097034776784.us-east1.run.app";

export type ImageSearchResult = {
    id: number;
    source: string;
    thumbnailUrl: string;
    downloadUrl: string;
    pageUrl: string;
    photographer: string;
    photographerUrl: string;
};

export async function searchImages(
    query: string
): Promise<ImageSearchResult[]> {
    const response = await fetch(
        `${API_URL}/images/search?query=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Image search failed (${response.status}): ${body}`);
    }

    const data = await response.json();

    return data.results;
}

export async function downloadImage(image: ImageSearchResult) {
    // 1. The phone downloads the picture from Pixabay
    const source = await fetch(image.downloadUrl);

    if (!source.ok) {
        throw new Error(`Pixabay download failed (${source.status})`);
    }

    const blob = await source.blob();

    // 2. The phone sends it to our server
    const response = await fetch(
        `${API_URL}/images/upload?id=${encodeURIComponent(String(image.id))}`,
        {
            method: "POST",
            headers: {
                "Content-Type": blob.type || "image/jpeg",
            },
            body: blob,
        }
    );

    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Image upload failed (${response.status}): ${body}`);
    }

    return await response.json();
}

/**
 * Turns a saved image path into something <Image> can load.
 * New images are full https:// addresses (Cloud Storage).
 * Old ones are partial paths like /images/123.webp.
 */
export function resolveImageUrl(imageUrl?: string | null): string | undefined {
    if (!imageUrl) return undefined;
    if (imageUrl.startsWith("http")) return imageUrl;
    return `${API_URL}${imageUrl}`;
}