// backend/src/data/database.js

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { env } from "../config/env.js";

/**
 * Resolve the application's configured SQLite database location.
 *
 * DB_PATH may be:
 *   - a relative path such as "./data/bet.db",
 *   - an absolute filesystem path,
 *   - ":memory:" for an in-memory SQLite database during testing.
 *
 * Relative paths are resolved from the backend process's current working
 * directory. In normal development, the backend is started from backend/,
 * so the default "./data/bet.db" becomes backend/data/bet.db.
 */
const databasePath =
  env.dbPath === ":memory:" ? ":memory:" : path.resolve(env.dbPath);

/**
 * SQLite can create a missing database file, but it cannot create missing
 * parent directories.
 *
 * In-memory databases do not use the filesystem, so directory creation is
 * skipped when DB_PATH is ":memory:".
 */
if (databasePath !== ":memory:") {
  const databaseDirectory = path.dirname(databasePath);

  try {
    /**
     * recursive: true makes directory creation safe when the directory
     * already exists and also creates any missing parent directories.
     */
    mkdirSync(databaseDirectory, {
      recursive: true,
    });
  } catch (error) {
    throw new Error(
      `Unable to create SQLite database directory: ${databaseDirectory}`,
      {
        cause: error,
      },
    );
  }
}

/**
 * Open the application's shared SQLite connection.
 *
 * Repository and service modules should import this instance rather than
 * opening independent better-sqlite3 connections. This keeps connection
 * settings consistent throughout the running backend.
 */
let db;

try {
  db = new Database(databasePath);
} catch (error) {
  throw new Error(
    `Unable to open SQLite database at "${databasePath}".`,
    {
      cause: error,
    },
  );
}

/**
 * Enforce declared FOREIGN KEY constraints.
 *
 * SQLite does not enforce foreign keys unless this setting is enabled for
 * the active database connection.
 */
db.pragma("foreign_keys = ON");

/**
 * Enable Write-Ahead Logging for file-backed databases.
 *
 * WAL generally improves development behavior when reads and writes happen
 * concurrently. An in-memory database does not need WAL mode.
 */
if (databasePath !== ":memory:") {
  db.pragma("journal_mode = WAL");
}

/**
 * Allow SQLite a short amount of time to wait when another connection
 * temporarily holds a database lock instead of immediately throwing
 * SQLITE_BUSY.
 */
db.pragma("busy_timeout = 5000");

/**
 * Export the resolved path for maintenance/debugging code that needs to
 * report which database is currently in use.
 */
export { databasePath };

/**
 * Export one shared application database connection.
 */
export default db;
