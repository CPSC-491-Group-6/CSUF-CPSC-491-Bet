import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import db, { databasePath } from "./database.js";

const currentDirectory = path.dirname(
  fileURLToPath(import.meta.url),
);

const migrationsDirectory = path.join(
  currentDirectory,
  "migrations",
);

const TABLE_REBUILD_MIGRATION =
  "006_replace_outcome_user_id.sql";

/** Create version history without changing existing records. */
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

/** Get migrations already successfully applied. */
function getAppliedMigrations() {
  return new Set(
    db.prepare(`
      SELECT migration_name
      FROM schema_migrations
      ORDER BY migration_name
    `)
      .all()
      .map((row) => row.migration_name),
  );
}

/** Discover migration files in deterministic order. */
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

/** Run migration SQL and record its completion atomically. */
function applyMigration(migrationName) {
  const migrationPath = path.join(
    migrationsDirectory,
    migrationName,
  );

  const migrationSql = fs.readFileSync(
    migrationPath,
    "utf8",
  );

  const rebuildsReferencedTable =
    migrationName === TABLE_REBUILD_MIGRATION;

  // SQLite cannot change foreign-key enforcement inside
  // an active transaction.
  if (rebuildsReferencedTable) {
    if (db.inTransaction) {
      throw new Error(
        "Cannot rebuild bets inside an existing transaction.",
      );
    }

    db.pragma("foreign_keys = OFF");
  }

  try {
    const runMigration = db.transaction(() => {
      db.exec(migrationSql);

      // Check relationships before committing the rebuilt table.
      // Throwing here rolls back the entire migration.
      if (rebuildsReferencedTable) {
        const violations = db.pragma("foreign_key_check");

        if (violations.length > 0) {
          throw new Error(
            `Migration ${migrationName} has ` +
              `${violations.length} foreign-key violation(s).`,
          );
        }
      }

      db.prepare(`
        INSERT INTO schema_migrations (migration_name)
        VALUES (?)
      `).run(migrationName);
    });

    runMigration();
  } finally {
    if (rebuildsReferencedTable) {
      // Restore enforcement even if migration fails.
      db.pragma("foreign_keys = ON");

      if (
        db.pragma("foreign_keys", { simple: true }) !== 1
      ) {
        throw new Error(
          "Could not restore SQLite foreign-key enforcement.",
        );
      }
    }
  }
}

/** Apply outstanding migrations without resetting stored data. */
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
  console.error(
    `Database initialization failed: ${error.message}`,
  );

  process.exitCode = 1;
} finally {
  db.close();
}
