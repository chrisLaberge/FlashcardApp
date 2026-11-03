/**
 * Picking a text-to-speech voice.
 *
 * Asking the phone to speak "ru-RU" lets the engine choose, and when it has no Russian voice it
 * quietly falls back to its default (English) voice, which then reads the text letter by letter.
 * So instead we look at the voices that are really installed and use one explicitly. If there is
 * none, the app says so rather than playing nonsense.
 */

export type VoiceInfo = {
    identifier: string;
    language: string;
    name?: string;
    quality?: string;
};

// Android often names a language with its ISO 639-2/3 code instead of the two-letter one.
const LANGUAGE_ALIASES: Record<string, string> = {
    cmn: "zh",
    zho: "zh",
    chi: "zh",
    rus: "ru",
    hye: "hy",
    arm: "hy",
    hyw: "hy",
};

/** "zh-CN", "cmn_CN" and "zh" all give "zh". */
export function languageBase(code: string): string {
    const base = code.toLowerCase().replace("_", "-").split("-")[0];
    return LANGUAGE_ALIASES[base] ?? base;
}

const normalize = (code: string) => code.toLowerCase().replace("_", "-");

/** True if any voice speaks the language (e.g. ttsCode "ru-RU" matches a "ru" or "ru-RU" voice). */
export function hasVoiceFor(voices: readonly { language: string }[], ttsCode: string | undefined): boolean {
    if (!ttsCode) return false;
    if (voices.length === 0) return true; // some devices report no voices although speech works
    const wanted = languageBase(ttsCode);
    return voices.some((voice) => languageBase(voice.language) === wanted);
}

/**
 * The best installed voice for a language, or undefined if there is none.
 * Prefers the exact region (ru-RU over ru-UA), then higher quality, then voices stored on the
 * phone over ones that need a connection, then a stable order so the choice never changes.
 */
export function chooseVoice(voices: readonly VoiceInfo[], ttsCode: string | undefined): VoiceInfo | undefined {
    if (!ttsCode) return undefined;
    const wanted = languageBase(ttsCode);
    const exact = normalize(ttsCode);

    const score = (voice: VoiceInfo) =>
        (normalize(voice.language) === exact ? 4 : 0) +
        (voice.quality === "Enhanced" ? 2 : 0) +
        (/network/i.test(voice.identifier) ? 0 : 1);

    return voices
        .filter((voice) => languageBase(voice.language) === wanted)
        .sort((a, b) => score(b) - score(a) || a.identifier.localeCompare(b.identifier))[0];
}
