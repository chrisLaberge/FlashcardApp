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
    const response = await fetch(`${API_URL}/images/download`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            id: image.id,
            url: image.downloadUrl,
        }),
    });

    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Image download failed (${response.status}): ${body}`);
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