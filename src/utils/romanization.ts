import hangulRomanization from "hangul-romanization";
import { pinyin } from "pinyin-pro";
import ToJyutping from "to-jyutping";
import { transliterate } from "transliteration";
import { toRomaji } from "wanakana";


// ─────────────────────────────
// Japanese (lazy-loaded, initialised once)
// ─────────────────────────────

/**
 * Pinyin with tone marks. The reading of a character depends on the word around it (银行 yín háng, 行李 xíng li),
 * which pinyin-pro works out from its own phrase list, so no word splitter is needed. Punctuation stays attached.
 */
export function chinesePinyin(text: string): string {
    const syllables = pinyin(text, { toneType: "symbol", type: "array", nonZh: "consecutive" });
    return syllables
        .join(" ")
        .replace(/ ([，。！？、；：,.!?;:）」』”’)])/g, "$1")
        .replace(/([（「『“‘(]) /g, "$1")
        .replace(/\s+/g, " ")
        .trim();
}

// ─────────────────────────────
// Main entry point
// ─────────────────────────────

export async function getRomanization(
    text: string,
    languageCode: string
): Promise<string | null> {
    if (!text.trim()) {
        return null;
    }

    switch (languageCode) {
        // Mandarin → Hanyu Pinyin with tone marks
        case "zh":
            return chinesePinyin(text);

        // Cantonese → Jyutping
        case "yue":
            return ToJyutping.getJyutpingList(text)
                .map(([character, jyutping]: [string, string | undefined | null]) =>
                    jyutping ?? character
                )
                .join(" ");

        // Japanese → Hepburn romaji (kanji handled via morphological analysis)
        case "ja": {
            // Temporary fallback: converts kana, but not kanji readings.
            return toRomaji(text);
        }

        // Korean → Revised Romanization
        case "ko":
            return hangulRomanization.convert(text);
        // Everything below is a generic Latin transliteration
        case "ru": case "uk": case "bg": case "sr": case "mk": case "kk": // Cyrillic
        case "ar": case "fa": case "ur": case "ps":                       // Arabic script
        case "hi": case "bn": case "mr": case "te": case "ta":            // Indic
        case "gu": case "kn": case "ml": case "pa": case "ne":
        case "am":                                                        // Ethiopic
        case "el": case "he": case "ka": case "hy":                       // Other scripts
        case "th": case "my":
            return transliterate(text);

        // Latin-script languages need no pronunciation guide
        case "en": case "es": case "fr": case "pt": case "de": case "id":
        case "it": case "vi": case "sw": case "jv": case "ha": case "yo":
        case "zu": case "ig": case "nl": case "ro": case "uz": case "pl":
        case "hu": case "cs": case "sv": case "fi": case "da": case "no":
        case "sk": case "lt": case "ca": case "sl": case "lv": case "et":
        case "sq": case "bs": case "ga": case "cy": case "so": case "ms":
            return null;

        default:
            return null;
    }
}