// backend/tests/helpers/testDatabase.js

import Database from "better-sqlite3";

/**
 * Create an isolated in-memory SQLite database for automated tests.
 *
 * Each test database contains the account and session tables needed by the
 * authentication system. Nothing is written to backend/data/bet.db.
 */
export function createTestDatabase() {
  const database = new Database(":memory:");

  // Match the production database behavior for foreign-key enforcement.
  database.pragma("foreign_keys = ON");

  database.exec(`
    CREATE TABLE users (
      userID INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      verificationStatus INTEGER NOT NULL DEFAULT 0,
      timeStamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX idx_users_username_nocase
      ON users(username COLLATE NOCASE);

    CREATE UNIQUE INDEX idx_users_email_nocase
      ON users(email COLLATE NOCASE);

    CREATE TABLE sessions (
      sid TEXT PRIMARY KEY,
      session TEXT NOT NULL,
      expiresAt INTEGER NOT NULL
    );

    CREATE INDEX idx_sessions_expires_at
      ON sessions(expiresAt);
  `);

  return database;
}
