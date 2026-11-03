import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

/**
 * Sprint 4 - Member B
 * SOC 2 CC6.3 - Security Integration Test Database
 *
 * Creates an isolated in-memory SQLite database.
 * Uses the application's actual database migrations.
 * Does not modify the production database.
 */
export function createSecurityTestDatabase() {
  const database = new Database(":memory:");

  database.pragma("foreign_keys = ON");

  try {
    // Apply the application schema migrations in order.
    const migrations = [
      "001_initial.sql",
      "002_add_bet_visibility.sql",
      "005_bet_options_and_answers.sql",
      "006_replace_outcome_user_id.sql",
    ];

    for (const migrationFile of migrations) {
      const migrationPath = fileURLToPath(
        new URL(`../../src/data/migrations/${migrationFile}`, import.meta.url),
      );

      const migration = readFileSync(migrationPath, "utf8");

      database.exec(migration);
    }

    // Create session storage for authentication tests.
    // Do not apply 002_sessions.sql as well unless the
    // existing session setup is removed.
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
  } catch (error) {
    database.close();
    throw error;
  }
}
