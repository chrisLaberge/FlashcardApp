import { getWordLookup, saveWordLookup } from "../database/database";
import { explainErrorMessage } from "../models/Explanation";
import { clipForLookup, lookupKey, MAX_LOOKUP_CONTEXT, MAX_LOOKUP_TEXT, parseStoredLookup, type Lookup } from "../models/Lookup";
import { authHeaders } from "./auth";
import { API_URL } from "./imageApi";

const TIMEOUT_MS = 25_000;

export class LookupError extends Error {}

/**
 * The dictionary entry for a tapped word or sentence: from the phone if it was asked before,
 * otherwise from the server (and then kept). `context` is the sentence the text was tapped in.
 */
export async function lookupText(rawText: string, rawContext: string, languageName: string): Promise<Lookup> {
    const text = clipForLookup(rawText, MAX_LOOKUP_TEXT);
    const context = clipForLookup(rawContext, MAX_LOOKUP_CONTEXT);
    const key = lookupKey(languageName, text, context);

    const saved = await getWordLookup(key).catch(() => null);
    if (saved) return saved;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
        response = await fetch(`${API_URL}/lookup`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(await authHeaders()) },
            body: JSON.stringify({ text, context: context === text ? "" : context, languageName }),
            signal: controller.signal,
        });
    } catch {
        throw new LookupError(explainErrorMessage(null));
    } finally {
        clearTimeout(timer);
    }
    if (!response.ok) throw new LookupError(explainErrorMessage(response.status));

    const lookup = parseStoredLookup(JSON.stringify(await response.json().catch(() => null)));
    if (!lookup) throw new LookupError(explainErrorMessage(502));
    await saveWordLookup(key, lookup).catch(() => undefined); // not kept is fine; it is just asked again
    return lookup;
}
