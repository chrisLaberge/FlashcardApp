# Accounts, XP, leaderboard and publishing: plan

Status: a proposal, nothing here is built except the local foundation (see "What exists").
Decisions that are yours to make are marked **Decide**.

## What exists

- `review_log` table: one row per answer (card, deck, time, right/wrong, level before/after,
  what the front showed, seconds on the card, next due time). Kept even if the card or deck is
  deleted, written in the same transaction as the answer, removed again by Undo.
- `src/models/Stats.ts`: daily stats, current and longest streak (local days, daylight saving
  safe), totals (reviews, accuracy, time spent). Pure functions, tested.
- Study levels (`card_progress.level`) and the review mix per level (`src/models/StudyMode.ts`).

XP, milestones, streaks, stats and "total time in reviews" are all computed from `review_log`,
so none of them needs a server. Build them locally first.

## Phases

**A. Local only (no backend, no sign-in).** Stats screen (streak, time spent, reviews per day,
accuracy), XP and level-ups, milestones. XP is derived from the log, so it can be recomputed and
never gets out of sync. **Decide:** the XP formula (e.g. more XP for recall and listening than
recognition, using `level_before` and `prompt`) and the milestone list.

**B. Accounts and aggregates.** Sign-in, then upload only daily roll-ups per user (day, xp,
reviews, time), not cards or progress. Friends and a friends-only leaderboard read these.
Tables: `users` (id, display name, time zone), `friendships` (a, b, status),
`daily_xp` (user, day, xp, reviews, time). Rules: friends see each other's totals and nothing
else; the user can leave the leaderboard and delete the account.

**C. Cross-device sync of cards and progress.** The hardest part; do it last and only if wanted.
Needs `updated_at` on cards and progress, a change log, and a conflict rule (e.g. newest write
wins per card). Review history merges by append (rows are never edited).

## Before publishing (backend, needed even without accounts)

The Cloud Run backend currently has no sign-in, so anyone who finds the URL can spend your
translation and image quota.

1. Require sign-in on every endpoint (Firebase Authentication is the usual pairing with Cloud
   Run), plus App Check (Play Integrity) so only the real app can call it.
2. Per-user rate limits and daily quotas on translate, image search and any TTS endpoint.
3. A billing budget with alerts on the Google Cloud project.
4. Keep third-party API keys on the server only (already the case for the image search).
5. Check the Pixabay terms for how pictures may be stored and shown in your own app.

## Before publishing (store and legal)

- **Decide** the final Android package name. It is `com.anonymous.FlashcardApp`. Changing it later
  installs as a different app with an empty database.
- Use Play App Signing and keep the upload key backed up.
- A privacy policy and the Play "Data safety" form. With accounts: in-app account deletion and a
  public page to request deletion.
- Text-to-speech: Meta's Western Armenian model is CC-BY-NC (non-commercial). Do not build a
  published app on it without checking the licence; see `scripts/armenian-tts-test.mjs` for the
  listening test of alternatives.
- Back up: the in-app Export saves only the database, not the picture files.

## Anti-cheat note for the leaderboard

XP reported by the phone can be faked. For a friends-only board that is acceptable. If it ever
becomes public, the server must cap XP per day and per review rate, or recompute from submitted
review rows.
