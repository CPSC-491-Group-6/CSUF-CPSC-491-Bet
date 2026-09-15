// backend/src/db/database.js

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { env } from "../config/env.js";

// Resolve the configured database path.
//
// With DB_PATH=./data/bet.db, this resolves to:
// backend/data/bet.db
const dbPath = path.resolve(env.dbPath);

// Determine which directory must exist before SQLite can create/open
// the configured database file.
const dbDirectory = path.dirname(dbPath);

try {
  // Create the database directory and any missing parent directories.
  // recursive: true makes this safe when the directory already exists.
  mkdirSync(dbDirectory, { recursive: true });
} catch (error) {
  throw new Error(
    `Unable to create SQLite database directory: ${dbDirectory}`,
    {
      cause: error,
    },
  );
}

// Open the SQLite database.
//
// better-sqlite3 can create the database file itself, but only after
// its parent directory exists.
const db = new Database(dbPath);

// Enforce foreign-key relationships such as:
// bets.creatorID -> users.userID
// participants.userID -> users.userID
// participants.betID -> bets.betID
db.pragma("foreign_keys = ON");

// Use SQLite Write-Ahead Logging for improved read/write behavior.
db.pragma("journal_mode = WAL");

// Export one shared database connection.
// Repository modules will use this connection instead of opening
// independent SQLite connections.
export default db;
