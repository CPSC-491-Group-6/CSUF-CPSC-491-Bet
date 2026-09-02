// backend/src/db/database.js

import Database from "better-sqlite3";
import path from "node:path";

import { env } from "../config/env.js";

// Resolve the database path relative to the directory where the
// backend process was started.
//
// With DB_PATH=./data/bet.db, this resolves to:
// backend/data/bet.db
const dbPath = path.resolve(env.dbPath);

// Open the SQLite database connection.
//
// If the database file does not already exist, better-sqlite3
// will create it when the connection is opened.
const db = new Database(dbPath);

// Enforce SQLite foreign-key relationships.
//
// This will become important once tables such as `bets` and
// `participants` reference `userID` and `betID`.
db.pragma("foreign_keys = ON");

// Use SQLite's Write-Ahead Logging mode.
// WAL is a commonly recommended mode for better read/write behavior.
db.pragma("journal_mode = WAL");

// Export one shared database connection.
//
// Repository files will import this connection later instead of
// opening separate SQLite connections themselves.
export default db;
