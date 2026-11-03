import { authHeaders } from "./auth";

const API_URL = "https://flashcard-backend-1097034776784.us-east1.run.app";

export async function translateText(
    text: string,
    targetLanguage: string
) {
    const response = await fetch(`${API_URL}/translate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(await authHeaders()),
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