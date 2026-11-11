/**
 * Spotting words from another language inside a book, so they are left out of the unknown words and of the
 * coverage (a French quote in a Spanish book is not Spanish vocabulary).
 *
 * Three cues: the writing system (Latin letters in a Russian book), letters the language does not use
 * (a "ç" in a Spanish book), and whole sentences that are clearly in another language (judged by their common words).
 */

const SCRIPTS: Record<string, string> = {
    ru: "Cyrillic", uk: "Cyrillic", bg: "Cyrillic", be: "Cyrillic", mk: "Cyrillic", mn: "Cyrillic",
    sr: "Cyrillic|Latin", kk: "Cyrillic|Latin",
    zh: "Han", yue: "Han", ja: "Han|Hiragana|Katakana", ko: "Hangul|Han",
    ar: "Arabic", fa: "Arabic", ur: "Arabic", ps: "Arabic", he: "Hebrew", el: "Greek", th: "Thai",
    hi: "Devanagari", mr: "Devanagari", ne: "Devanagari", bn: "Bengali", ta: "Tamil", te: "Telugu", gu: "Gujarati",
    kn: "Kannada", ml: "Malayalam", pa: "Gurmukhi", my: "Myanmar", am: "Ethiopic", ka: "Georgian", hy: "Armenian",
};

const expected = new Map<string, RegExp>();
function expectedScript(language: string): RegExp {
    let pattern = expected.get(language);
    if (!pattern) {
        const scripts = (SCRIPTS[language] ?? "Latin").split("|").map((s) => `\\p{Script=${s}}`).join("");
        pattern = new RegExp(`[${scripts}]`, "u");
        expected.set(language, pattern);
    }
    return pattern;
}

const LETTER = /\p{L}/u;
const LATIN = /\p{Script=Latin}/u;

/** The letters each Latin-script language uses (lower case). A Latin letter outside this set belongs to another language. */
const ALPHABET: Record<string, string> = {
    es: "abcdefghijklmnopqrstuvwxyzáéíóúüñ",
    fr: "abcdefghijklmnopqrstuvwxyzàâæçéèêëîïôœùûüÿ",
    de: "abcdefghijklmnopqrstuvwxyzäöüß",
    it: "abcdefghijklmnopqrstuvwxyzàèéìíîòóùú",
    pt: "abcdefghijklmnopqrstuvwxyzàáâãçéêíóôõúü",
    ca: "abcdefghijklmnopqrstuvwxyzàçéèíïóòúü·",
    nl: "abcdefghijklmnopqrstuvwxyzéèëïóöüáíúà",
};
const alphabetSets = new Map<string, Set<string>>();

/** True when the word is not written in the language: another writing system, or a letter the language never uses. */
export function isForeignWord(word: string, language: string): boolean {
    const letters = [...word.normalize("NFC")].filter((c) => LETTER.test(c));
    if (letters.length === 0) return false;
    const script = expectedScript(language);
    if (letters.every((c) => !script.test(c))) return true;
    const alphabet = ALPHABET[language];
    if (alphabet) {
        let set = alphabetSets.get(language);
        if (!set) alphabetSets.set(language, (set = new Set(alphabet)));
        if (letters.some((c) => LATIN.test(c) && !set.has(c.toLowerCase()))) return true;
    }
    return false;
}

/** Very common words of some languages, used to tell which language a whole sentence is in. */
const STOPWORDS: Record<string, string> = {
    es: "el la los las un una unos unas de del al y o pero que se en con por para como más muy su sus mi tu es son era fue está están hay no sí lo le les me te nos este esta eso esa ese cuando donde también ya",
    fr: "le la les un une des du de au aux et ou mais que qui ne pas dans avec pour sur par comme plus très son sa ses mon ma mes ton ta tes est sont était été avoir être je tu il elle nous vous ils elles ce cette ces où quand aussi déjà",
    en: "the a an of and or but that which not in on at with for from by as more very his her its their my your is are was were be been have has had i you he she it we they this these those there when where also already will would can could",
    de: "der die das den dem des ein eine einen einem und oder aber dass nicht in im mit für von zu auf an als wie mehr sehr sein ihr ist sind war waren haben hat ich du er sie es wir ihr dies diese wenn wo auch schon",
    it: "il lo la i gli le un una uno di del della dei delle e o ma che non in con per su come più molto suo sua miei mio è sono era stato ho hai ha io tu lui lei noi voi loro questo questa quando dove anche già",
    pt: "o a os as um uma uns umas de do da dos das e ou mas que não em com para por como mais muito seu sua meu minha é são era foi estava tem têm eu tu ele ela nós vocês eles elas este esta quando onde também já",
};
const stopSets = new Map<string, Set<string>>(Object.entries(STOPWORDS).map(([lang, list]) => [lang, new Set(list.split(" "))]));

/** True when a sentence is clearly in a different language from the book's. Short sentences are never judged. */
export function isForeignSentence(words: readonly string[], language: string): boolean {
    if (words.length < 5) return false;
    const lower = words.map((w) => w.toLowerCase());
    const hits = (lang: string) => {
        const set = stopSets.get(lang);
        return set ? lower.filter((w) => set.has(w)).length : 0;
    };
    const own = hits(language);
    let best = 0;
    for (const lang of stopSets.keys()) {
        if (lang === language) continue;
        best = Math.max(best, hits(lang));
    }
    return best >= 3 && best >= words.length * 0.3 && best >= own + 3 && best >= own * 2;
}
