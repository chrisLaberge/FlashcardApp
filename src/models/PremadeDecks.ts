/**
 * Starter decks the user can add with one tap. Meanings are in English.
 *
 * Every deck covers the same 20 survival phrases, in the same order, so the data is checked
 * against `BASICS` (see tests/premadeDecks.test.ts). Add a language by adding one row per entry.
 */
export type PremadeCard = { learning: string; meaning: string };

export type PremadeDeck = {
    id: string;
    /** Language code, as in constants/languages.ts. */
    language: string;
    name: string;
    description: string;
    cards: PremadeCard[];
};

export const BASICS = [
    "Hello", "Goodbye", "Please", "Thank you", "You're welcome", "Yes", "No", "I'm sorry", "Excuse me", "Water",
    "Food", "How are you?", "I don't understand", "How much is it?", "Where is the bathroom?", "My name is…",
    "Good", "One", "Two", "Three",
] as const;

const TRANSLATIONS: Record<string, { name: string; words: string[] }> = {
    zh: {
        name: "Mandarin basics",
        words: ["你好", "再见", "请", "谢谢", "不客气", "是", "不", "对不起", "打扰一下", "水", "食物", "你好吗？", "我不明白", "多少钱？", "厕所在哪里？", "我叫…", "好", "一", "二", "三"],
    },
    ru: {
        name: "Russian basics",
        words: ["Здравствуйте", "До свидания", "Пожалуйста", "Спасибо", "Не за что", "Да", "Нет", "Извините", "Простите", "Вода", "Еда", "Как дела?", "Я не понимаю", "Сколько это стоит?", "Где туалет?", "Меня зовут…", "Хорошо", "Один", "Два", "Три"],
    },
    es: {
        name: "Spanish basics",
        words: ["Hola", "Adiós", "Por favor", "Gracias", "De nada", "Sí", "No", "Lo siento", "Perdón", "Agua", "Comida", "¿Cómo estás?", "No entiendo", "¿Cuánto cuesta?", "¿Dónde está el baño?", "Me llamo…", "Bueno", "Uno", "Dos", "Tres"],
    },
    fr: {
        name: "French basics",
        words: ["Bonjour", "Au revoir", "S'il vous plaît", "Merci", "De rien", "Oui", "Non", "Désolé", "Excusez-moi", "Eau", "Nourriture", "Comment allez-vous ?", "Je ne comprends pas", "Combien ça coûte ?", "Où sont les toilettes ?", "Je m'appelle…", "Bon", "Un", "Deux", "Trois"],
    },
    de: {
        name: "German basics",
        words: ["Hallo", "Auf Wiedersehen", "Bitte", "Danke", "Gern geschehen", "Ja", "Nein", "Entschuldigung", "Verzeihung", "Wasser", "Essen", "Wie geht es dir?", "Ich verstehe nicht", "Wie viel kostet das?", "Wo ist die Toilette?", "Ich heiße…", "Gut", "Eins", "Zwei", "Drei"],
    },
};

export const premadeDecks: PremadeDeck[] = Object.entries(TRANSLATIONS).map(([language, { name, words }]) => ({
    id: `${language}-basics`,
    language,
    name,
    description: "Greetings, polite words, questions and the numbers 1 to 3.",
    cards: words.map((learning, i) => ({ learning, meaning: BASICS[i] })),
}));
