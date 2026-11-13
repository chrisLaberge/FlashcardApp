
export type Language = {
    name: string;
    nativeName: string;
    code: string;
    ttsCode: string;
    /**
     * For languages the phone has no voice for: speech comes from the server instead (see
     * services/tts.ts) and is kept on the phone. `remoteVoice` is the voice id the server knows.
     */
    speech?: { remoteVoice: string };
};

export const languages: Language[] = [
    { name: "English", nativeName: "English", code: "en", ttsCode: "en-US" },
    { name: "Mandarin Chinese", nativeName: "中文", code: "zh", ttsCode: "zh-CN" },
    { name: "Hindi", nativeName: "हिन्दी", code: "hi", ttsCode: "hi-IN" },
    { name: "Spanish", nativeName: "Español", code: "es", ttsCode: "es-ES" },
    { name: "French", nativeName: "Français", code: "fr", ttsCode: "fr-FR" },
    { name: "Arabic", nativeName: "العربية", code: "ar", ttsCode: "ar-SA" },
    { name: "Bengali", nativeName: "বাংলা", code: "bn", ttsCode: "bn-IN" },
    { name: "Portuguese", nativeName: "Português", code: "pt", ttsCode: "pt-BR" },
    { name: "Russian", nativeName: "Русский", code: "ru", ttsCode: "ru-RU" },
    { name: "Indonesian", nativeName: "Bahasa Indonesia", code: "id", ttsCode: "id-ID" },

    { name: "Urdu", nativeName: "اردو", code: "ur", ttsCode: "ur-PK" },
    { name: "German", nativeName: "Deutsch", code: "de", ttsCode: "de-DE" },
    { name: "Japanese", nativeName: "日本語", code: "ja", ttsCode: "ja-JP" },
    { name: "Marathi", nativeName: "मराठी", code: "mr", ttsCode: "mr-IN" },
    { name: "Vietnamese", nativeName: "Tiếng Việt", code: "vi", ttsCode: "vi-VN" },
    { name: "Telugu", nativeName: "తెలుగు", code: "te", ttsCode: "te-IN" },

    { name: "Tamil", nativeName: "தமிழ்", code: "ta", ttsCode: "ta-IN" },
    { name: "Cantonese", nativeName: "廣東話", code: "yue", ttsCode: "zh-HK" },
    { name: "Korean", nativeName: "한국어", code: "ko", ttsCode: "ko-KR" },

    { name: "Persian", nativeName: "فارسی", code: "fa", ttsCode: "fa-IR" },
    { name: "Hausa", nativeName: "Hausa", code: "ha", ttsCode: "ha-NG" },
    { name: "Swahili", nativeName: "Kiswahili", code: "sw", ttsCode: "sw-KE" },
    { name: "Javanese", nativeName: "Basa Jawa", code: "jv", ttsCode: "jv-ID" },
    { name: "Italian", nativeName: "Italiano", code: "it", ttsCode: "it-IT" },
    { name: "Gujarati", nativeName: "ગુજરાતી", code: "gu", ttsCode: "gu-IN" },
    { name: "Thai", nativeName: "ไทย", code: "th", ttsCode: "th-TH" },
    { name: "Amharic", nativeName: "አማርኛ", code: "am", ttsCode: "am-ET" },
    { name: "Kannada", nativeName: "ಕನ್ನಡ", code: "kn", ttsCode: "kn-IN" },
    { name: "Polish", nativeName: "Polski", code: "pl", ttsCode: "pl-PL" },

    { name: "Ukrainian", nativeName: "Українська", code: "uk", ttsCode: "uk-UA" },
    { name: "Malayalam", nativeName: "മലയാളം", code: "ml", ttsCode: "ml-IN" },
    { name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", code: "pa", ttsCode: "pa-IN" },
    { name: "Burmese", nativeName: "မြန်မာ", code: "my", ttsCode: "my-MM" },
    { name: "Yoruba", nativeName: "Yorùbá", code: "yo", ttsCode: "yo-NG" },
    { name: "Dutch", nativeName: "Nederlands", code: "nl", ttsCode: "nl-NL" },
    { name: "Romanian", nativeName: "Română", code: "ro", ttsCode: "ro-RO" },
    { name: "Somali", nativeName: "Soomaali", code: "so", ttsCode: "so-SO" },
    { name: "Nepali", nativeName: "नेपाली", code: "ne", ttsCode: "ne-NP" },
    { name: "Malay", nativeName: "Bahasa Melayu", code: "ms", ttsCode: "ms-MY" },

    { name: "Uzbek", nativeName: "Oʻzbekcha", code: "uz", ttsCode: "uz-UZ" },
    { name: "Zulu", nativeName: "isiZulu", code: "zu", ttsCode: "zu-ZA" },
    { name: "Pashto", nativeName: "پښتو", code: "ps", ttsCode: "ps-AF" },
    { name: "Igbo", nativeName: "Igbo", code: "ig", ttsCode: "ig-NG" },
    { name: "Kazakh", nativeName: "Қазақша", code: "kk", ttsCode: "kk-KZ" },
    { name: "Greek", nativeName: "Ελληνικά", code: "el", ttsCode: "el-GR" },
    { name: "Hungarian", nativeName: "Magyar", code: "hu", ttsCode: "hu-HU" },
    { name: "Czech", nativeName: "Čeština", code: "cs", ttsCode: "cs-CZ" },
    { name: "Swedish", nativeName: "Svenska", code: "sv", ttsCode: "sv-SE" },
    { name: "Hebrew", nativeName: "עברית", code: "he", ttsCode: "he-IL" },

    { name: "Finnish", nativeName: "Suomi", code: "fi", ttsCode: "fi-FI" },
    { name: "Serbian", nativeName: "Српски", code: "sr", ttsCode: "sr-RS" },
    { name: "Bulgarian", nativeName: "Български", code: "bg", ttsCode: "bg-BG" },
    { name: "Danish", nativeName: "Dansk", code: "da", ttsCode: "da-DK" },
    { name: "Norwegian", nativeName: "Norsk", code: "no", ttsCode: "nb-NO" },
    { name: "Slovak", nativeName: "Slovenčina", code: "sk", ttsCode: "sk-SK" },
    { name: "Georgian", nativeName: "ქართული", code: "ka", ttsCode: "ka-GE" },
    // Western Armenian: phones only have (at best) Eastern voices, so speech comes from the server.
    // Translation and romanization still use code "hy". Eastern Armenian is not offered separately
    // because both would share the code "hy" (decks store the code).
    { name: "Armenian (Western)", nativeName: "Արևմտահայերեն", code: "hy", ttsCode: "hy-AM", speech: { remoteVoice: "hyw" } },

    { name: "Lithuanian", nativeName: "Lietuvių", code: "lt", ttsCode: "lt-LT" },
    { name: "Catalan", nativeName: "Català", code: "ca", ttsCode: "ca-ES" },
    { name: "Slovenian", nativeName: "Slovenščina", code: "sl", ttsCode: "sl-SI" },
    { name: "Latvian", nativeName: "Latviešu", code: "lv", ttsCode: "lv-LV" },
    { name: "Estonian", nativeName: "Eesti", code: "et", ttsCode: "et-EE" },
    { name: "Albanian", nativeName: "Shqip", code: "sq", ttsCode: "sq-AL" },
    { name: "Bosnian", nativeName: "Bosanski", code: "bs", ttsCode: "bs-BA" },
    { name: "Macedonian", nativeName: "Македонски", code: "mk", ttsCode: "mk-MK" },
    { name: "Irish", nativeName: "Gaeilge", code: "ga", ttsCode: "ga-IE" },
    { name: "Welsh", nativeName: "Cymraeg", code: "cy", ttsCode: "cy-GB" },
];

export const getLanguage = (code: string): Language | undefined =>
    languages.find((l) => l.code === code);

//use code to find tts code getTTSLanguageCode("fr")
export const getTTSLanguageCode = (code: string): string | undefined =>
    languages.find((l) => l.code === code)?.ttsCode;

/** The server voice for a language, if it has one (see Language.speech). */
export const getRemoteVoice = (code: string): string | undefined =>
    languages.find((l) => l.code === code)?.speech?.remoteVoice;
