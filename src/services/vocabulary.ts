import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCardFingerprint, getCardsForVocabulary, getMyText, getMyTexts, replaceCardKnownWords, saveBookAnalysis } from "../database/database";
import { analyzeText, spacedWords } from "../models/BookAnalysis";
import type { Analyzer } from "../models/language/types";
import { tokenize } from "../models/Tokens";
import { inDeckFromCards, knownFromCards } from "../models/Vocabulary";

const hasLetter = /\p{L}/u;

// The database allows one transaction at a time, so vocabulary jobs (a sync, an import's analysis,
// the library's catch-up) wait for each other instead of overlapping.
let queue: Promise<unknown> = Promise.resolve();
function inOrder<T>(job: () => Promise<T>): Promise<T> {
    const run = queue.then(job, job);
    queue = run.catch(() => undefined);
    return run;
}

/**
 * Brings the words the cards say are known up to date (a word is known when any card for it is
 * learned). Only the card-based rows change; words you marked yourself are left alone. Cheap enough
 * to run whenever the library opens, which keeps coverage right without hooks in every card edit.
 */
export const syncKnownWords = (language: string, analyzer: Analyzer): Promise<void> => inOrder(() => syncNow(language, analyzer));

/**
 * Like syncKnownWords, but only does the work when the cards or their progress changed since the last time
 * (so opening the library costs one small query). The analyzer is loaded only when it is needed, because for
 * some languages that is the slow part. Resolves to true when the known words were updated.
 */
export async function syncIfCardsChanged(language: string, loadAnalyzer: () => Promise<Analyzer>, salt = ""): Promise<boolean> {
    const key = `vocab-sync:${language}`;
    const now = `${await getCardFingerprint(language)}|${salt}`;
    if ((await AsyncStorage.getItem(key)) === now) return false;
    await syncKnownWords(language, await loadAnalyzer());
    await AsyncStorage.setItem(key, now);
    return true;
}

async function syncNow(language: string, analyzer: Analyzer): Promise<void> {
    const cards = await getCardsForVocabulary(language);
    const rows = cards.map((card) => {
        const words = analyzer.segmented ? spacedWords(card.text) : tokenize(card.text).filter((t) => t.word && hasLetter.test(t.text));
        // A phrase is not one word, so it says nothing about any single word.
        return { lemma: words.length === 1 ? analyzer.lemma(words[0].text).lemma : null, level: card.level, mastered: card.mastered };
    });
    await replaceCardKnownWords(language, knownFromCards(rows), inDeckFromCards(rows));
}

/** Reads a book once and stores how often each word occurs. Returns the number of words found. */
export const analyzeBook = (bookId: number, analyzer: Analyzer, onProgress?: (done: number, total: number) => void): Promise<number> => inOrder(() => analyzeNow(bookId, analyzer, onProgress));

async function analyzeNow(bookId: number, analyzer: Analyzer, onProgress?: (done: number, total: number) => void): Promise<number> {
    const book = await getMyText(bookId);
    if (!book || book.language !== analyzer.language) return 0;
    const stats = await analyzeText(book.body, analyzer, onProgress);
    await saveBookAnalysis(bookId, analyzer.version, stats.total, stats.lemmas);
    return stats.total;
}

/** Analyses every book of the language that has not been analysed with this version of the rules. */
export const analyzeNewBooks = (language: string, analyzer: Analyzer, onProgress?: (done: number, total: number) => void): Promise<void> =>
    inOrder(async () => {
        for (const book of await getMyTexts(language)) {
            if (book.analyzerVersion !== analyzer.version) await analyzeNow(book.id, analyzer, onProgress);
        }
    });
