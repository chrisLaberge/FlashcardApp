import * as SQLite from "expo-sqlite";
import { Card } from "../models/Card";

let db: SQLite.SQLiteDatabase | null = null;

async function getDatabase() {
    if (!db) {
        db = await SQLite.openDatabaseAsync("flashcards.db");

        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                front TEXT NOT NULL,
                back TEXT NOT NULL
            );
        `);
    }

    return db;
}

export async function addCard(front: string, back: string) {
    const database = await getDatabase();

    await database.runAsync(
        "INSERT INTO cards (front, back) VALUES (?, ?)",
        front,
        back
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