// backend/src/data/init.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import db, { databasePath } from "./database.js";

/**
 * ES modules do not automatically provide __filename or __dirname.
 *
 * Resolve the current module location so migrations can be found reliably
 * regardless of the directory from which Node was invoked.
 */
const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

/**
 * All versioned SQL migrations live next to the database source code under
 * src/data/migrations.
 */
const migrationsDirectory = path.join(
  currentDirectory,
  "migrations",
);

/**
 * Create the migration history table if it does not already exist.
 *
 * This table records which migration files have been successfully applied.
 * Future migrations can therefore contain real ALTER TABLE operations rather
 * than depending exclusively on CREATE TABLE IF NOT EXISTS.
 */
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

/**
 * Retrieve the set of migration filenames already applied to this database.
 *
 * @returns {Set<string>} Applied migration filenames.
 */
function getAppliedMigrations() {
  const rows = db
    .prepare(
      `
        SELECT migration_name
        FROM schema_migrations
        ORDER BY migration_name;
      `,
    )
    .all();

  return new Set(
    rows.map((row) => row.migration_name),
  );
}

/**
 * Discover SQL migrations and return them in deterministic filename order.
 *
 * Numeric prefixes such as 001_, 002_, and 003_ make lexical sorting match
 * the intended migration sequence.
 *
 * @returns {string[]} Ordered migration filenames.
 */
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
 * Apply one migration and record it atomically.
 *
 * Wrapping the SQL and history insertion in one transaction prevents the
 * migration from being marked complete if part of its SQL fails.
 *
 * @param {string} migrationName Migration filename.
 */
function applyMigration(migrationName) {
  const migrationPath = path.join(
    migrationsDirectory,
    migrationName,
  );

  const migrationSql = fs.readFileSync(
    migrationPath,
    "utf8",
  );

  const recordMigration = db.prepare(`
    INSERT INTO schema_migrations (migration_name)
    VALUES (?);
  `);

  const runMigration = db.transaction(() => {
    db.exec(migrationSql);
    recordMigration.run(migrationName);
  });

  runMigration();
}

/**
 * Bring the configured SQLite database up to the latest known schema.
 */
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

/**
 * Run initialization when this file is executed through npm run db:init or
 * by one of the database maintenance scripts.
 */
try {
  initializeDatabase();
} catch (error) {
  console.error(
    `Database initialization failed: ${error.message}`,
  );

  process.exitCode = 1;
} finally {
  /**
   * This file is a command-line initialization utility rather than the
   * running application, so explicitly release its SQLite connection.
   */
  db.close();
}
