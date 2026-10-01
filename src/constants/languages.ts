
export type Language = {
    name: string;
    nativeName: string;
    code: string;
    ttsCode: string;
    flag: string;
};

export const languages: Language[] = [
    { name: "English", nativeName: "English", code: "en", ttsCode: "en-US", flag: "🇬🇧" },
    { name: "Mandarin Chinese", nativeName: "中文", code: "zh", ttsCode: "zh-CN", flag: "🇨🇳" },
    { name: "Hindi", nativeName: "हिन्दी", code: "hi", ttsCode: "hi-IN", flag: "🇮🇳" },
    { name: "Spanish", nativeName: "Español", code: "es", ttsCode: "es-ES", flag: "🇪🇸" },
    { name: "French", nativeName: "Français", code: "fr", ttsCode: "fr-FR", flag: "🇫🇷" },
    { name: "Arabic", nativeName: "العربية", code: "ar", ttsCode: "ar-SA", flag: "🇸🇦" },
    { name: "Bengali", nativeName: "বাংলা", code: "bn", ttsCode: "bn-IN", flag: "🇧🇩" },
    { name: "Portuguese", nativeName: "Português", code: "pt", ttsCode: "pt-BR", flag: "🇧🇷" },
    { name: "Russian", nativeName: "Русский", code: "ru", ttsCode: "ru-RU", flag: "🇷🇺" },
    { name: "Indonesian", nativeName: "Bahasa Indonesia", code: "id", ttsCode: "id-ID", flag: "🇮🇩" },

    { name: "Urdu", nativeName: "اردو", code: "ur", ttsCode: "ur-PK", flag: "🇵🇰" },
    { name: "German", nativeName: "Deutsch", code: "de", ttsCode: "de-DE", flag: "🇩🇪" },
    { name: "Japanese", nativeName: "日本語", code: "ja", ttsCode: "ja-JP", flag: "🇯🇵" },
    { name: "Marathi", nativeName: "मराठी", code: "mr", ttsCode: "mr-IN", flag: "🇮🇳" },
    { name: "Vietnamese", nativeName: "Tiếng Việt", code: "vi", ttsCode: "vi-VN", flag: "🇻🇳" },
    { name: "Telugu", nativeName: "తెలుగు", code: "te", ttsCode: "te-IN", flag: "🇮🇳" },

    { name: "Tamil", nativeName: "தமிழ்", code: "ta", ttsCode: "ta-IN", flag: "🇮🇳" },
    { name: "Cantonese", nativeName: "廣東話", code: "yue", ttsCode: "zh-HK", flag: "🇭🇰" },
    { name: "Korean", nativeName: "한국어", code: "ko", ttsCode: "ko-KR", flag: "🇰🇷" },

    { name: "Persian", nativeName: "فارسی", code: "fa", ttsCode: "fa-IR", flag: "🇮🇷" },
    { name: "Hausa", nativeName: "Hausa", code: "ha", ttsCode: "ha-NG", flag: "🇳🇬" },
    { name: "Swahili", nativeName: "Kiswahili", code: "sw", ttsCode: "sw-KE", flag: "🇰🇪" },
    { name: "Javanese", nativeName: "Basa Jawa", code: "jv", ttsCode: "jv-ID", flag: "🇮🇩" },
    { name: "Italian", nativeName: "Italiano", code: "it", ttsCode: "it-IT", flag: "🇮🇹" },
    { name: "Gujarati", nativeName: "ગુજરાતી", code: "gu", ttsCode: "gu-IN", flag: "🇮🇳" },
    { name: "Thai", nativeName: "ไทย", code: "th", ttsCode: "th-TH", flag: "🇹🇭" },
    { name: "Amharic", nativeName: "አማርኛ", code: "am", ttsCode: "am-ET", flag: "🇪🇹" },
    { name: "Kannada", nativeName: "ಕನ್ನಡ", code: "kn", ttsCode: "kn-IN", flag: "🇮🇳" },
    { name: "Polish", nativeName: "Polski", code: "pl", ttsCode: "pl-PL", flag: "🇵🇱" },

    { name: "Ukrainian", nativeName: "Українська", code: "uk", ttsCode: "uk-UA", flag: "🇺🇦" },
    { name: "Malayalam", nativeName: "മലയാളം", code: "ml", ttsCode: "ml-IN", flag: "🇮🇳" },
    { name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", code: "pa", ttsCode: "pa-IN", flag: "🇮🇳" },
    { name: "Burmese", nativeName: "မြန်မာ", code: "my", ttsCode: "my-MM", flag: "🇲🇲" },
    { name: "Yoruba", nativeName: "Yorùbá", code: "yo", ttsCode: "yo-NG", flag: "🇳🇬" },
    { name: "Dutch", nativeName: "Nederlands", code: "nl", ttsCode: "nl-NL", flag: "🇳🇱" },
    { name: "Romanian", nativeName: "Română", code: "ro", ttsCode: "ro-RO", flag: "🇷🇴" },
    { name: "Somali", nativeName: "Soomaali", code: "so", ttsCode: "so-SO", flag: "🇸🇴" },
    { name: "Nepali", nativeName: "नेपाली", code: "ne", ttsCode: "ne-NP", flag: "🇳🇵" },
    { name: "Malay", nativeName: "Bahasa Melayu", code: "ms", ttsCode: "ms-MY", flag: "🇲🇾" },

    { name: "Uzbek", nativeName: "Oʻzbekcha", code: "uz", ttsCode: "uz-UZ", flag: "🇺🇿" },
    { name: "Zulu", nativeName: "isiZulu", code: "zu", ttsCode: "zu-ZA", flag: "🇿🇦" },
    { name: "Pashto", nativeName: "پښتو", code: "ps", ttsCode: "ps-AF", flag: "🇦🇫" },
    { name: "Igbo", nativeName: "Igbo", code: "ig", ttsCode: "ig-NG", flag: "🇳🇬" },
    { name: "Kazakh", nativeName: "Қазақша", code: "kk", ttsCode: "kk-KZ", flag: "🇰🇿" },
    { name: "Greek", nativeName: "Ελληνικά", code: "el", ttsCode: "el-GR", flag: "🇬🇷" },
    { name: "Hungarian", nativeName: "Magyar", code: "hu", ttsCode: "hu-HU", flag: "🇭🇺" },
    { name: "Czech", nativeName: "Čeština", code: "cs", ttsCode: "cs-CZ", flag: "🇨🇿" },
    { name: "Swedish", nativeName: "Svenska", code: "sv", ttsCode: "sv-SE", flag: "🇸🇪" },
    { name: "Hebrew", nativeName: "עברית", code: "he", ttsCode: "he-IL", flag: "🇮🇱" },

    { name: "Finnish", nativeName: "Suomi", code: "fi", ttsCode: "fi-FI", flag: "🇫🇮" },
    { name: "Serbian", nativeName: "Српски", code: "sr", ttsCode: "sr-RS", flag: "🇷🇸" },
    { name: "Bulgarian", nativeName: "Български", code: "bg", ttsCode: "bg-BG", flag: "🇧🇬" },
    { name: "Danish", nativeName: "Dansk", code: "da", ttsCode: "da-DK", flag: "🇩🇰" },
    { name: "Norwegian", nativeName: "Norsk", code: "no", ttsCode: "nb-NO", flag: "🇳🇴" },
    { name: "Slovak", nativeName: "Slovenčina", code: "sk", ttsCode: "sk-SK", flag: "🇸🇰" },
    { name: "Georgian", nativeName: "ქართული", code: "ka", ttsCode: "ka-GE", flag: "🇬🇪" },
    { name: "Armenian (Eastern)", nativeName: "Հայերեն", code: "hye", ttsCode: "hy-AM", flag: "🇦🇲" },
    { name: "Armenian (Western)", nativeName: "Արևմտահայերեն", code: "hyw", ttsCode: "hy-AM", flag: "🇦🇲" },

    { name: "Lithuanian", nativeName: "Lietuvių", code: "lt", ttsCode: "lt-LT", flag: "🇱🇹" },
    { name: "Catalan", nativeName: "Català", code: "ca", ttsCode: "ca-ES", flag: "🇪🇸" },
    { name: "Slovenian", nativeName: "Slovenščina", code: "sl", ttsCode: "sl-SI", flag: "🇸🇮" },
    { name: "Latvian", nativeName: "Latviešu", code: "lv", ttsCode: "lv-LV", flag: "🇱🇻" },
    { name: "Estonian", nativeName: "Eesti", code: "et", ttsCode: "et-EE", flag: "🇪🇪" },
    { name: "Albanian", nativeName: "Shqip", code: "sq", ttsCode: "sq-AL", flag: "🇦🇱" },
    { name: "Bosnian", nativeName: "Bosanski", code: "bs", ttsCode: "bs-BA", flag: "🇧🇦" },
    { name: "Macedonian", nativeName: "Македонски", code: "mk", ttsCode: "mk-MK", flag: "🇲🇰" },
    { name: "Irish", nativeName: "Gaeilge", code: "ga", ttsCode: "ga-IE", flag: "🇮🇪" },
    { name: "Welsh", nativeName: "Cymraeg", code: "cy", ttsCode: "cy-GB", flag: "🏴" },
];

export const getLanguage = (code: string): Language | undefined =>
    languages.find((l) => l.code === code);

//use code to find tts code getTTSLanguageCode("fr")
export const getTTSLanguageCode = (code: string): string | undefined =>
    languages.find((l) => l.code === code)?.ttsCode;

