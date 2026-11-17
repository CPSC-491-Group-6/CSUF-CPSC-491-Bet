import { readFileSync } from "node:fs";
import Database from "better-sqlite3";

/**
 * Apply the application's production migrations to isolated test databases.
 *
 * The order matches the current migration sequence.
 */
const MIGRATIONS = [
  "001_initial.sql",
  "002_add_bet_visibility.sql",
  "002_sessions.sql",
  "003_normalize_migrations.sql",
  "005_bet_options_and_answers.sql",
  "006_replace_outcome_user_id.sql",
  "007_free_response_bets.sql",
];

/**
 * Migrations that rebuild the referenced bets table.
 *
 * SQLite requires foreign keys to be disabled before beginning
 * a transaction containing either table replacement.
 */
const TABLE_REBUILD_MIGRATIONS = new Set([
  "006_replace_outcome_user_id.sql",
  "007_free_response_bets.sql",
]);

/**
 * Create an isolated, migrated SQLite database.
 *
 * Every migration executes atomically. Referenced-table rebuilds
 * are checked for foreign-key violations before committing.
 *
 * The database connection is closed if setup fails.
 */
export function createBetTestDatabase() {
  const database = new Database(":memory:");

  try {
    database.pragma("foreign_keys = ON");

    for (const migration of MIGRATIONS) {
      const sql = readFileSync(
        new URL(`../../src/data/migrations/${migration}`, import.meta.url),
        "utf8",
      );

      const rebuildsBets = TABLE_REBUILD_MIGRATIONS.has(migration);

      if (rebuildsBets) {
        database.pragma("foreign_keys = OFF");
      }

      try {
        const applyMigration = database.transaction(() => {
          database.exec(sql);

          // Check references before committing table replacements.
          if (rebuildsBets) {
            const violations = database.pragma("foreign_key_check");

            if (violations.length > 0) {
              throw new Error(
                `Migration ${migration} has foreign-key violations.`,
              );
            }
          }
        });

        applyMigration();
      } finally {
        // Ensure test connections always restore FK enforcement.
        if (rebuildsBets) {
          database.pragma("foreign_keys = ON");
        }
      }
    }

    if (database.pragma("foreign_keys", { simple: true }) !== 1) {
      throw new Error("Test database foreign-key enforcement is disabled.");
    }

    if (database.pragma("integrity_check", { simple: true }) !== "ok") {
      throw new Error("Test database failed SQLite integrity validation.");
    }

    const violations = database.pragma("foreign_key_check");

    if (violations.length > 0) {
      throw new Error("Test database has foreign-key violations.");
    }

    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

/**
 * Remove test records while preserving the migrated schema.
 *
 * bet_winners must be cleared before parent records.
 * This only affects the supplied isolated test database.
 */
export function resetBetTestState(database) {
  database.transaction(() => {
    database.exec(`
      DELETE FROM sessions;
      DELETE FROM bet_winners;
      DELETE FROM bet_participants;
      DELETE FROM bet_options;
      DELETE FROM bets;
      DELETE FROM users;
      DELETE FROM sqlite_sequence WHERE name = 'users';
    `);
  })();
}
