import { getCardsForVocabulary, getMyText, getMyTexts, replaceCardKnownWords, saveBookAnalysis } from "../database/database";
import { analyzeText } from "../models/BookAnalysis";
import type { Analyzer } from "../models/language/types";
import { tokenize } from "../models/Tokens";
import { knownFromCards } from "../models/Vocabulary";

const hasLetter = /\p{L}/u;

/**
 * Brings the words the cards say are known up to date (a word is known when any card for it is
 * learned). Only the card-based rows change; words you marked yourself are left alone. Cheap enough
 * to run whenever the library opens, which keeps coverage right without hooks in every card edit.
 */
export async function syncKnownWords(language: string, analyzer: Analyzer): Promise<void> {
    const cards = await getCardsForVocabulary(language);
    const known = knownFromCards(cards.map((card) => {
        const words = tokenize(card.text).filter((t) => t.word && hasLetter.test(t.text));
        // A phrase is not one word, so it says nothing about any single word.
        return { lemma: words.length === 1 ? analyzer.lemma(words[0].text).lemma : null, level: card.level, mastered: card.mastered };
    }));
    await replaceCardKnownWords(language, known);
}

/** Reads a book once and stores how often each word occurs. Returns the number of words found. */
export async function analyzeBook(bookId: number, analyzer: Analyzer, onProgress?: (done: number, total: number) => void): Promise<number> {
    const book = await getMyText(bookId);
    if (!book || book.language !== analyzer.language) return 0;
    const stats = await analyzeText(book.body, analyzer, onProgress);
    await saveBookAnalysis(bookId, analyzer.version, stats.total, stats.lemmas);
    return stats.total;
}

/** Analyses every book of the language that has not been analysed with this version of the rules. */
export async function analyzeNewBooks(language: string, analyzer: Analyzer, onProgress?: (done: number, total: number) => void): Promise<void> {
    for (const book of await getMyTexts(language)) {
        if (book.analyzerVersion !== analyzer.version) await analyzeBook(book.id, analyzer, onProgress);
    }
}
