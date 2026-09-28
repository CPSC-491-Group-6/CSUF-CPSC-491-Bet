// backend/scripts/resetDatabase.js

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

import dotenv from "dotenv";

/**
 * Load backend/.env so this maintenance command operates on the same local
 * database normally used by the backend.
 */
dotenv.config();

const nodeEnv = process.env.NODE_ENV?.trim() || "development";

const configuredDbPath = process.env.DB_PATH?.trim() || "./data/bet.db";

/**
 * Parse PORT locally because this destructive maintenance utility
 * intentionally does not import the full application configuration.
 *
 * @param {string | undefined} value Raw PORT environment value.
 * @returns {number} Valid TCP port.
 */
function parsePort(value) {
  if (value === undefined || value.trim() === "") {
    return 3000;
  }

  const normalizedValue = value.trim();

  if (!/^\d+$/.test(normalizedValue)) {
    throw new Error(
      `Invalid PORT "${value}". PORT must be an integer from 1 to 65535.`,
    );
  }

  const parsedPort = Number(normalizedValue);

  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    throw new Error(
      `Invalid PORT "${value}". PORT must be an integer from 1 to 65535.`,
    );
  }

  return parsedPort;
}

const port = parsePort(process.env.PORT);

/**
 * Resolve the database path exactly once so the reset operation and all
 * companion-file cleanup target the same SQLite database.
 */
const databasePath = path.resolve(process.cwd(), configuredDbPath);

/**
 * Refuse destructive reset behavior in production.
 *
 * db:reset intentionally deletes the configured SQLite database and must
 * therefore fail before touching any files when NODE_ENV=production.
 */
function assertNotProduction() {
  if (nodeEnv === "production") {
    throw new Error("Database reset is disabled when NODE_ENV=production.");
  }
}

/**
 * Check whether the backend appears to be listening on its configured port.
 *
 * Deleting SQLite files while a running backend still owns an open
 * connection can leave that process operating against an unlinked or stale
 * file. Developers should stop the backend before resetting.
 *
 * @returns {Promise<boolean>} true when something accepts the connection.
 */
function isBackendPortInUse() {
  return new Promise((resolve) => {
    const socket = net.createConnection({
      host: "127.0.0.1",
      port,
    });

    /**
     * Prevent the safety check from hanging when no process answers.
     */
    socket.setTimeout(500);

    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.on("error", () => {
      resolve(false);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Delete a SQLite-related file only when it exists.
 *
 * @param {string} filePath Absolute file path to remove.
 */
function removeIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  fs.rmSync(filePath);

  console.log(`Removed ${path.relative(process.cwd(), filePath)}`);
}

/**
 * Recreate the database schema through the centralized migration runner.
 *
 * Keeping resetDatabase.js dependent on src/data/init.js avoids copying
 * migration logic into maintenance scripts.
 */
function initializeDatabase() {
  execFileSync(process.execPath, ["src/data/init.js"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
}

/**
 * Perform a complete local schema reset.
 *
 * The reset intentionally does NOT automatically seed demo data. This keeps
 * db:reset useful when developers or CI need a completely empty database.
 *
 * Developers wanting fixtures can run:
 *
 *   npm run db:reset
 *   npm run db:seed
 *
 * The operation:
 *   1. rejects production,
 *   2. confirms the backend is not currently listening,
 *   3. removes SQLite database/runtime files,
 *   4. runs all schema migrations from a clean state.
 */
async function resetDatabase() {
  assertNotProduction();

  if (await isBackendPortInUse()) {
    throw new Error(
      `Port ${port} is currently in use. Stop the backend before running npm run db:reset.`,
    );
  }

  console.log(`Resetting SQLite database at ${databasePath}`);

  /**
   * SQLite WAL mode may create -wal and -shm companion files. A traditional
   * rollback journal can also create -journal, so remove all known runtime
   * artifacts to guarantee a clean reset.
   */
  removeIfPresent(databasePath);
  removeIfPresent(`${databasePath}-wal`);
  removeIfPresent(`${databasePath}-shm`);
  removeIfPresent(`${databasePath}-journal`);

  console.log("Recreating database schema...");

  initializeDatabase();

  console.log("Database reset complete.");
}

/**
 * Surface errors and return a non-zero process status for local scripts and
 * CI runners.
 */
try {
  await resetDatabase();
} catch (error) {
  console.error(`Database reset failed: ${error.message}`);

  process.exitCode = 1;
}
