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
                FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE
            );
        `);

        // Idempotent migration for databases created before FSRS columns existed.
        const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(card_progress)");
        if (!columns.some((column) => column.name === "fsrs_card")) {
            await db.execAsync("ALTER TABLE card_progress ADD COLUMN fsrs_card TEXT");
        }
        if (!columns.some((column) => column.name === "last_review_at")) {
            await db.execAsync("ALTER TABLE card_progress ADD COLUMN last_review_at INTEGER");
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
};

function mapCard(row: CardRow): Card {
    return new Card(
        row.learning_text,
        row.localized_text,
        row.example_sentence ?? "",
        row.romanization ?? "",
        row.id,
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
    const rows = await database.getAllAsync<CardRow>(`
        SELECT id, learning_text, localized_text, example_sentence, romanization
        FROM cards WHERE deck_id = ?
          AND (? = '' OR learning_text LIKE ? OR localized_text LIKE ? OR COALESCE(example_sentence, '') LIKE ?)
        ORDER BY id LIMIT ? OFFSET ?
    `, deckId, search.trim(), term, term, term, limit, offset);
    return rows.map(mapCard);
}

export async function addCard(learningText: string, localizedText: string, exampleSentence: string, romanization: string, deckId: number) {
    const database = await getDatabase();
    const result = await database.runAsync(`
        INSERT INTO cards (learning_text, localized_text, example_sentence, romanization, deck_id)
        VALUES (?, ?, ?, ?, ?)
    `, learningText, localizedText, exampleSentence, romanization, deckId);
    await database.runAsync("INSERT OR IGNORE INTO card_progress (card_id) VALUES (?)", result.lastInsertRowId);
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
    );
}

/** Legacy progress updates used by CSV import and existing callers. Omitted FSRS values are preserved. */
export async function updateCardProgress(cardId: number, reviewCount: number, nextReviewAt: number | undefined, mastered: boolean, fsrsCard?: string, lastReviewAt?: number) {
    const database = await getDatabase();
    await database.runAsync(`
        UPDATE card_progress SET review_count = ?, next_review_at = ?, mastered = ?,
            fsrs_card = COALESCE(?, fsrs_card), last_review_at = COALESCE(?, last_review_at)
        WHERE card_id = ?
    `, reviewCount, nextReviewAt ?? null, mastered ? 1 : 0, fsrsCard ?? null, lastReviewAt ?? null, cardId);
}

/** Exact restore for the Learn screen's Undo action. */
export async function restoreCardProgress(progress: CardProgress) {
    const database = await getDatabase();
    await database.runAsync(`
        UPDATE card_progress SET review_count = ?, next_review_at = ?, mastered = ?,
            fsrs_card = ?, last_review_at = ? WHERE card_id = ?
    `, progress.reviewCount, progress.nextReviewAt ?? null, progress.mastered ? 1 : 0,
        progress.fsrsCard ?? null, progress.lastReviewAt ?? null, progress.cardId);
}

async function reviewCard(cardId: number, direction: "left" | "right") {
    const progress = await getCardProgress(cardId);
    if (!progress) return;

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

    await updateCardProgress(
        cardId,
        nextReviewCount,
        dueTime,
        isMastered(scheduledCard),
        serializeFsrsCard(scheduledCard),
        now.getTime(),
    );
}

export async function markCardCorrect(cardId: number) {
    await reviewCard(cardId, "right");
}

export async function markCardIncorrect(cardId: number) {
    await reviewCard(cardId, "left");
}

/**
 * The ONE definition of "due", used by the learn queue and every count so they cannot
 * disagree. A card is due when it has never been scheduled or its due time has passed.
 * "Mastered" has no say: a mastered card that comes due is reviewed like any other.
 * Takes one bound parameter: the current time in ms.
 */
const IS_DUE = "(card_progress.next_review_at IS NULL OR card_progress.next_review_at <= ?)";

export async function getDueCards(deckId: number): Promise<Card[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<CardRow>(`
        SELECT cards.id, cards.learning_text, cards.localized_text, cards.example_sentence, cards.romanization
        FROM cards JOIN card_progress ON cards.id = card_progress.card_id
        WHERE cards.deck_id = ? AND ${IS_DUE}
        ORDER BY COALESCE(card_progress.next_review_at, 0), cards.id
    `, deckId, Date.now());
    return rows.map(mapCard);
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

export async function getDecks() {
    const database = await getDatabase();
    return database.getAllAsync<{ id: number; name: string; language: string; card_count: number }>(`
        SELECT decks.id, decks.name, decks.language, COUNT(cards.id) AS card_count
        FROM decks LEFT JOIN cards ON cards.deck_id = decks.id
        GROUP BY decks.id ORDER BY decks.id
    `);
}

export async function deleteDeck(id: number) {
    const database = await getDatabase();
    await database.runAsync("DELETE FROM decks WHERE id = ?", id);
}

/** Returns a complete, consistent snapshot of the database as bytes (read-only). */
export async function serializeDatabase(): Promise<Uint8Array> {
    const database = await getDatabase();
    return database.serializeAsync();
}
