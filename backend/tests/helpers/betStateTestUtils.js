
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";

// Apply the application's migrations to each isolated test database.
const MIGRATIONS = [
  "001_initial.sql",
  "002_add_bet_visibility.sql",
  "002_sessions.sql",
  "003_normalize_migrations.sql",
  "005_bet_options_and_answers.sql",
  "006_replace_outcome_user_id.sql",
];

export function createBetTestDatabase() {
  const database = new Database(":memory:");

  try {
    database.pragma("foreign_keys = ON");

    for (const migration of MIGRATIONS) {
      const sql = readFileSync(
        new URL(`../../src/data/migrations/${migration}`, import.meta.url),
        "utf8",
      );

      // Migration 006 replaces the bets table and requires
      // foreign keys to be disabled during the table rebuild.
      if (migration === "006_replace_outcome_user_id.sql") {
        database.pragma("foreign_keys = OFF");
      }

      try {
        database.exec(sql);
      } finally {
        database.pragma("foreign_keys = ON");
      }
    }

    // Verify the migrated test schema has no FK violations.
    const violations = database.pragma("foreign_key_check");

    if (violations.length > 0) {
      throw new Error("Test database has foreign key violations.");
    }

    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

// Reset all test data without affecting a real database.
export function resetBetTestState(database) {
  database.transaction(() => {
    database.exec(`
      DELETE FROM sessions;
      DELETE FROM bet_participants;
      DELETE FROM bet_options;
      DELETE FROM bets;
      DELETE FROM users;
      DELETE FROM sqlite_sequence WHERE name = 'users';
    `);
  })();
}
