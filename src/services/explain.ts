import { getCardExplanation, saveCardExplanation } from "../database/database";
import { explainErrorMessage, explanationSignature, parseStoredExplanation, type Explanation } from "../models/Explanation";
import { authHeaders } from "./auth";
import { API_URL } from "./imageApi";

const TIMEOUT_MS = 35_000;

export class ExplainError extends Error {}

type CardWords = { id?: number; learningText: string; localizedText: string; exampleSentence: string };

/**
 * The explanation for a card: from the phone if it was asked for before, otherwise from the
 * server (and then kept). `fresh` asks again even if one is saved.
 */
export async function explainCard(card: CardWords, languageName: string, fresh = false): Promise<Explanation> {
    const signature = explanationSignature(card);
    if (card.id !== undefined && !fresh) {
        const saved = await getCardExplanation(card.id, signature);
        if (saved) return saved;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
        response = await fetch(`${API_URL}/explain`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(await authHeaders()) },
            body: JSON.stringify({
                text: card.learningText,
                meaning: card.localizedText,
                example: card.exampleSentence,
                languageName,
            }),
            signal: controller.signal,
        });
    } catch {
        throw new ExplainError(explainErrorMessage(null));
    } finally {
        clearTimeout(timer);
    }
    if (!response.ok) throw new ExplainError(explainErrorMessage(response.status));

    const explanation = parseStoredExplanation(JSON.stringify(await response.json().catch(() => null)));
    if (!explanation) throw new ExplainError(explainErrorMessage(502));
    if (card.id !== undefined) await saveCardExplanation(card.id, signature, explanation);
    return explanation;
}
