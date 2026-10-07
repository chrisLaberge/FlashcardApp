export const API_URL = "http://10.0.0.208:3000";
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
        throw new Error("Image search failed");
    }

    const data = await response.json();

    return data.results;
}

export async function downloadImage(
    image: ImageSearchResult
) {
    const response = await fetch(
        `${API_URL}/images/download`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: image.id,
                url: image.downloadUrl,
            }),
        }
    );

    if (!response.ok) {
        throw new Error("Image download failed");
    }

    return await response.json();
}