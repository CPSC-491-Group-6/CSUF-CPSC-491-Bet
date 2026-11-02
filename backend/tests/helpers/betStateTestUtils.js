import { readFileSync } from "node:fs";
import Database from "better-sqlite3";

// Use the existing application migrations for test databases.
const MIGRATIONS = [
  "001_initial.sql",
  "002_add_bet_visibility.sql",
  "002_sessions.sql",
  "003_normalize_migrations.sql",
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

      database.exec(sql);
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
      DELETE FROM bets;
      DELETE FROM users;
      DELETE FROM sqlite_sequence WHERE name = 'users';
    `);
  })();
}
