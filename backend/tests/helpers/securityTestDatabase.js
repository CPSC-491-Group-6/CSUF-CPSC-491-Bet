import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

export function createSecurityTestDatabase() {
  const database = new Database(":memory:");

  database.pragma("foreign_keys = ON");

  // Load the initial database schema
  const initialMigrationPath = fileURLToPath(
    new URL("../../src/data/migrations/001_initial.sql", import.meta.url),
  );

  const initialMigration = readFileSync(initialMigrationPath, "utf8");

  database.exec(initialMigration);

  // Apply the migration that adds public/private visibility
  const visibilityMigrationPath = fileURLToPath(
    new URL(
      "../../src/data/migrations/002_add_bet_visibility.sql",
      import.meta.url,
    ),
  );

  const visibilityMigration = readFileSync(visibilityMigrationPath, "utf8");

  database.exec(visibilityMigration);

  // Create the session table needed for authentication tests
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      session TEXT NOT NULL,
      expiresAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
      ON sessions(expiresAt);
  `);

  return database;
}
