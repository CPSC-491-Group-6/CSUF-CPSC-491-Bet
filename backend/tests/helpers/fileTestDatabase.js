// backend/tests/helpers/fileTestDatabase.js

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

/**
 * Resolve the backend project directory from this helper's location.
 *
 * Tests may be launched from the backend directory, repository root, or CI.
 * Deriving the path from this file makes child-process commands independent
 * of the shell's current working directory.
 */
const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const backendDirectory = path.resolve(currentDirectory, "../..");

/**
 * Deterministic test-only session secret.
 *
 * The backend environment validator requires SESSION_SECRET to contain at
 * least 32 characters. This value is not a real credential and exists only so
 * database maintenance scripts can load the normal backend configuration in
 * automated tests.
 */
const testSessionSecret = "member-c-database-test-session-secret-2026";

/**
 * High test-only port used by reset/seed safety checks.
 *
 * The database reset tooling may refuse to run if the configured backend port
 * is already in use. Using a dedicated high port reduces the chance that a
 * developer's normal backend process interferes with persistence tests.
 */
const defaultTestPort = "65534";

/**
 * Execute a backend Node script with a supplied environment.
 *
 * execFileSync waits for the child process to finish. If the child process
 * exits with a non-zero status, execFileSync throws, which causes the calling
 * test to fail unless that failure is the behavior being tested.
 *
 * @param {string} relativeScriptPath
 * Path to the script relative to the backend directory.
 * @param {Record<string, string | undefined>} environment
 * Environment variables to provide to the child process.
 * @returns {string}
 * Captured stdout from the child process.
 */
function runBackendNodeScript(relativeScriptPath, environment) {
  return execFileSync(process.execPath, [relativeScriptPath], {
    cwd: backendDirectory,
    env: environment,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * Create an isolated file-backed SQLite test harness.
 *
 * Existing authentication tests use an intentionally small in-memory schema.
 * Member C persistence tests need a different helper because they must verify
 * the repository's real migrations, reset behavior, seed behavior, SQLite
 * files, WAL/journal cleanup, and close/reopen persistence.
 *
 * Each harness receives its own temporary directory and SQLite file. Tests
 * therefore never read from or write to the normal developer database.
 *
 * @param {{ port?: string }} [options]
 * Optional test-only backend port override.
 * @returns {{
 *   backendDirectory: string,
 *   databasePath: string,
 *   tempDirectory: string,
 *   initialize: (
 *     envOverrides?: Record<string, string | undefined>
 *   ) => string,
 *   reset: (
 *     envOverrides?: Record<string, string | undefined>
 *   ) => string,
 *   seed: (
 *     envOverrides?: Record<string, string | undefined>
 *   ) => string,
 *   open: () => Database.Database,
 *   cleanup: () => void
 * }}
 * Helper functions for one isolated test database.
 */
export function createFileTestDatabaseHarness(options = {}) {
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "bet-database-test-"),
  );

  const databasePath = path.join(tempDirectory, "bet-test.db");

  /**
   * Environment shared by migration/reset/seed child processes.
   *
   * DB_PATH is absolute so every maintenance command targets only this
   * harness's temporary SQLite file.
   */
  const baseEnvironment = {
    ...process.env,
    NODE_ENV: "test",
    DB_PATH: databasePath,
    SESSION_SECRET: testSessionSecret,
    PORT: options.port ?? defaultTestPort,
  };

  /**
   * Merge one-time environment overrides with the test environment and run a
   * backend maintenance script.
   *
   * @param {string} relativeScriptPath
   * Path to a backend Node script.
   * @param {Record<string, string | undefined>} [envOverrides]
   * Optional environment values used only for this invocation.
   * @returns {string}
   * Captured stdout from the maintenance script.
   */
  function run(relativeScriptPath, envOverrides = {}) {
    return runBackendNodeScript(relativeScriptPath, {
      ...baseEnvironment,
      ...envOverrides,
    });
  }

  return {
    backendDirectory,
    databasePath,
    tempDirectory,

    /**
     * Apply the repository's real database migrations.
     *
     * This intentionally calls the production migration entry point rather
     * than recreating CREATE TABLE statements inside the test suite.
     *
     * @param {Record<string, string | undefined>} [envOverrides]
     * Optional environment values for this invocation.
     * @returns {string}
     * Captured migration output.
     */
    initialize(envOverrides = {}) {
      return run("src/data/init.js", envOverrides);
    },

    /**
     * Execute the repository's real database reset utility against the
     * isolated test database.
     *
     * @param {Record<string, string | undefined>} [envOverrides]
     * Optional environment values for this invocation.
     * @returns {string}
     * Captured reset output.
     */
    reset(envOverrides = {}) {
      return run("scripts/resetDatabase.js", envOverrides);
    },

    /**
     * Execute the repository's real seed utility against the isolated test
     * database.
     *
     * C-TEST-07 can reuse this function to validate deterministic Midterm demo
     * data without touching a developer's local database.
     *
     * @param {Record<string, string | undefined>} [envOverrides]
     * Optional environment values for this invocation.
     * @returns {string}
     * Captured seed output.
     */
    seed(envOverrides = {}) {
      return run("scripts/seedDatabase.js", envOverrides);
    },

    /**
     * Open a fresh SQLite connection to the isolated test database.
     *
     * Returning a new connection for each call is important for durability
     * tests. C-TEST-06 can close one connection and later open another to prove
     * that committed data was stored in the file rather than existing only in
     * connection-local state.
     *
     * @returns {Database.Database}
     * Fresh better-sqlite3 database connection.
     */
    open() {
      const database = new Database(databasePath);

      // Match important safety settings used by the application.
      database.pragma("foreign_keys = ON");
      database.pragma("busy_timeout = 5000");

      return database;
    },

    /**
     * Delete the complete temporary test directory.
     *
     * Removing the directory also removes SQLite runtime artifacts such as
     * `-wal`, `-shm`, and `-journal` files. This prevents one test from
     * affecting another test through leftover SQLite state.
     */
    cleanup() {
      fs.rmSync(tempDirectory, {
        recursive: true,
        force: true,
      });
    },
  };
}

/**
 * Return application-defined SQLite tables in deterministic order.
 *
 * SQLite internal tables are intentionally excluded because schema assertions
 * should focus on objects created by the application's migration process.
 *
 * @param {Database.Database} database
 * Open SQLite connection.
 * @returns {string[]}
 * Sorted application table names.
 */
export function getApplicationTableNames(database) {
  return database
    .prepare(
      `
      SELECT name
      FROM sqlite_schema
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name;
    `,
    )
    .all()
    .map((row) => row.name);
}

/**
 * Assert that SQLite's built-in structural integrity check succeeds.
 *
 * PRAGMA integrity_check validates low-level SQLite consistency and selected
 * constraint/index conditions. It does not replace foreign-key verification,
 * so assertForeignKeyIntegrity() must remain a separate check.
 *
 * @param {Database.Database} database
 * Open SQLite connection.
 */
export function assertDatabaseIntegrity(database) {
  const result = database.pragma("integrity_check", {
    simple: true,
  });

  assert.equal(
    result,
    "ok",
    `Expected PRAGMA integrity_check to return "ok", received ${String(result)}`,
  );
}

/**
 * Assert that SQLite reports zero foreign-key violations.
 *
 * @param {Database.Database} database
 * Open SQLite connection.
 */
export function assertForeignKeyIntegrity(database) {
  const violations = database.pragma("foreign_key_check");

  assert.deepEqual(
    violations,
    [],
    `Expected no foreign-key violations, received ${JSON.stringify(violations)}`,
  );
}
