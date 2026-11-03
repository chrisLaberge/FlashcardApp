// Builds a card-progress-only test fixture from a flashcards.db export.
//
//   node scripts/make-progress-fixture.mjs <exported.db> <out.json> <exported-at-ISO>
//
// <exported-at-ISO> is when the export was taken (the backup filename contains it,
// e.g. 2026-11-03T17:53:50.770Z). Tests use it as the fixture's "now".
//
// Only scheduling data is kept. Card text, images and deck names are NOT copied,
// so the fixture is safe to commit. The source file is opened read-only.
import { DatabaseSync } from "node:sqlite";
import { writeFileSync } from "node:fs";

const [source, output, exportedAtIso] = process.argv.slice(2);
const exportedAt = Date.parse(exportedAtIso ?? "");
if (!source || !output || Number.isNaN(exportedAt)) {
    console.error("usage: node scripts/make-progress-fixture.mjs <exported.db> <out.json> <exported-at-ISO>");
    process.exit(1);
}

const db = new DatabaseSync(source, { readOnly: true });
const rows = db
    .prepare(`
        SELECT c.id AS card_id, c.deck_id, p.review_count, p.next_review_at,
               p.mastered, p.fsrs_card, p.last_review_at
        FROM cards c JOIN card_progress p ON p.card_id = c.id
        ORDER BY c.id
    `)
    .all()
    .map((row) => ({ ...row }));

const fixture = {
    description: "Scheduling-only snapshot of a real flashcards.db export (no card text).",
    exportedAt,
    cardCount: rows.length,
    cards: rows,
};
writeFileSync(output, JSON.stringify(fixture, null, 2) + "\n");
console.log(`wrote ${rows.length} cards to ${output}`);
