import { CardProgress } from "@/models/CardProgress";
import { getFailedReview, getNextReview } from "@/models/SpacedRepetition";
import * as SQLite from "expo-sqlite";
import { Card } from "../models/Card";

let db: SQLite.SQLiteDatabase | null = null;

async function getDatabase() {
    if (!db) {
        db = await SQLite.openDatabaseAsync("flashcards.db");

        await db.execAsync(`
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                front TEXT NOT NULL,
                back TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS card_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id INTEGER NOT NULL UNIQUE,
                review_count INTEGER NOT NULL DEFAULT 0,
                next_review_at INTEGER,
                mastered INTEGER NOT NULL DEFAULT 0,

                FOREIGN KEY (card_id)
                    REFERENCES cards(id)
                    ON DELETE CASCADE
            );
        `);
    }

    return db;
}

export async function addCard(
    front: string,
    back: string
) {
    const database = await getDatabase();

    const result = await database.runAsync(
        "INSERT INTO cards (front, back) VALUES (?, ?)",
        front,
        back
    );

    await database.runAsync(
        "INSERT INTO card_progress (card_id) VALUES (?)",
        result.lastInsertRowId
    );
}

export async function getCards(): Promise<Card[]> {
    const database = await getDatabase();

    const rows = await database.getAllAsync<{
        id: number;
        front: string;
        back: string;
    }>("SELECT * FROM cards");

    return rows.map(
        (row) => new Card(row.front, row.back, row.id)
    );
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
    front: string,
    back: string
) {
    const database = await getDatabase();

    await database.runAsync(
        "UPDATE cards SET front = ?, back = ? WHERE id = ?",
        front,
        back,
        id
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

export async function markCardCorrect(cardId: number) {
    const progress = await getCardProgress(cardId);

    if (!progress) {
        return;
    }

    const result = getNextReview(progress.reviewCount);

    await updateCardProgress(
        cardId,
        result.reviewCount,
        result.nextReviewAt,
        result.mastered
    );
}

export async function markCardIncorrect(cardId: number) {
    const progress = await getCardProgress(cardId);

    if (!progress) {
        return;
    }

    const result = getFailedReview(progress.reviewCount);

    await updateCardProgress(
        cardId,
        result.reviewCount,
        result.nextReviewAt,
        result.mastered
    );
}

export async function getDueCards(): Promise<Card[]> {
    const database = await getDatabase();

    const rows = await database.getAllAsync<{
        id: number;
        front: string;
        back: string;
    }>(
        `
        SELECT cards.id, cards.front, cards.back
        FROM cards
        JOIN card_progress
            ON cards.id = card_progress.card_id
        WHERE card_progress.next_review_at IS NULL
           OR card_progress.next_review_at <= ?
        `,
        Date.now()
    );

    return rows.map(
        (row) => new Card(row.front, row.back, row.id)
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

export async function getProgressCounts(): Promise<{
    due: number;
    practiced: number;
    mastered: number;
}> {
    const database = await getDatabase();

    const row = await database.getFirstAsync<{
        due: number;
        practiced: number;
        mastered: number;
    }>(
        `
        SELECT
            SUM(
                CASE
                    WHEN next_review_at IS NULL
                      OR next_review_at <= ?
                    THEN 1
                    ELSE 0
                END
            ) AS due,

            SUM(
                CASE
                    WHEN review_count > 0
                      AND mastered = 0
                    THEN 1
                    ELSE 0
                END
            ) AS practiced,

            SUM(
                CASE
                    WHEN mastered = 1
                    THEN 1
                    ELSE 0
                END
            ) AS mastered

        FROM card_progress
        `,
        Date.now()
    );

    return {
        due: row?.due ?? 0,
        practiced: row?.practiced ?? 0,
        mastered: row?.mastered ?? 0,
    };
}