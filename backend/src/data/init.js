
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import db, { databasePath } from "./database.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const migrationsDirectory = path.join(currentDirectory, "migrations");

/**
 * These migrations rebuild the bets table, which other tables reference.
 *
 * SQLite requires foreign-key enforcement to be disabled before
 * beginning a transaction that rebuilds a referenced table.
 */
const tableRebuildMigrations = new Set([
  "006_replace_outcome_user_id.sql",
  "007_free_response_bets.sql",
]);

/** Create migration history without modifying existing records. */
function ensureMigrationTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      )
    );
  `);
}

/** Retrieve the set of migrations already applied. */
function getAppliedMigrations() {
  return new Set(
    db
      .prepare(`
        SELECT migration_name
        FROM schema_migrations
        ORDER BY migration_name
      `)
      .all()
      .map((row) => row.migration_name),
  );
}

/** Discover SQL migration files in deterministic order. */
function getMigrationFiles() {
  if (!fs.existsSync(migrationsDirectory)) {
    throw new Error(
      `Migration directory does not exist: ${migrationsDirectory}`,
    );
  }

  return fs
    .readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();
}

/**
 * Apply one migration and record successful completion atomically.
 *
 * Table rebuilds require special foreign-key handling.
 * If SQL execution or verification fails, the transaction rolls back.
 */
function applyMigration(migrationName) {
  const migrationPath = path.join(migrationsDirectory, migrationName);

  const migrationSql = fs.readFileSync(migrationPath, "utf8");

  const rebuildsReferencedTable = tableRebuildMigrations.has(migrationName);

  if (rebuildsReferencedTable) {
    if (db.inTransaction) {
      throw new Error("Cannot rebuild bets inside an existing transaction.");
    }

    db.pragma("foreign_keys = OFF");

    if (db.pragma("foreign_keys", { simple: true }) !== 0) {
      throw new Error("Could not disable SQLite foreign-key enforcement.");
    }
  }

  let migrationError;

  try {
    const runMigration = db.transaction(() => {
      db.exec(migrationSql);

      // Verify references before committing a table rebuild.
      if (rebuildsReferencedTable) {
        const violations = db.pragma("foreign_key_check");

        if (violations.length > 0) {
          throw new Error(
            `Migration ${migrationName} has ` +
              `${violations.length} foreign-key violation(s).`,
          );
        }
      }

      db
        .prepare(`
          INSERT INTO schema_migrations (migration_name)
          VALUES (?)
        `)
        .run(migrationName);
    });

    runMigration();
  } catch (error) {
    migrationError = error;
  }

  let enforcementError;

  if (rebuildsReferencedTable) {
    // Always restore enforcement, including after failed migrations.
    try {
      db.pragma("foreign_keys = ON");

      if (db.pragma("foreign_keys", { simple: true }) !== 1) {
        enforcementError = new Error(
          "Could not restore SQLite foreign-key enforcement.",
        );
      }
    } catch (error) {
      enforcementError = error;
    }
  }

  if (enforcementError) {
    throw enforcementError;
  }

  if (migrationError) {
    throw migrationError;
  }
}

/** Apply outstanding migrations without resetting existing data. */
function initializeDatabase() {
  ensureMigrationTable();

  const appliedMigrations = getAppliedMigrations();
  const migrationFiles = getMigrationFiles();

  if (migrationFiles.length === 0) {
    console.log("No database migrations were found.");
    return;
  }

  for (const migrationName of migrationFiles) {
    if (appliedMigrations.has(migrationName)) {
      console.log(`Already applied: ${migrationName}`);
      continue;
    }

    console.log(`Applying migration: ${migrationName}`);
    applyMigration(migrationName);
  }

  console.log(`Database ready: ${databasePath}`);
}

try {
  initializeDatabase();
} catch (error) {
  console.error(`Database initialization failed: ${error.message}`);

  process.exitCode = 1;
} finally {
  db.close();
}
