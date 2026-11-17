import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

/**
 * Sprint 4 - Member B
 * SOC 2 CC6.3 - Security Integration Test Database
 *
 * Creates an isolated in-memory SQLite database using the
 * application's production schema migrations.
 *
 * Does not modify the production or development database.
 */
export function createSecurityTestDatabase() {
  const database = new Database(":memory:");

  try {
    database.pragma("foreign_keys = ON");

    /**
     * Preserve the existing security fixture setup.
     *
     * Sessions are created separately below, so 002_sessions.sql
     * is intentionally not included here.
     */
    const migrations = [
      "001_initial.sql",
      "002_add_bet_visibility.sql",
      "005_bet_options_and_answers.sql",
      "006_replace_outcome_user_id.sql",
      "007_free_response_bets.sql",
    ];

    const tableRebuildMigrations = new Set([
      "006_replace_outcome_user_id.sql",
      "007_free_response_bets.sql",
    ]);

    // Apply each migration using the same FK rules as production.
    for (const migrationFile of migrations) {
      const migrationPath = fileURLToPath(
        new URL(`../../src/data/migrations/${migrationFile}`, import.meta.url),
      );

      const migrationSql = readFileSync(migrationPath, "utf8");

      const rebuildsBets = tableRebuildMigrations.has(migrationFile);

      if (rebuildsBets) {
        database.pragma("foreign_keys = OFF");
      }

      try {
        const applyMigration = database.transaction(() => {
          database.exec(migrationSql);

          if (rebuildsBets) {
            const violations = database.pragma("foreign_key_check");

            if (violations.length > 0) {
              throw new Error(
                `Migration ${migrationFile} has foreign-key violations.`,
              );
            }
          }
        });

        applyMigration();
      } finally {
        if (rebuildsBets) {
          database.pragma("foreign_keys = ON");
        }
      }
    }

    // Preserve the existing session storage schema.
    database.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        session TEXT NOT NULL,
        expiresAt INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
        ON sessions(expiresAt);
    `);

    // Verify that the resulting test schema remains consistent.
    if (database.pragma("foreign_keys", { simple: true }) !== 1) {
      throw new Error("Security test database has foreign keys disabled.");
    }

    const violations = database.pragma("foreign_key_check");

    if (violations.length > 0) {
      throw new Error("Security test database has foreign-key violations.");
    }

    if (database.pragma("integrity_check", { simple: true }) !== "ok") {
      throw new Error("Security test database failed SQLite integrity check.");
    }

    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}
