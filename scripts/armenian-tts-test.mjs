// Prepares a listening test for Armenian voices: picks words from YOUR Armenian deck and prints
// each one as written and as rewritten for an Eastern voice (see src/utils/armenian.ts).
// Opens the database READ-ONLY.
//
//   node scripts/armenian-tts-test.mjs <backup.db> [how-many]
//
// Paste the "as written" column into a voice (e.g. Meta MMS, ElevenLabs) and the "for an Eastern
// voice" column into any Eastern Armenian voice, then compare by ear.
import { DatabaseSync } from "node:sqlite";
import { westernToEasternSpelling } from "../src/utils/armenian.ts";

const [file, countArg] = process.argv.slice(2);
if (!file) {
    console.error("usage: node scripts/armenian-tts-test.mjs <backup.db> [how-many]");
    process.exit(1);
}
const count = Number(countArg) || 8;

const db = new DatabaseSync(file, { readOnly: true });
const deck = db.prepare("SELECT id, name FROM decks WHERE language = 'hy' LIMIT 1").get();
if (!deck) {
    console.error("No Armenian deck (language 'hy') in this database.");
    process.exit(1);
}

// Short words first, and some that contain the letters the Eastern/Western difference affects.
const rows = db
    .prepare("SELECT learning_text AS text, localized_text AS meaning FROM cards WHERE deck_id = ? AND LENGTH(learning_text) BETWEEN 3 AND 14")
    .all(deck.id);
const affected = rows.filter((r) => westernToEasternSpelling(r.text) !== r.text);
const picks = [...affected.slice(0, Math.ceil(count * 0.75)), ...rows.filter((r) => !affected.includes(r)).slice(0, count)].slice(0, count);

console.log(`Deck "${deck.name}": ${rows.length} short words, ${affected.length} affected by the consonant swap.\n`);
console.log("as written | for an Eastern voice | meaning");
for (const r of picks) console.log(`${r.text} | ${westernToEasternSpelling(r.text)} | ${r.meaning}`);
