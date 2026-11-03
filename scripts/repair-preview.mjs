// DRY RUN. Lists cards whose schedule was probably shortened by the old legacy->FSRS conversion.
// Opens the database READ-ONLY and never writes anything.
//
//   node scripts/repair-preview.mjs <backup.db>
//
// A card is a suspect when it has many reviews (the old fixed ladder had given it a long
// interval) but its FSRS stability is far below what that ladder implies.
import { DatabaseSync } from "node:sqlite";

const file = process.argv[2];
if (!file) {
    console.error("usage: node scripts/repair-preview.mjs <backup.db>");
    process.exit(1);
}

// Same ladder as src/models/SpacedRepetition.ts (REVIEW_INTERVALS), in days.
const LADDER_DAYS = [1 / 1440, 3 / 1440, 30 / 1440, 2 / 24, 8 / 24, 1, 3, 7, 14, 30, 60, 120, 180];
const ladderDays = (reviews) => (reviews <= 0 ? 0 : LADDER_DAYS[Math.min(reviews, LADDER_DAYS.length) - 1]);

const db = new DatabaseSync(file, { readOnly: true });
const rows = db
    .prepare(
        `SELECT p.card_id, p.review_count, p.next_review_at, p.fsrs_card, c.learning_text
         FROM card_progress p JOIN cards c ON c.id = p.card_id
         WHERE p.fsrs_card IS NOT NULL`,
    )
    .all();

const suspects = [];
for (const row of rows) {
    const fsrs = JSON.parse(row.fsrs_card);
    // The review that triggered the conversion counted as the last one, so the interval the card
    // had earned under the old ladder is the one for (reviews - 1).
    const earned = ladderDays(row.review_count - 1);
    if (row.review_count >= 10 && fsrs.stability < earned / 3) {
        suspects.push({ id: row.card_id, text: row.learning_text, reviews: row.review_count, stability: fsrs.stability, earned });
    }
}

console.log(`${rows.length} cards have an FSRS schedule; ${suspects.length} look shortened by the old conversion.\n`);
for (const s of suspects) {
    console.log(`card ${s.id}  "${s.text}"  reviews ${s.reviews}  stability now ${s.stability.toFixed(2)}d  old ladder interval ${s.earned.toFixed(1)}d`);
}
console.log("\nNothing was changed.");
