import { CardProgress } from "@/models/CardProgress";
import {
    getFailedReview,
    getNextReview,
} from "@/models/SpacedRepetition";
import * as SQLite from "expo-sqlite";
import { Card } from "../models/Card";

let db: SQLite.SQLiteDatabase | null = null;

async function getDatabase() {
    if (!db) {
        db = await SQLite.openDatabaseAsync("flashcards.db");

        await db.execAsync(`
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS decks(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                language TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS images(
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

            CREATE TABLE IF NOT EXISTS cards(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deck_id INTEGER NOT NULL,
                learning_text TEXT NOT NULL,
                localized_text TEXT NOT NULL,
                example_sentence TEXT,
                romanization TEXT,
                image_id INTEGER,

                FOREIGN KEY(deck_id)
                    REFERENCES decks(id)
                    ON DELETE CASCADE,

                FOREIGN KEY(image_id)
                    REFERENCES images(id)
                    ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS card_progress(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id INTEGER NOT NULL UNIQUE,
                review_count INTEGER NOT NULL DEFAULT 0,
                next_review_at INTEGER,
                mastered INTEGER NOT NULL DEFAULT 0,

                FOREIGN KEY(card_id)
                    REFERENCES cards(id)
                    ON DELETE CASCADE
            );
        `);
    }

    return db;
}

/* ============================================================
   CARDS
   ============================================================ */

export async function getCards(
    deckId: number
): Promise<Card[]> {
    const database = await getDatabase();

    const rows = await database.getAllAsync<{
        id: number;
        learning_text: string;
        localized_text: string;
        example_sentence: string;
        romanization: string;
    }>(
        "SELECT * FROM cards WHERE deck_id = ?",
        deckId
    );

    return rows.map(
        (row) =>
            new Card(
                row.learning_text,
                row.localized_text,
                row.example_sentence,
                row.romanization,
                row.id
            )
    );
}

export async function addCard(
    learningText: string,
    localizedText: string,
    exampleSentence: string,
    romanization: string,
    deckId: number
) {
    const database = await getDatabase();

    const result = await database.runAsync(
        `
        INSERT INTO cards
        (
            learning_text,
            localized_text,
            example_sentence,
            romanization,
            deck_id
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        learningText,
        localizedText,
        exampleSentence,
        romanization,
        deckId
    );

    await database.runAsync(
        "INSERT INTO card_progress (card_id) VALUES (?)",
        result.lastInsertRowId
    );

    return result.lastInsertRowId;
}

export async function deleteCard(id: number) {
    const database = await getDatabase();

    await database.runAsync(
        "DELETE FROM cards WHERE id = ?",
        id
    );
}

export async function updateCard(
    id: number,
    learningText: string,
    localizedText: string,
    exampleSentence: string,
    romanization: string
) {
    const database = await getDatabase();

    await database.runAsync(
        `
        UPDATE cards
        SET
            learning_text = ?,
            localized_text = ?,
            example_sentence = ?,
            romanization = ?
        WHERE id = ?
        `,
        learningText,
        localizedText,
        exampleSentence,
        romanization,
        id
    );
}

export async function getCard(
    id: number
): Promise<Card | undefined> {
    const database = await getDatabase();

    const row = await database.getFirstAsync<{
        id: number;
        learning_text: string;
        localized_text: string;
        example_sentence: string;
        romanization: string;
    }>(
        "SELECT * FROM cards WHERE id = ?",
        id
    );

    if (!row) {
        return undefined;
    }

    return new Card(
        row.learning_text,
        row.localized_text,
        row.example_sentence,
        row.romanization,
        row.id
    );
}

export async function findDuplicateCard(
    learningText: string,
    deckId: number
) {
    const db = await getDatabase();

    return db.getFirstAsync(
        `SELECT * FROM cards
         WHERE deck_id = ?
         AND LOWER(TRIM(learning_text)) = LOWER(TRIM(?))`,
        [deckId, learningText]
    );
}

/* ============================================================
   IMAGES
   ============================================================ */

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

export async function addImage(
    source: string,
    providerId: string,
    filePath: string,
    thumbnailPath: string | null,
    pageUrl: string | null,
    photographer: string | null,
    photographerUrl: string | null
): Promise<number> {
    const database = await getDatabase();

    const existing = await database.getFirstAsync<{
        id: number;
    }>(
        `
        SELECT id
        FROM images
        WHERE source = ?
          AND provider_id = ?
        `,
        source,
        providerId
    );

    if (existing) {
        return existing.id;
    }

    const result = await database.runAsync(
        `
        INSERT INTO images
        (
            source,
            provider_id,
            file_path,
            thumbnail_path,
            page_url,
            photographer,
            photographer_url
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        source,
        providerId,
        filePath,
        thumbnailPath,
        pageUrl,
        photographer,
        photographerUrl
    );

    return result.lastInsertRowId;
}

export async function getImage(
    imageId: number
): Promise<CardImage | undefined> {
    const database = await getDatabase();

    const row = await database.getFirstAsync<CardImage>(
        `
        SELECT *
        FROM images
        WHERE id = ?
        `,
        imageId
    );

    return row ?? undefined;
}

export async function getImageByProvider(
    source: string,
    providerId: string
): Promise<CardImage | undefined> {
    const database = await getDatabase();

    const row = await database.getFirstAsync<CardImage>(
        `
        SELECT *
        FROM images
        WHERE source = ?
          AND provider_id = ?
        `,
        source,
        providerId
    );

    return row ?? undefined;
}

export async function setCardImage(
    cardId: number,
    imageId: number
) {
    const database = await getDatabase();

    await database.runAsync(
        `
        UPDATE cards
        SET image_id = ?
        WHERE id = ?
        `,
        imageId,
        cardId
    );
}

export async function removeCardImage(
    cardId: number
) {
    const database = await getDatabase();

    await database.runAsync(
        `
        UPDATE cards
        SET image_id = NULL
        WHERE id = ?
        `,
        cardId
    );
}

export async function getCardImage(
    cardId: number
): Promise<CardImage | undefined> {
    const database = await getDatabase();

    const row = await database.getFirstAsync<CardImage>(
        `
        SELECT images.*
        FROM cards
        JOIN images
            ON cards.image_id = images.id
        WHERE cards.id = ?
        `,
        cardId
    );

    return row ?? undefined;
}

/* ============================================================
   CARD PROGRESS
   ============================================================ */

export async function resetCardProgress(
    cardId: number
) {
    const database = await getDatabase();

    await database.runAsync(
        `
        UPDATE card_progress
        SET
            review_count = 0,
            next_review_at = NULL,
            mastered = 0
        WHERE card_id = ?
        `,
        cardId
    );
}

export async function getCardProgress(
    cardId: number
): Promise<CardProgress | undefined> {
    const database = await getDatabase();

    const row = await database.getFirstAsync<{
        id: number;
        card_id: number;
        review_count: number;
        next_review_at: number | null;
        mastered: number;
    }>(
        "SELECT * FROM card_progress WHERE card_id = ?",
        cardId
    );

    if (!row) {
        return undefined;
    }

    return new CardProgress(
        row.card_id,
        row.review_count,
        row.next_review_at ?? undefined,
        row.mastered === 1,
        row.id
    );
}

export async function updateCardProgress(
    cardId: number,
    reviewCount: number,
    nextReviewAt: number | undefined,
    mastered: boolean
) {
    const database = await getDatabase();

    await database.runAsync(
        `
        UPDATE card_progress
        SET
            review_count = ?,
            next_review_at = ?,
            mastered = ?
        WHERE card_id = ?
        `,
        reviewCount,
        nextReviewAt ?? null,
        mastered ? 1 : 0,
        cardId
    );
}

export async function markCardCorrect(
    cardId: number
) {
    const progress = await getCardProgress(cardId);

    if (!progress) {
        return;
    }

    const result = getNextReview(
        progress.reviewCount
    );

    await updateCardProgress(
        cardId,
        result.reviewCount,
        result.nextReviewAt,
        result.mastered
    );
}

export async function markCardIncorrect(
    cardId: number
) {
    const progress = await getCardProgress(cardId);

    if (!progress) {
        return;
    }

    const result = getFailedReview(
        progress.reviewCount
    );

    await updateCardProgress(
        cardId,
        result.reviewCount,
        result.nextReviewAt,
        result.mastered
    );
}

export async function getDueCards(
    deckId: number
): Promise<Card[]> {
    const database = await getDatabase();

    const rows = await database.getAllAsync<{
        id: number;
        learning_text: string;
        localized_text: string;
        example_sentence: string;
        romanization: string;
    }>(
        `
        SELECT
            cards.id,
            cards.learning_text,
            cards.localized_text,
            cards.example_sentence,
            cards.romanization
        FROM cards
        JOIN card_progress
            ON cards.id = card_progress.card_id
        WHERE cards.deck_id = ?
          AND (
              card_progress.next_review_at IS NULL
              OR card_progress.next_review_at <= ?
          )
        `,
        deckId,
        Date.now()
    );

    return rows.map(
        (row) =>
            new Card(
                row.learning_text,
                row.localized_text,
                row.example_sentence,
                row.romanization,
                row.id
            )
    );
}

export async function getDueCardCount(): Promise<number> {
    const database = await getDatabase();

    const row = await database.getFirstAsync<{
        count: number;
    }>(
        `
        SELECT COUNT(*) as count
        FROM cards
        JOIN card_progress
            ON cards.id = card_progress.card_id
        WHERE card_progress.next_review_at IS NULL
           OR card_progress.next_review_at <= ?
        `,
        Date.now()
    );

    return row?.count ?? 0;
}

export async function getProgressCounts(
    deckId: number
): Promise<{
    due: number;
    practiced: number;
    mastered: number;
}> {
    const database = await getDatabase();

    const row = await database.getFirstAsync<{
        due: number | null;
        practiced: number | null;
        mastered: number | null;
    }>(
        `
        SELECT
            SUM(
                CASE
                    WHEN card_progress.mastered = 0
                     AND (
                        card_progress.next_review_at IS NULL
                        OR card_progress.next_review_at <= ?
                     )
                    THEN 1
                    ELSE 0
                END
            ) AS due,

            SUM(
                CASE
                    WHEN card_progress.review_count > 0
                     AND card_progress.mastered = 0
                     AND card_progress.next_review_at > ?
                    THEN 1
                    ELSE 0
                END
            ) AS practiced,

            SUM(
                CASE
                    WHEN card_progress.mastered = 1
                    THEN 1
                    ELSE 0
                END
            ) AS mastered

        FROM cards
        JOIN card_progress
            ON cards.id = card_progress.card_id
        WHERE cards.deck_id = ?
        `,
        Date.now(),
        Date.now(),
        deckId
    );

    return {
        due: row?.due ?? 0,
        practiced: row?.practiced ?? 0,
        mastered: row?.mastered ?? 0,
    };
}

/* ============================================================
   DECKS
   ============================================================ */

export async function addDeck(
    name: string,
    language: string
) {
    const database = await getDatabase();

    const result = await database.runAsync(
        "INSERT INTO decks (name, language) VALUES (?, ?)",
        name,
        language
    );

    return result.lastInsertRowId;
}

export async function getDecks() {
    const database = await getDatabase();

    return await database.getAllAsync<{
        id: number;
        name: string;
        language: string;
        card_count: number;
    }>(
        `
        SELECT
            decks.id,
            decks.name,
            decks.language,
            COUNT(cards.id) AS card_count
        FROM decks
        LEFT JOIN cards
            ON cards.deck_id = decks.id
        GROUP BY decks.id
        ORDER BY decks.id
        `
    );
}

export async function deleteDeck(
    id: number
) {
    const database = await getDatabase();

    await database.runAsync(
        "DELETE FROM decks WHERE id = ?",
        id
    );
}