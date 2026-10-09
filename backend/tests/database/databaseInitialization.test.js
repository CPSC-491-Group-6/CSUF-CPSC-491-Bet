// backend/tests/database/databaseInitialization.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createUserRepository } from "../../src/repositories/createUserRepository.js";
import {
  assertDatabaseIntegrity,
  assertForeignKeyIntegrity,
  createFileTestDatabaseHarness,
  getApplicationTableNames,
} from "../helpers/fileTestDatabase.js";

/**
 * Core tables expected from the current migration-backed backend foundation.
 *
 * Keep this list synchronized with the actual migration files on the branch.
 * When Sprint 3 introduces the final participant/join table, add its exact
 * production table name here only after that migration exists. Do not invent
 * test-only schema names.
 */
const requiredCoreTables = ["bets", "schema_migrations", "sessions", "users"];

test("C-TEST-05-TC01 initializes a clean database through real migrations", () => {
  const harness = createFileTestDatabaseHarness();

  try {
    /**
     * Preconditions:
     * - The harness has generated a unique DB_PATH.
     * - The database file does not yet exist.
     *
     * This proves the test starts from a clean state rather than depending on
     * a previously initialized developer database.
     */
    assert.equal(fs.existsSync(harness.databasePath), false);

    const output = harness.initialize();

    /**
     * Expected result:
     * - execFileSync returns normally, which means the migration process
     *   exited with status 0.
     * - The SQLite file now exists.
     * - The migration script reports that the database is ready.
     */
    assert.equal(fs.existsSync(harness.databasePath), true);
    assert.match(output, /Database ready:/);

    const database = harness.open();

    try {
      const tableNames = getApplicationTableNames(database);

      /**
       * Verify the real migration process created every currently required
       * core table. The test intentionally does not duplicate CREATE TABLE
       * statements because the migration files are the source of truth.
       */
      for (const tableName of requiredCoreTables) {
        assert.ok(
          tableNames.includes(tableName),
          `Expected migrated schema to contain table "${tableName}". ` +
            `Found: ${tableNames.join(", ")}`,
        );
      }

      /**
       * Verify that initialization used the migration tracking mechanism and
       * did not merely create an empty SQLite file.
       */
      const migrationRow = database
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM schema_migrations;
          `,
        )
        .get();

      assert.ok(
        migrationRow.count > 0,
        "Expected schema_migrations to record at least one migration.",
      );

      /**
       * Both SQLite integrity checks must pass independently.
       */
      assertDatabaseIntegrity(database);
      assertForeignKeyIntegrity(database);
    } finally {
      database.close();
    }
  } finally {
    harness.cleanup();
  }
});

test("C-TEST-05-TC02 reset removes application data and recreates schema", () => {
  const harness = createFileTestDatabaseHarness();

  try {
    harness.initialize();

    /**
     * Insert one deterministic application record before reset.
     *
     * The test uses the production user repository instead of a raw INSERT
     * so the sentinel record is created through existing application data
     * access code.
     */
    let database = harness.open();

    try {
      const userRepository = createUserRepository(database);

      userRepository.createUser({
        username: "reset_test_user",
        email: "reset-test@example.com",
        passwordHash: "$argon2id$test-only-hash",
      });

      const beforeReset = database
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM users
            WHERE email = ?;
          `,
        )
        .get("reset-test@example.com");

      assert.equal(beforeReset.count, 1);
    } finally {
      database.close();
    }

    /**
     * Execute the repository's real reset command.
     *
     * The reset utility should delete the test DB/runtime files and rerun the
     * centralized migration process against the same isolated DB_PATH.
     */
    const resetOutput = harness.reset();

    assert.match(resetOutput, /Database reset complete\./);

    database = harness.open();

    try {
      /**
       * The sentinel application record must be gone after reset.
       */
      const afterReset = database
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM users
            WHERE email = ?;
          `,
        )
        .get("reset-test@example.com");

      assert.equal(afterReset.count, 0);

      /**
       * Reset should recreate a usable migrated schema rather than leaving an
       * empty or missing database.
       */
      const tableNames = getApplicationTableNames(database);

      for (const tableName of requiredCoreTables) {
        assert.ok(
          tableNames.includes(tableName),
          `Expected reset schema to contain table "${tableName}".`,
        );
      }

      assertDatabaseIntegrity(database);
      assertForeignKeyIntegrity(database);
    } finally {
      database.close();
    }
  } finally {
    harness.cleanup();
  }
});

test("C-TEST-05-TC03 production reset is rejected before deleting data", () => {
  const harness = createFileTestDatabaseHarness();

  try {
    harness.initialize();

    /**
     * Create a sentinel record that must survive the rejected production
     * reset. If the reset command deletes the DB before checking NODE_ENV,
     * this assertion will fail when the database is reopened.
     */
    let database = harness.open();

    try {
      const userRepository = createUserRepository(database);

      userRepository.createUser({
        username: "production_guard_user",
        email: "production-guard@example.com",
        passwordHash: "$argon2id$test-only-hash",
      });
    } finally {
      database.close();
    }

    /**
     * The reset utility is destructive and should explicitly refuse to run
     * when NODE_ENV=production.
     *
     * execFileSync throws because the child command should exit non-zero.
     */
    assert.throws(
      () => harness.reset({ NODE_ENV: "production" }),
      (error) => {
        assert.notEqual(
          error.status,
          0,
          "Production reset must exit with a non-zero status.",
        );

        return true;
      },
    );

    /**
     * Reopen the same SQLite file and confirm the sentinel record still
     * exists. This proves the safety guard was evaluated before destructive
     * reset behavior occurred.
     */
    database = harness.open();

    try {
      const preservedUser = database
        .prepare(
          `
            SELECT email
            FROM users
            WHERE email = ?;
          `,
        )
        .get("production-guard@example.com");

      assert.ok(
        preservedUser,
        "Expected sentinel user to survive rejected production reset.",
      );

      assert.equal(preservedUser.email, "production-guard@example.com");

      assertDatabaseIntegrity(database);
      assertForeignKeyIntegrity(database);
    } finally {
      database.close();
    }
  } finally {
    harness.cleanup();
  }
});
