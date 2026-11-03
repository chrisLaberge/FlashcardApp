import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { Directory, File, Paths } from "expo-file-system";
import { normalizeSpeechText, ttsCacheName } from "../utils/ttsCache";
import { authHeaders } from "./auth";
import { API_URL } from "./imageApi";

/**
 * Speech for languages the phone has no voice for (see Language.speech).
 *
 * The server turns text into audio; every word is fetched once, kept on the phone, and played
 * from there afterwards, so replays and reviews work offline. Which voice or provider makes the
 * audio is the server's business: the app only sends text and a voice id (e.g. "hyw").
 * The endpoint it expects is described in docs/backend-tts-endpoint.md.
 */

const REQUEST_TIMEOUT_MS = 20_000;

function cacheDirectory(): Directory {
    return new Directory(Paths.document, "tts");
}

/** The audio file for this text if it is already on the phone (any extension). */
function findCached(voice: string, text: string): File | undefined {
    const directory = cacheDirectory();
    if (!directory.exists) return undefined;
    const name = ttsCacheName(voice, text);
    const match = directory.list().find((entry) => entry instanceof File && entry.name.startsWith(`${name}.`));
    return match instanceof File ? match : undefined;
}

function extensionFor(contentType: string | null): string {
    if (contentType?.includes("mpeg") || contentType?.includes("mp3")) return "mp3";
    if (contentType?.includes("ogg")) return "ogg";
    if (contentType?.includes("aac") || contentType?.includes("mp4")) return "m4a";
    return "wav";
}

const inFlight = new Map<string, Promise<string | null>>();

/**
 * Makes sure the audio for this text is on the phone and returns its uri, or null if it could not
 * be fetched (offline, server error). Several callers asking for the same word share one request.
 */
export function ensureSpeechFile(voice: string, text: string): Promise<string | null> {
    const clean = normalizeSpeechText(text);
    if (!clean) return Promise.resolve(null);

    const cached = findCached(voice, clean);
    if (cached) return Promise.resolve(cached.uri);

    const key = ttsCacheName(voice, clean);
    let request = inFlight.get(key);
    if (!request) {
        request = (async () => {
            try {
                const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
                let response: Response;
                try {
                    response = await fetch(`${API_URL}/tts`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify({ text: clean, voice }),
                        signal: controller.signal,
                    });
                } finally {
                    clearTimeout(timer);
                }
                if (!response.ok) throw new Error(`Speech request failed (${response.status})`);

                const bytes = new Uint8Array(await response.arrayBuffer());
                if (bytes.length === 0) throw new Error("Speech request returned no audio");

                const directory = cacheDirectory();
                directory.create({ intermediates: true, idempotent: true });
                const file = new File(directory, `${key}.${extensionFor(response.headers.get("content-type"))}`);
                file.create({ overwrite: true });
                file.write(bytes);
                return file.uri;
            } catch (error) {
                console.warn("Could not get speech audio:", error);
                return null;
            } finally {
                inFlight.delete(key);
            }
        })();
        inFlight.set(key, request);
    }
    return request;
}

/** Fetches the audio ahead of time (the next card) so it plays without a delay. Never throws. */
export function prefetchSpeech(voice: string, text: string): void {
    void ensureSpeechFile(voice, text);
}

let player: AudioPlayer | null = null;
let audioModeSet = false;
let playToken = 0;

/** Stops anything this service is playing. */
export function stopRemoteSpeech(): void {
    playToken++; // a request that is still being fetched must not start playing afterwards
    if (player) {
        try {
            player.remove();
        } catch {
            // already released
        }
        player = null;
    }
}

/** Speaks the text with the server voice. Resolves to false if there was nothing to play. */
export async function speakRemote(voice: string, text: string): Promise<boolean> {
    stopRemoteSpeech();
    const token = playToken;

    const uri = await ensureSpeechFile(voice, text);
    if (!uri || token !== playToken) return false; // failed, or something else started meanwhile

    try {
        if (!audioModeSet) {
            await setAudioModeAsync({ playsInSilentMode: false });
            audioModeSet = true;
        }
        const next = createAudioPlayer({ uri });
        next.addListener("playbackStatusUpdate", (status) => {
            if (status.didJustFinish) {
                try {
                    next.remove();
                } catch {
                    // already released
                }
                if (player === next) player = null;
            }
        });
        player = next;
        next.play();
        return true;
    } catch (error) {
        console.warn("Could not play speech audio:", error);
        return false;
    }
}
