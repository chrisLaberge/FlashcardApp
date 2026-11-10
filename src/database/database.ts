import { CardProgress } from "@/models/CardProgress";
import {
    deserializeFsrsCard,
    isMastered,
    migrateLegacyFsrsCard,
    scheduleFsrsReview,
    serializeFsrsCard,
} from "@/models/FsrsScheduler";
import * as SQLite from "expo-sqlite";
import { Card } from "../models/Card";
import { parseStoredExplanation, type Explanation } from "../models/Explanation";
import type { AddedWord } from "../models/AddedWords";
import { parseStoredLookup, type Lookup } from "../models/Lookup";
import { clampLevel, MASTERED_START_LEVEL, nextLevel } from "../models/StudyMode";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * The connection is shared through a memoised *promise*, so callers that arrive while the
 * database is still opening (e.g. two screens mounting together) all wait for the same
 * connection instead of each opening and initialising their own. A failed start is not
 * cached, so the next call retries.
 */
function getDatabase(): Promise<SQLite.SQLiteDatabase> {
    dbPromise ??= openAndPrepareDatabase().catch((error) => {
        dbPromise = null;
        throw error;
    });
    return dbPromise;
}

async function openAndPrepareDatabase(): Promise<SQLite.SQLiteDatabase> {
    const db = await SQLite.openDatabaseAsync("flashcards.db");
    try {
        await db.execAsync(`
            PRAGMA foreign_keys = ON;
            CREATE TABLE IF NOT EXISTS decks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                language TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                provider_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                thumbnail_path TEXT,
                page_url TEXT,
                photographer TEXT,
                photographer_url TEXT,
                local_path TEXT,
                UNIQUE(source, provider_id)
            );
            CREATE TABLE IF NOT EXISTS cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deck_id INTEGER NOT NULL,
                learning_text TEXT NOT NULL,
                localized_text TEXT NOT NULL,
                example_sentence TEXT,
                romanization TEXT,
                image_id INTEGER,
                FOREIGN KEY(deck_id) REFERENCES decks(id) ON DELETE CASCADE,
                FOREIGN KEY(image_id) REFERENCES images(id) ON DELETE SET NULL
            );
            CREATE TABLE IF NOT EXISTS card_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id INTEGER NOT NULL UNIQUE,
                review_count INTEGER NOT NULL DEFAULT 0,
                next_review_at INTEGER,
                mastered INTEGER NOT NULL DEFAULT 0,
                fsrs_card TEXT,
                last_review_at INTEGER,
                level INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE
            );
            -- One row per answer. Kept even after a card or deck is deleted, so history (time spent,
            -- streaks, stats) is never lost. There is deliberately no foreign key.
            CREATE TABLE IF NOT EXISTS review_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id INTEGER NOT NULL,
                deck_id INTEGER,
                reviewed_at INTEGER NOT NULL,
                correct INTEGER NOT NULL,
                level_before INTEGER NOT NULL,
                level_after INTEGER NOT NULL,
                prompt TEXT,
                duration_ms INTEGER,
                due_at INTEGER
            );
            -- When each card was added (for the "cards added" calendar and achievements). Like review_log it
            -- survives deleting the card, and has no foreign key. Cards added before this existed have no row.
            CREATE TABLE IF NOT EXISTS card_add_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id INTEGER NOT NULL,
                added_at INTEGER NOT NULL
            );
            -- Achievement tiers already awarded (and their bonus XP). Permanent: undoing a review or deleting
            -- cards never takes an achievement back.
            CREATE TABLE IF NOT EXISTS achievement_unlocks (
                track TEXT NOT NULL,
                tier INTEGER NOT NULL,
                unlocked_at INTEGER NOT NULL,
                PRIMARY KEY (track, tier)
            );
            -- AI explanations kept on the phone, so each card is asked about once and works offline.
            CREATE TABLE IF NOT EXISTS card_explanations (
                card_id INTEGER PRIMARY KEY,
                signature TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE
            );
            -- Dictionary entries for words tapped while reviewing, kept so the same tap is never asked twice.
            CREATE TABLE IF NOT EXISTS word_lookups (
                key TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            -- The pet and the shop. Gems are never stored as a balance: what you earned comes from the
            -- review log, and this ledger holds only what was spent (and refunded).
            CREATE TABLE IF NOT EXISTS pet_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS shop_inventory (
                item_id TEXT PRIMARY KEY,
                acquired_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS shop_ledger (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id TEXT NOT NULL,
                gems INTEGER NOT NULL,
                kind TEXT NOT NULL,
                at INTEGER NOT NULL
            );
            -- Texts the person added from a PDF, to read with tap-a-word lookups.
            CREATE TABLE IF NOT EXISTS my_texts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                language TEXT NOT NULL,
                body TEXT NOT NULL,
                added_at INTEGER NOT NULL
            );
            -- The words you know, per language, by dictionary form (lemma). Kept apart from card review
            -- scheduling. known = 0 is a word you said you do not know (it beats what the cards say).
            CREATE TABLE IF NOT EXISTS known_words (
                language TEXT NOT NULL,
                lemma TEXT NOT NULL,
                known INTEGER NOT NULL,
                source TEXT NOT NULL,
                PRIMARY KEY (language, lemma)
            );
            -- Every word of an analysed book with how often it occurs, known or not.
            CREATE TABLE IF NOT EXISTS book_vocab (
                book_id INTEGER NOT NULL,
                lemma TEXT NOT NULL,
                count INTEGER NOT NULL,
                sample TEXT NOT NULL,
                PRIMARY KEY (book_id, lemma),
                FOREIGN KEY(book_id) REFERENCES my_texts(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_book_vocab_lemma ON book_vocab(lemma);
            CREATE INDEX IF NOT EXISTS idx_card_add_log_time ON card_add_log(added_at);
            CREATE INDEX IF NOT EXISTS idx_review_log_time ON review_log(reviewed_at);
            CREATE INDEX IF NOT EXISTS idx_review_log_card ON review_log(card_id);
            CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id);
            CREATE INDEX IF NOT EXISTS idx_progress_due ON card_progress(next_review_at);
        `);

        // Idempotent migration for databases created before FSRS columns existed.
        const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(card_progress)");
        if (!columns.some((column) => column.name === "fsrs_card")) {
            await db.execAsync("ALTER TABLE card_progress ADD COLUMN fsrs_card TEXT");
        }
        if (!columns.some((column) => column.name === "last_review_at")) {
            await db.execAsync("ALTER TABLE card_progress ADD COLUMN last_review_at INTEGER");
        }

        // Study levels (additive). Cards that were already mastered start at a mixed level instead of
        // being shown as brand-new recognition cards; everything else starts at level 0.
        if (!columns.some((column) => column.name === "level")) {
            await db.execAsync(`
                ALTER TABLE card_progress ADD COLUMN level INTEGER NOT NULL DEFAULT 0;
                UPDATE card_progress SET level = ${MASTERED_START_LEVEL} WHERE mastered = 1;
            `);
        }

        // Books remember how many words they have and which analyser version counted them (additive).
        const textColumns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(my_texts)");
        if (!textColumns.some((column) => column.name === "total_tokens")) {
            await db.execAsync("ALTER TABLE my_texts ADD COLUMN total_tokens INTEGER");
        }
        if (!textColumns.some((column) => column.name === "analyzer_version")) {
            await db.execAsync("ALTER TABLE my_texts ADD COLUMN analyzer_version INTEGER");
        }

        // Images are also kept on the phone (additive).
        const imageColumns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(images)");
        if (!imageColumns.some((column) => column.name === "local_path")) {
            await db.execAsync("ALTER TABLE images ADD COLUMN local_path TEXT");
        }

        // Ensure every card has a progress row, including cards created by older app versions.
        await db.runAsync(`
            INSERT OR IGNORE INTO card_progress (card_id)
            SELECT id FROM cards
        `);
    } catch (error) {
        await db.closeAsync().catch(() => undefined);
        throw error;
    }
    return db;
}

type CardRow = {
    id: number;
    learning_text: string;
    localized_text: string;
    example_sentence: string | null;
    romanization: string | null;
    level?: number;
};

function mapCard(row: CardRow): Card {
    return new Card(
        row.learning_text,
        row.localized_text,
        row.example_sentence ?? "",
        row.romanization ?? "",
        row.id,
        row.level === undefined ? undefined : clampLevel(row.level),
    );
}

/* CARDS */
export async function getCards(deckId: number): Promise<Card[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<CardRow>("SELECT id, learning_text, localized_text, example_sentence, romanization FROM cards WHERE deck_id = ?", deckId);
    return rows.map(mapCard);
}

export async function getCardsPage(deckId: number, limit: number, offset: number, search = ""): Promise<Card[]> {
    const database = await getDatabase();
    const term = `%${search.trim()}%`;
    const rows = await database.getAllAsync<CardRow & { next_review_at: number | null }>(`
        SELECT c.id, c.learning_text, c.localized_text, c.example_sentence, c.romanization, p.next_review_at
        FROM cards c LEFT JOIN card_progress p ON p.card_id = c.id
        WHERE c.deck_id = ?
          AND (? = '' OR c.learning_text LIKE ? OR c.localized_text LIKE ? OR COALESCE(c.example_sentence, '') LIKE ?)
        ORDER BY c.id LIMIT ? OFFSET ?
    `, deckId, search.trim(), term, term, term, limit, offset);
    return rows.map((row) => {
        const card = mapCard(row);
        if (row.next_review_at) card.nextReviewAt = row.next_review_at;
        return card;
    });
}

/** `logAdd: false` keeps cards that came ready-made (starter decks) out of the "words added" history. */
export async function addCard(learningText: string, localizedText: string, exampleSentence: string, romanization: string, deckId: number, options: { logAdd?: boolean } = {}) {
    const database = await getDatabase();
    const result = await database.runAsync(`
        INSERT INTO cards (learning_text, localized_text, example_sentence, romanization, deck_id)
        VALUES (?, ?, ?, ?, ?)
    `, learningText, localizedText, exampleSentence, romanization, deckId);
    await database.runAsync("INSERT OR IGNORE INTO card_progress (card_id) VALUES (?)", result.lastInsertRowId);
    if (options.logAdd !== false) {
        await database.runAsync("INSERT INTO card_add_log (card_id, added_at) VALUES (?, ?)", result.lastInsertRowId, Date.now());
    }
    return result.lastInsertRowId;
}

export async function deleteCard(id: number) {
    const database = await getDatabase();
    await database.runAsync("DELETE FROM cards WHERE id = ?", id);
}

export async function updateCard(id: number, learningText: string, localizedText: string, exampleSentence: string, romanization: string) {
    const database = await getDatabase();
    await database.runAsync(`
        UPDATE cards SET learning_text = ?, localized_text = ?, example_sentence = ?, romanization = ?
        WHERE id = ?
    `, learningText, localizedText, exampleSentence, romanization, id);
}

export async function getCard(id: number): Promise<Card | undefined> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<CardRow>("SELECT id, learning_text, localized_text, example_sentence, romanization FROM cards WHERE id = ?", id);
    return row ? mapCard(row) : undefined;
}

export async function findDuplicateCard(learningText: string, deckId: number) {
    const database = await getDatabase();
    return database.getFirstAsync(
        `SELECT * FROM cards WHERE deck_id = ? AND LOWER(TRIM(learning_text)) = LOWER(TRIM(?))`,
        deckId, learningText,
    );
}

/* IMAGES */
export type CardImage = {
    id: number;
    source: string;
    provider_id: string;
    file_path: string;
    thumbnail_path: string | null;
    page_url: string | null;
    photographer: string | null;
    photographer_url: string | null;
    /** Where a copy of the picture is stored on this phone (null until it has been downloaded). */
    local_path: string | null;
};

export async function addImage(source: string, providerId: string, filePath: string, thumbnailPath: string | null, pageUrl: string | null, photographer: string | null, photographerUrl: string | null): Promise<number> {
    const database = await getDatabase();
    const existing = await database.getFirstAsync<{ id: number }>(
        "SELECT id FROM images WHERE source = ? AND provider_id = ?", source, providerId,
    );
    if (existing) return existing.id;
    const result = await database.runAsync(`
        INSERT INTO images (source, provider_id, file_path, thumbnail_path, page_url, photographer, photographer_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, source, providerId, filePath, thumbnailPath, pageUrl, photographer, photographerUrl);
    return result.lastInsertRowId;
}

/** Remembers where the downloaded copy of an image lives on the phone. */
export async function setImageLocalPath(imageId: number, localPath: string | null) {
    const database = await getDatabase();
    await database.runAsync("UPDATE images SET local_path = ? WHERE id = ?", localPath, imageId);
}

/** Images that are used by a card but have no copy on the phone yet. */
export async function getImagesWithoutLocalCopy(): Promise<CardImage[]> {
    const database = await getDatabase();
    return database.getAllAsync<CardImage>(`
        SELECT * FROM images WHERE local_path IS NULL
          AND id IN (SELECT image_id FROM cards WHERE image_id IS NOT NULL)
        ORDER BY id
    `);
}

export async function getImage(imageId: number): Promise<CardImage | undefined> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<CardImage>("SELECT * FROM images WHERE id = ?", imageId);
    return row ?? undefined;
}

export async function getImageByProvider(source: string, providerId: string): Promise<CardImage | undefined> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<CardImage>("SELECT * FROM images WHERE source = ? AND provider_id = ?", source, providerId);
    return row ?? undefined;
}

export async function setCardImage(cardId: number, imageId: number) {
    const database = await getDatabase();
    await database.runAsync("UPDATE cards SET image_id = ? WHERE id = ?", imageId, cardId);
}

export async function removeCardImage(cardId: number) {
    const database = await getDatabase();
    await database.runAsync("UPDATE cards SET image_id = NULL WHERE id = ?", cardId);
}

export async function getCardImage(cardId: number): Promise<CardImage | undefined> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<CardImage>(`
        SELECT images.* FROM cards JOIN images ON cards.image_id = images.id WHERE cards.id = ?
    `, cardId);
    return row ?? undefined;
}

/* CARD PROGRESS */
type ProgressRow = {
    id: number;
    card_id: number;
    review_count: number;
    next_review_at: number | null;
    mastered: number;
    fsrs_card: string | null;
    last_review_at: number | null;
    level: number;
};

export async function resetCardProgress(cardId: number) {
    const database = await getDatabase();
    await database.runAsync(`
        UPDATE card_progress SET review_count = 0, next_review_at = NULL, mastered = 0,
            fsrs_card = NULL, last_review_at = NULL WHERE card_id = ?
    `, cardId);
}

export async function getCardProgress(cardId: number): Promise<CardProgress | undefined> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<ProgressRow>("SELECT * FROM card_progress WHERE card_id = ?", cardId);
    if (!row) return undefined;
    return new CardProgress(
        row.card_id, row.review_count, row.next_review_at ?? undefined,
        row.mastered === 1, row.id, row.fsrs_card ?? undefined,
        row.last_review_at ?? undefined,
        clampLevel(row.level),
    );
}

/** Legacy progress updates used by CSV import and existing callers. Omitted FSRS values are preserved. */
export async function updateCardProgress(cardId: number, reviewCount: number, nextReviewAt: number | undefined, mastered: boolean, fsrsCard?: string, lastReviewAt?: number, level?: number) {
    const database = await getDatabase();
    await database.runAsync(`
        UPDATE card_progress SET review_count = ?, next_review_at = ?, mastered = ?,
            fsrs_card = COALESCE(?, fsrs_card), last_review_at = COALESCE(?, last_review_at),
            level = COALESCE(?, level)
        WHERE card_id = ?
    `, reviewCount, nextReviewAt ?? null, mastered ? 1 : 0, fsrsCard ?? null, lastReviewAt ?? null, level ?? null, cardId);
}

/** Exact restore for the Learn screen's Undo action. */
export async function restoreCardProgress(progress: CardProgress) {
    const database = await getDatabase();
    await database.runAsync(`
        UPDATE card_progress SET review_count = ?, next_review_at = ?, mastered = ?,
            fsrs_card = ?, last_review_at = ?, level = ? WHERE card_id = ?
    `, progress.reviewCount, progress.nextReviewAt ?? null, progress.mastered ? 1 : 0,
        progress.fsrsCard ?? null, progress.lastReviewAt ?? null, clampLevel(progress.level), progress.cardId);
}

/** What the learn screen knows about an answer, kept in the review log. */
export type ReviewInfo = {
    /** What the front of the card showed: the word, the meaning, or only the sound. */
    prompt?: "learning" | "localized" | "audio";
    /** How long the card was on screen before it was answered. */
    durationMs?: number;
};

/** A single answer is never counted as more than this (an app left open must not inflate study time). */
export const MAX_REVIEW_DURATION_MS = 60_000;

/** Saves the answer and its log entry together, and returns the card's new study level. */
async function reviewCard(cardId: number, direction: "left" | "right", info: ReviewInfo = {}): Promise<number | undefined> {
    const database = await getDatabase();
    let newLevel: number | undefined;
    await database.withTransactionAsync(async () => {
        newLevel = await applyReview(cardId, direction, info);
    });
    return newLevel;
}

/** Undo: puts the card's progress back exactly as it was and removes the answer from the review log. */
export async function undoCardReview(progress: CardProgress) {
    const database = await getDatabase();
    await database.withTransactionAsync(async () => {
        await restoreCardProgress(progress);
        await database.runAsync(
            "DELETE FROM review_log WHERE id = (SELECT MAX(id) FROM review_log WHERE card_id = ?)",
            progress.cardId,
        );
    });
}

export type ReviewLogEntry = {
    cardId: number;
    deckId: number | null;
    reviewedAt: number;
    correct: boolean;
    durationMs: number | null;
    prompt: string | null;
};

/** Answers since a point in time (default: all), oldest first. Feeds streaks, stats and time spent. */
export async function getReviewLog(sinceMs = 0, deckId?: number): Promise<ReviewLogEntry[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<{
        card_id: number; deck_id: number | null; reviewed_at: number; correct: number;
        duration_ms: number | null; prompt: string | null;
    }>(`
        SELECT card_id, deck_id, reviewed_at, correct, duration_ms, prompt FROM review_log
        WHERE reviewed_at >= ? AND (? IS NULL OR deck_id = ?)
        ORDER BY reviewed_at, id
    `, sinceMs, deckId ?? null, deckId ?? null);
    return rows.map((row) => ({
        cardId: row.card_id,
        deckId: row.deck_id,
        reviewedAt: row.reviewed_at,
        correct: row.correct === 1,
        durationMs: row.duration_ms,
        prompt: row.prompt,
    }));
}

/** The saved explanation for a card, or null if there is none or the card's words changed since. */
export async function getCardExplanation(cardId: number, signature: string): Promise<Explanation | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ signature: string; data: string }>(
        "SELECT signature, data FROM card_explanations WHERE card_id = ?", cardId,
    );
    return row && row.signature === signature ? parseStoredExplanation(row.data) : null;
}

export async function saveCardExplanation(cardId: number, signature: string, explanation: Explanation): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
        "INSERT OR REPLACE INTO card_explanations (card_id, signature, data, created_at) VALUES (?, ?, ?, ?)",
        cardId, signature, JSON.stringify(explanation), Date.now(),
    );
}

export async function getWordLookup(key: string): Promise<Lookup | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ data: string }>("SELECT data FROM word_lookups WHERE key = ?", key);
    return row ? parseStoredLookup(row.data) : null;
}

const MAX_SAVED_LOOKUPS = 500;

/** Keeps the entry; the oldest ones go once there are more than MAX_SAVED_LOOKUPS. */
export async function saveWordLookup(key: string, lookup: Lookup): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
        "INSERT OR REPLACE INTO word_lookups (key, data, created_at) VALUES (?, ?, ?)",
        key, JSON.stringify(lookup), Date.now(),
    );
    await database.runAsync(
        "DELETE FROM word_lookups WHERE key NOT IN (SELECT key FROM word_lookups ORDER BY created_at DESC LIMIT ?)",
        MAX_SAVED_LOOKUPS,
    );
}

export type AchievementUnlock = { track: string; tier: number; unlockedAt: number };

export async function getAchievementUnlocks(): Promise<AchievementUnlock[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<{ track: string; tier: number; unlocked_at: number }>(
        "SELECT track, tier, unlocked_at FROM achievement_unlocks ORDER BY unlocked_at, track, tier",
    );
    return rows.map((row) => ({ track: row.track, tier: row.tier, unlockedAt: row.unlocked_at }));
}

/** Records newly earned tiers. Ones already recorded are left alone, so this can safely be repeated. */
export async function recordAchievementUnlocks(unlocks: readonly { track: string; tier: number }[], atMs = Date.now()): Promise<void> {
    if (unlocks.length === 0) return;
    const database = await getDatabase();
    await database.withTransactionAsync(async () => {
        for (const unlock of unlocks) {
            await database.runAsync(
                "INSERT OR IGNORE INTO achievement_unlocks (track, tier, unlocked_at) VALUES (?, ?, ?)",
                unlock.track, unlock.tier, atMs,
            );
        }
    });
}

export type CardsAdded = {
    /** When each card was added, oldest first. */
    addedAt: number[];
    /** Cards that exist but were added before dates were recorded: counted in totals, not on the calendar. */
    undated: number;
};

export async function getCardsAdded(): Promise<CardsAdded> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<{ added_at: number }>("SELECT added_at FROM card_add_log ORDER BY added_at, id");
    const undated = await database.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM cards WHERE id NOT IN (SELECT card_id FROM card_add_log)",
    );
    return { addedAt: rows.map((row) => row.added_at), undated: undated?.n ?? 0 };
}

/** The newest words still in the app that were added, newest first (a deleted card is gone from the list). */
export async function getAddedWords(limit = 500): Promise<AddedWord[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<{ id: number; learning_text: string; localized_text: string; deck_name: string | null; added_at: number }>(`
        SELECT cards.id, cards.learning_text, cards.localized_text, decks.name AS deck_name, card_add_log.added_at
        FROM card_add_log
        JOIN cards ON cards.id = card_add_log.card_id
        LEFT JOIN decks ON decks.id = cards.deck_id
        ORDER BY card_add_log.added_at DESC, card_add_log.id DESC
        LIMIT ?
    `, limit);
    return rows.map((r) => ({ id: r.id, learningText: r.learning_text, localizedText: r.localized_text, deckName: r.deck_name ?? "", addedAt: r.added_at }));
}

async function applyReview(cardId: number, direction: "left" | "right", info: ReviewInfo): Promise<number | undefined> {
    const progress = await getCardProgress(cardId);
    if (!progress) return undefined;

    const now = new Date();
    const fsrsCard = progress.fsrsCard
        ? deserializeFsrsCard(progress.fsrsCard)
        : migrateLegacyFsrsCard(progress.reviewCount, progress.nextReviewAt, now);
    const result = scheduleFsrsReview(fsrsCard, direction, now);
    const scheduledCard = result.card;
    const dueTime = scheduledCard.due instanceof Date
        ? scheduledCard.due.getTime()
        : new Date(scheduledCard.due).getTime();
    const nextReviewCount = progress.reviewCount + 1;
    const level = nextLevel(progress.level, direction);

    await updateCardProgress(
        cardId,
        nextReviewCount,
        dueTime,
        isMastered(scheduledCard),
        serializeFsrsCard(scheduledCard),
        now.getTime(),
        level,
    );

    const database = await getDatabase();
    const deck = await database.getFirstAsync<{ deck_id: number }>("SELECT deck_id FROM cards WHERE id = ?", cardId);
    const duration = info.durationMs === undefined
        ? null
        : Math.round(Math.min(Math.max(info.durationMs, 0), MAX_REVIEW_DURATION_MS));
    await database.runAsync(`
        INSERT INTO review_log (card_id, deck_id, reviewed_at, correct, level_before, level_after, prompt, duration_ms, due_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, cardId, deck?.deck_id ?? null, now.getTime(), direction === "right" ? 1 : 0,
        progress.level, level, info.prompt ?? null, duration, dueTime);
    return level;
}

export async function markCardCorrect(cardId: number, info?: ReviewInfo) {
    return reviewCard(cardId, "right", info);
}

export async function markCardIncorrect(cardId: number, info?: ReviewInfo) {
    return reviewCard(cardId, "left", info);
}

/**
 * The ONE definition of "due", used by the learn queue and every count so they cannot
 * disagree. A card is due when it has never been scheduled or its due time has passed.
 * "Mastered" has no say: a mastered card that comes due is reviewed like any other.
 * Takes one bound parameter: the current time in ms.
 */
const IS_DUE = "(card_progress.next_review_at IS NULL OR card_progress.next_review_at <= ?)";

/**
 * Cards that already have a schedule come first (oldest due first); never-scheduled cards
 * follow. Without this, thousands of freshly imported cards would starve overdue reviews
 * once the learn screen loads cards in batches.
 */
const DUE_ORDER = "card_progress.next_review_at IS NULL, card_progress.next_review_at, cards.id";

/** Due cards in review order. `limit` caps how many are loaded (default: all). */
export async function getDueCards(deckId: number, limit?: number): Promise<Card[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<CardRow>(`
        SELECT cards.id, cards.learning_text, cards.localized_text, cards.example_sentence, cards.romanization,
            card_progress.level
        FROM cards JOIN card_progress ON cards.id = card_progress.card_id
        WHERE cards.deck_id = ? AND ${IS_DUE}
        ORDER BY ${DUE_ORDER}
        LIMIT ?
    `, deckId, Date.now(), limit ?? -1);
    return rows.map(mapCard);
}

/** Ids only, in review order: the cheap query the learn screen runs every few seconds. */
export async function getDueCardIds(deckId: number, limit: number): Promise<number[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<{ id: number }>(`
        SELECT cards.id
        FROM cards JOIN card_progress ON cards.id = card_progress.card_id
        WHERE cards.deck_id = ? AND ${IS_DUE}
        ORDER BY ${DUE_ORDER}
        LIMIT ?
    `, deckId, Date.now(), limit);
    return rows.map((row) => row.id);
}

/** Full cards for the given ids, in the order given. Ids that no longer exist are skipped. */
export async function getCardsByIds(ids: number[]): Promise<Card[]> {
    if (ids.length === 0) return [];
    const database = await getDatabase();
    const byId = new Map<number, Card>();
    const CHUNK = 400; // stays well below SQLite's bound-variable limit
    for (let start = 0; start < ids.length; start += CHUNK) {
        const chunk = ids.slice(start, start + CHUNK);
        const rows = await database.getAllAsync<CardRow>(
            `SELECT cards.id, cards.learning_text, cards.localized_text, cards.example_sentence, cards.romanization,
                    card_progress.level
             FROM cards LEFT JOIN card_progress ON cards.id = card_progress.card_id
             WHERE cards.id IN (${chunk.map(() => "?").join(",")})`,
            ...chunk,
        );
        for (const row of rows) byId.set(row.id, mapCard(row));
    }
    return ids.flatMap((id) => byId.get(id) ?? []);
}

export async function getDueCardCount(): Promise<number> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ count: number }>(`
        SELECT COUNT(*) AS count FROM cards JOIN card_progress ON cards.id = card_progress.card_id
        WHERE ${IS_DUE}
    `, Date.now());
    return row?.count ?? 0;
}

/**
 * Splits a deck into three groups that always add up to the deck size (the home screen
 * draws them as one proportional bar):
 *  - due:       every card that is due now (new, overdue, or a mastered card that came due)
 *  - practiced: scheduled for later and not mastered
 *  - mastered:  scheduled for later and mastered
 */
export async function getProgressCounts(deckId: number): Promise<{ due: number; practiced: number; mastered: number }> {
    const database = await getDatabase();
    const now = Date.now();
    const row = await database.getFirstAsync<{ due: number | null; practiced: number | null; mastered: number | null }>(`
        SELECT
          SUM(CASE WHEN ${IS_DUE} THEN 1 ELSE 0 END) AS due,
          SUM(CASE WHEN NOT ${IS_DUE} AND card_progress.mastered = 0 THEN 1 ELSE 0 END) AS practiced,
          SUM(CASE WHEN NOT ${IS_DUE} AND card_progress.mastered = 1 THEN 1 ELSE 0 END) AS mastered
        FROM cards JOIN card_progress ON cards.id = card_progress.card_id WHERE cards.deck_id = ?
    `, now, now, now, deckId);
    return { due: row?.due ?? 0, practiced: row?.practiced ?? 0, mastered: row?.mastered ?? 0 };
}

/* DECKS */
export async function addDeck(name: string, language: string) {
    const database = await getDatabase();
    const result = await database.runAsync("INSERT INTO decks (name, language) VALUES (?, ?)", name, language);
    return result.lastInsertRowId;
}

/** Every deck with its number of cards and how many of them are due for review right now. */
export async function getDecks() {
    const database = await getDatabase();
    return database.getAllAsync<{ id: number; name: string; language: string; card_count: number; due_count: number }>(`
        SELECT decks.id, decks.name, decks.language, COUNT(cards.id) AS card_count,
            COALESCE(SUM(CASE WHEN card_progress.card_id IS NOT NULL AND ${IS_DUE} THEN 1 ELSE 0 END), 0) AS due_count
        FROM decks
        LEFT JOIN cards ON cards.deck_id = decks.id
        LEFT JOIN card_progress ON card_progress.card_id = cards.id
        GROUP BY decks.id ORDER BY decks.id
    `, Date.now());
}

export async function deleteDeck(id: number) {
    const database = await getDatabase();
    await database.runAsync("DELETE FROM decks WHERE id = ?", id);
}

/* RESTORE FROM A BACKUP */

/** The part of a database that restoring reads from (an opened backup file). */
export type RestoreSource = {
    getAllAsync<T>(sql: string, ...params: SQLite.SQLiteBindParams[]): Promise<T[]>;
};

export type RestoreResult = {
    decks: number;
    cards: number;
    images: number;
    reviews: number;
};

export class RestoreError extends Error {}

const RESTORE_TABLES = ["decks", "images", "cards", "card_progress", "review_log", "card_add_log", "achievement_unlocks"] as const;

async function columnNames(db: RestoreSource, table: string): Promise<string[]> {
    const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    return rows.map((row) => row.name);
}

/**
 * Copies a backup (made by the Export button, from this or an older version of the app) into this
 * app's database.
 *
 * It only works on an EMPTY app, so existing cards and progress can never be overwritten or
 * mixed up. Ids are kept, so progress and review history still point at the right cards.
 * Backups from older versions are accepted: columns they lack (study level, review log, ...)
 * are filled in with sensible values. All or nothing: if anything fails, nothing is restored.
 */
export async function restoreFromBackup(source: RestoreSource): Promise<RestoreResult> {
    const database = await getDatabase();

    const existing = await database.getFirstAsync<{ n: number }>(
        "SELECT (SELECT COUNT(*) FROM decks) + (SELECT COUNT(*) FROM cards) AS n",
    );
    if ((existing?.n ?? 0) > 0) {
        throw new RestoreError(
            "This app already has decks or cards. A backup can only be restored into an empty app, so nothing here is overwritten.",
        );
    }

    const tables = (await source.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table'",
    )).map((row) => row.name);
    if (!tables.includes("decks") || !tables.includes("cards")) {
        throw new RestoreError("This file is not a flashcard backup.");
    }

    const sourceHadLevels = tables.includes("card_progress")
        && (await columnNames(source, "card_progress")).includes("level");

    const result: RestoreResult = { decks: 0, cards: 0, images: 0, reviews: 0 };

    await database.withTransactionAsync(async () => {
        // Rows are copied table by table; references are checked once everything is in.
        await database.execAsync("PRAGMA defer_foreign_keys = ON");

        for (const table of RESTORE_TABLES) {
            if (!tables.includes(table)) continue;

            const targetColumns = await columnNames(database, table);
            // The old copy of the picture file lives in another app's storage: forget it, it is downloaded again.
            const columns = (await columnNames(source, table)).filter(
                (name) => targetColumns.includes(name) && !(table === "images" && name === "local_path"),
            );
            if (columns.length === 0) continue;

            const rows = await source.getAllAsync<Record<string, SQLite.SQLiteBindValue>>(
                `SELECT ${columns.join(", ")} FROM ${table}`,
            );
            const insert = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
            for (const row of rows) {
                await database.runAsync(insert, ...columns.map((name) => row[name] ?? null));
            }

            if (table === "decks") result.decks = rows.length;
            if (table === "cards") result.cards = rows.length;
            if (table === "images") result.images = rows.length;
            if (table === "review_log") result.reviews = rows.length;
        }

        // Tidy references that point at something the backup did not contain.
        await database.execAsync(`
            DELETE FROM card_progress WHERE card_id NOT IN (SELECT id FROM cards);
            UPDATE cards SET image_id = NULL WHERE image_id IS NOT NULL AND image_id NOT IN (SELECT id FROM images);
            INSERT OR IGNORE INTO card_progress (card_id) SELECT id FROM cards;
        `);
        const orphanCards = await database.getFirstAsync<{ n: number }>(
            "SELECT COUNT(*) AS n FROM cards WHERE deck_id NOT IN (SELECT id FROM decks)",
        );
        if ((orphanCards?.n ?? 0) > 0) {
            await database.execAsync("DELETE FROM cards WHERE deck_id NOT IN (SELECT id FROM decks)");
            result.cards -= orphanCards?.n ?? 0;
        }

        // A backup from before study levels: well-known cards start at a mixed level, like an upgrade.
        if (!sourceHadLevels) {
            await database.runAsync("UPDATE card_progress SET level = ? WHERE mastered = 1", MASTERED_START_LEVEL);
        }
    });

    return result;
}

/** Returns a complete, consistent snapshot of the database as bytes (read-only). */
export async function serializeDatabase(): Promise<Uint8Array> {
    const database = await getDatabase();
    return database.serializeAsync();
}

/* ------------------------------- pet and shop ------------------------------- */

export async function getPetState(): Promise<Record<string, string>> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM pet_state");
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function setPetState(key: string, value: string | null): Promise<void> {
    const database = await getDatabase();
    if (value === null) await database.runAsync("DELETE FROM pet_state WHERE key = ?", key);
    else await database.runAsync("INSERT OR REPLACE INTO pet_state (key, value) VALUES (?, ?)", key, value);
}

export async function getInventory(): Promise<string[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<{ item_id: string }>("SELECT item_id FROM shop_inventory ORDER BY acquired_at, item_id");
    return rows.map((row) => row.item_id);
}

export type LedgerEntry = { itemId: string; gems: number; kind: string; at: number };

export async function getLedger(): Promise<LedgerEntry[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<{ item_id: string; gems: number; kind: string; at: number }>(
        "SELECT item_id, gems, kind, at FROM shop_ledger ORDER BY id",
    );
    return rows.map((row) => ({ itemId: row.item_id, gems: row.gems, kind: row.kind, at: row.at }));
}

/**
 * One shop action, saved together: the ledger entries (what it cost, any refund) and the item
 * added to the inventory. Either all of it is saved or none.
 */
export async function recordShopAction(action: { ledger: readonly Omit<LedgerEntry, "at">[]; addItem?: string }, atMs = Date.now()): Promise<void> {
    const database = await getDatabase();
    await database.withTransactionAsync(async () => {
        for (const entry of action.ledger) {
            await database.runAsync("INSERT INTO shop_ledger (item_id, gems, kind, at) VALUES (?, ?, ?, ?)", entry.itemId, entry.gems, entry.kind, atMs);
        }
        if (action.addItem) {
            await database.runAsync("INSERT OR IGNORE INTO shop_inventory (item_id, acquired_at) VALUES (?, ?)", action.addItem, atMs);
        }
    });
}

export type MyText = { id: number; title: string; language: string; body: string; addedAt: number };

export async function addMyText(title: string, language: string, body: string, atMs = Date.now()): Promise<number> {
    const database = await getDatabase();
    const result = await database.runAsync("INSERT INTO my_texts (title, language, body, added_at) VALUES (?, ?, ?, ?)", title, language, body, atMs);
    return result.lastInsertRowId;
}

/** The titles of the added texts for a language, newest first (the body is loaded when one is opened). */
export async function getMyTexts(language: string): Promise<(Omit<MyText, "body"> & { analyzerVersion: number | null })[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<{ id: number; title: string; language: string; added_at: number; analyzer_version: number | null }>(
        "SELECT id, title, language, added_at, analyzer_version FROM my_texts WHERE language = ? ORDER BY added_at DESC, id DESC", language,
    );
    return rows.map((r) => ({ id: r.id, title: r.title, language: r.language, addedAt: r.added_at, analyzerVersion: r.analyzer_version }));
}

export async function getMyText(id: number): Promise<MyText | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ id: number; title: string; language: string; body: string; added_at: number }>(
        "SELECT id, title, language, body, added_at FROM my_texts WHERE id = ?", id,
    );
    return row ? { id: row.id, title: row.title, language: row.language, body: row.body, addedAt: row.added_at } : null;
}

export async function deleteMyText(id: number): Promise<void> {
    const database = await getDatabase();
    await database.runAsync("DELETE FROM book_vocab WHERE book_id = ?", id);
    await database.runAsync("DELETE FROM my_texts WHERE id = ?", id);
}

/* ---------------------------- Known words and books ---------------------------- */

export type BookSummary = { id: number; title: string; language: string; totalTokens: number | null; analyzerVersion: number | null; knownTokens: number };

/**
 * Sets what you say about a word: known, not known, or null to go back to what your cards say.
 * Coverage of every book follows automatically, because it is always counted from these rows.
 */
export async function setWordKnown(language: string, lemma: string, known: boolean | null): Promise<void> {
    const database = await getDatabase();
    if (known === null) {
        await database.runAsync("DELETE FROM known_words WHERE language = ? AND lemma = ? AND source = 'manual'", language, lemma);
        return;
    }
    await database.runAsync(
        "INSERT INTO known_words (language, lemma, known, source) VALUES (?, ?, ?, 'manual') ON CONFLICT(language, lemma) DO UPDATE SET known = excluded.known, source = 'manual'",
        language, lemma, known ? 1 : 0,
    );
}

/** The words the cards say are known, as of now. Manual choices are left alone; card-based ones are replaced. */
export async function replaceCardKnownWords(language: string, lemmas: ReadonlySet<string>): Promise<void> {
    const database = await getDatabase();
    await database.withTransactionAsync(async () => {
        await database.runAsync("DELETE FROM known_words WHERE language = ? AND source = 'card'", language);
        for (const lemma of lemmas) {
            await database.runAsync("INSERT OR IGNORE INTO known_words (language, lemma, known, source) VALUES (?, ?, 1, 'card')", language, lemma);
        }
    });
}

/** Every card of a language with its study progress (for working out which words the cards say are known). */
export async function getCardsForVocabulary(language: string): Promise<{ text: string; level: number; mastered: boolean }[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<{ learning_text: string; level: number | null; mastered: number | null }>(`
        SELECT c.learning_text, p.level, p.mastered
        FROM cards c JOIN decks d ON d.id = c.deck_id LEFT JOIN card_progress p ON p.card_id = c.id
        WHERE d.language = ?
    `, language);
    return rows.map((r) => ({ text: r.learning_text, level: r.level ?? 0, mastered: r.mastered === 1 }));
}

/** Saves a book's analysis in one go: the old counts are replaced and the totals set, or nothing changes. */
export async function saveBookAnalysis(bookId: number, version: number, total: number, lemmas: ReadonlyMap<string, { count: number; sample: string }>): Promise<void> {
    const database = await getDatabase();
    await database.withTransactionAsync(async () => {
        await database.runAsync("DELETE FROM book_vocab WHERE book_id = ?", bookId);
        for (const [lemma, entry] of lemmas) {
            await database.runAsync("INSERT INTO book_vocab (book_id, lemma, count, sample) VALUES (?, ?, ?, ?)", bookId, lemma, entry.count, entry.sample);
        }
        await database.runAsync("UPDATE my_texts SET total_tokens = ?, analyzer_version = ? WHERE id = ?", total, version, bookId);
    });
}

/** Books of a language with how many of their word occurrences you know. Counted fresh from the known words every time. */
export async function getBookSummaries(language: string): Promise<BookSummary[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<{ id: number; title: string; language: string; total_tokens: number | null; analyzer_version: number | null; known_tokens: number | null }>(`
        SELECT t.id, t.title, t.language, t.total_tokens, t.analyzer_version,
               (SELECT SUM(v.count) FROM book_vocab v JOIN known_words k ON k.language = t.language AND k.lemma = v.lemma AND k.known = 1 WHERE v.book_id = t.id) AS known_tokens
        FROM my_texts t WHERE t.language = ? ORDER BY t.added_at DESC, t.id DESC
    `, language);
    return rows.map((r) => ({ id: r.id, title: r.title, language: r.language, totalTokens: r.total_tokens, analyzerVersion: r.analyzer_version, knownTokens: r.known_tokens ?? 0 }));
}

export async function getBookSummary(id: number): Promise<BookSummary | null> {
    const row = await getMyText(id);
    if (!row) return null;
    return (await getBookSummaries(row.language)).find((b) => b.id === id) ?? null;
}

/** The words of a book you do not know yet, most frequent first. */
export async function getTopUnknown(bookId: number, limit = 100): Promise<{ lemma: string; count: number; sample: string }[]> {
    const database = await getDatabase();
    return database.getAllAsync<{ lemma: string; count: number; sample: string }>(`
        SELECT v.lemma, v.count, v.sample FROM book_vocab v JOIN my_texts t ON t.id = v.book_id
        LEFT JOIN known_words k ON k.language = t.language AND k.lemma = v.lemma
        WHERE v.book_id = ? AND COALESCE(k.known, 0) = 0
        ORDER BY v.count DESC, v.lemma LIMIT ?
    `, bookId, limit);
}
