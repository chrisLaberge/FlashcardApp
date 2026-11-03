# Tests

Run everything (type check + lint + tests): `npm run check`
Only the tests: `npm test`  ·  one file: `npx jest tests/database.test.ts`

Requires Node >= 22.13 (tests use the built-in `node:sqlite`; an "ExperimentalWarning" is expected).

## How it works
- `jest.config.js` maps `expo-sqlite` to `tests/helpers/expoSqliteMock.ts`, a Node SQLite adapter.
  The real `src/database/database.ts` runs unmodified, and **no test can open the app's real database**.
- `tests/helpers/testDb.ts`: `startApp()` simulates an app launch (fresh module state; pass a temp file to
  simulate a restart), `freezeTime()/advanceTime()` control the clock, `seedCard()` writes exact states.
- `tests/fixtures/dev-progress-*.json` is a scheduling-only snapshot of a real export (no card text).
  Regenerate with `node scripts/make-progress-fixture.mjs <export.db> <out.json> <exported-at-ISO>`.

## `test.failing` = a known bug
Tests named `KNOWN BUG: ...` describe the *correct* behaviour and are marked `test.failing`, so the suite
is green today. When a bug is fixed the test starts passing, Jest reports it as a failure, and you then
change `test.failing` to `test`, turning it into a permanent regression test.

## Lint baseline
`eslint-suppressions.json` records pre-existing lint errors so only NEW ones fail. After fixing some,
run `npx eslint . --prune-suppressions` to shrink it. To re-baseline: `npx eslint . --suppress-all`.
