// backend/scripts/resetDatabase.js

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

import dotenv from "dotenv";

// Load the same local .env file used by the backend.
dotenv.config();

/**
 * Resolve database/runtime configuration without importing src/config/env.js.
 *
 * The reset utility only needs database and port information. Keeping this
 * maintenance script independent of the full application configuration also
 * makes its destructive behavior easier to audit.
 */
const nodeEnv = process.env.NODE_ENV || "development";
const port = Number(process.env.PORT || 3000);
const configuredDbPath = process.env.DB_PATH || "./data/bet.db";
const databasePath = path.resolve(process.cwd(), configuredDbPath);

/**
 * Refuse to run destructive database tooling in production.
 *
 * A reset command intentionally deletes the configured SQLite database, so
 * accidentally running it against a production environment must fail before
 * touching any files.
 */
function assertNotProduction() {
  if (nodeEnv === "production") {
    throw new Error("Database reset is disabled when NODE_ENV=production.");
  }
}

/**
 * Check whether something is currently accepting connections on the backend
 * port.
 *
 * Resetting SQLite while the running backend still has the database open can
 * leave that process using an unlinked or stale database file. The safest
 * development workflow is therefore to stop the backend before resetting.
 *
 * @returns {Promise<boolean>} true when the configured port is in use.
 */
function isBackendPortInUse() {
  return new Promise((resolve) => {
    const socket = net.createConnection({
      host: "127.0.0.1",
      port,
    });

    // Avoid waiting indefinitely if the port cannot be reached.
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
 * Delete a file when it exists.
 *
 * SQLite may create the main database plus -wal and -shm companion files.
 * Resetting should remove all three so initialization starts from a genuinely
 * clean local state.
 */
function removeIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  fs.rmSync(filePath);

  console.log(`Removed ${path.relative(process.cwd(), filePath)}`);
}

/**
 * Recreate the schema using the project's existing initialization script.
 *
 * Calling the established db:init implementation keeps the reset command from
 * duplicating schema SQL. Future schema changes therefore continue to have a
 * single source of truth in src/db/init.js.
 */
function initializeDatabase() {
  execFileSync(process.execPath, ["src/db/init.js"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
}

/**
 * Perform a complete local database reset.
 *
 * The operation:
 * 1. verifies the environment is not production,
 * 2. verifies the backend is not currently listening,
 * 3. deletes SQLite database files,
 * 4. recreates the schema.
 */
async function resetDatabase() {
  assertNotProduction();

  if (await isBackendPortInUse()) {
    throw new Error(
      `Port ${port} is currently in use. Stop the backend before running npm run db:reset.`,
    );
  }

  console.log(`Resetting SQLite database at ${databasePath}`);

  removeIfPresent(databasePath);
  removeIfPresent(`${databasePath}-wal`);
  removeIfPresent(`${databasePath}-shm`);

  console.log("Recreating database schema...");

  initializeDatabase();

  console.log("Database reset complete.");
}

try {
  await resetDatabase();
} catch (error) {
  console.error(`Database reset failed: ${error.message}`);

  process.exitCode = 1;
}
