/** @type {import('jest').Config} */
module.exports = {
    preset: "jest-expo",
    testMatch: ["<rootDir>/tests/**/*.test.ts"],
    moduleNameMapper: {
        // Tests must never touch a real device database: expo-sqlite is always replaced
        // by an in-memory (or temp-file) Node SQLite adapter.
        "^expo-sqlite$": "<rootDir>/tests/helpers/expoSqliteMock.ts",
        "^@/(.*)$": "<rootDir>/src/$1",
    },
};
