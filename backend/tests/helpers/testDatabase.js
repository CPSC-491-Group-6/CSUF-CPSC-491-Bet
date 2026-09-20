import Database from "better-sqlite3";

/**
 * Create a temporary in-memory SQLite database for automated tests.
 *
 * Each call creates an isolated database that disappears when closed.
 * Tests therefore never read from or write to the development database.
 */
export function createTestDatabase() {
  const database = new Database(":memory:");

  // Keep test behavior consistent with the production SQLite connection.
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
  `);

  return database;
}
