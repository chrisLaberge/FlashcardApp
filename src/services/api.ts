const API_URL = "http://10.0.0.208:3000";

export async function translateText(
    text: string,
    targetLanguage: string
) {
    const response = await fetch(`${API_URL}/translate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            text,
            targetLanguage,
        }),
    });

    if (!response.ok) {
        throw new Error("Translation failed");
    }

    const data = await response.json();

    return data.translation;
}