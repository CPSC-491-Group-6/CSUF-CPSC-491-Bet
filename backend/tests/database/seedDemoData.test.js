// backend/tests/database/seedDemoData.test.js

import assert from "node:assert/strict";
import test from "node:test";

import { createUserRepository } from "../../src/repositories/createUserRepository.js";
import {
  assertDatabaseIntegrity,
  assertForeignKeyIntegrity,
  createFileTestDatabaseHarness,
  getApplicationTableNames,
} from "../helpers/fileTestDatabase.js";

/**
 * Stable demo identities defined by the production seed utility.
 *
 * These values are semantic identifiers. The test deliberately does not
 * assume numeric userID values because SQLite owns primary-key generation.
 */
const demoCreatorEmail = "creator@example.com";
const demoParticipantEmail = "participant@example.com";

/**
 * Quote a SQLite identifier discovered from sqlite_schema.
 *
 * Table names passed to this helper are read directly from SQLite metadata,
 * not from external/user input. Quoting still protects names containing
 * unusual characters and keeps generated COUNT queries syntactically safe.
 *
 * @param {string} identifier
 * SQLite identifier to quote.
 * @returns {string}
 * Double-quoted SQLite identifier.
 */
function quoteSqliteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

/**
 * Capture deterministic row counts for every application-defined table.
 *
 * schema_migrations is included intentionally. The second seed execution runs
 * the migration entry point again, but already-applied migrations should not
 * add new migration-history rows. An identical snapshot therefore proves the
 * complete reset/seed result is repeatable rather than checking only users.
 *
 * @param {import("better-sqlite3").Database} database
 * Open SQLite connection.
 * @returns {Record<string, number>}
 * Table-name-to-row-count snapshot.
 */
function snapshotApplicationTableCounts(database) {
  const tableNames = getApplicationTableNames(database);

  return Object.fromEntries(
    tableNames.map((tableName) => {
      const quotedTableName = quoteSqliteIdentifier(tableName);

      const row = database
        .prepare(`SELECT COUNT(*) AS count FROM ${quotedTableName};`)
        .get();

      return [tableName, row.count];
    }),
  );
}

/**
 * Retrieve one demo user and fail with a precise message if it is missing.
 *
 * @param {import("better-sqlite3").Database} database
 * Open SQLite connection.
 * @param {string} email
 * Stable seeded email address.
 * @returns {{
 *   userID: number,
 *   username: string,
 *   email: string,
 *   passwordHash: string,
 *   verificationStatus: number,
 *   timeStamp: string
 * }}
 * Seeded user record.
 */
function requireDemoUser(database, email) {
  const userRepository = createUserRepository(database);
  const user = userRepository.findByEmail(email);

  assert.ok(user, `Expected seed process to create demo user ${email}.`);

  return user;
}

test("C-TEST-07-TC01 reset and seed create reproducible demo data", () => {
  const harness = createFileTestDatabaseHarness();

  try {
    /**
     * Execute the real reset utility first so the test follows the same
     * documented workflow a developer should use before preparing demo data.
     *
     * reset() also runs migrations, so the database is in a known schema
     * state before seed() begins.
     */
    const resetOutput = harness.reset();

    assert.match(
      resetOutput,
      /Database reset complete\./,
      "Expected database reset command to report successful completion.",
    );

    /**
     * Execute the production seed utility against the isolated DB_PATH.
     *
     * The helper waits for the command to complete. A non-zero child exit
     * status would throw and fail the test immediately.
     */
    const seedOutput = harness.seed();

    assert.match(
      seedOutput,
      /Database seed complete\./,
      "Expected seed command to report successful completion.",
    );

    const database = harness.open();

    try {
      /**
       * Verify both stable demo identities exist exactly once by semantic
       * email address instead of assuming generated numeric IDs.
       */
      const creator = requireDemoUser(database, demoCreatorEmail);

      const participant = requireDemoUser(database, demoParticipantEmail);

      assert.notEqual(
        creator.userID,
        participant.userID,
        "Creator and participant must be two distinct persisted users.",
      );

      const demoUserCount = database
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM users
            WHERE email IN (?, ?);
          `,
        )
        .get(demoCreatorEmail, demoParticipantEmail);

      assert.equal(
        demoUserCount.count,
        2,
        "Expected exactly two stable demo identities after seeding.",
      );

      /**
       * The production seed script also loads application fixtures from
       * src/data/seed.sql. At least one bet must therefore exist for the
       * Midterm demo data to be useful.
       *
       * This assertion intentionally avoids hard-coding bet primary keys or
       * assuming a particular participant-table name.
       */
      const betCount = database
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM bets;
          `,
        )
        .get();

      assert.ok(
        betCount.count > 0,
        "Expected seed process to create at least one demo bet.",
      );

      /**
       * Foreign-key and low-level SQLite integrity must both be clean after
       * all user, bet, and participant fixtures have been inserted.
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

test("C-TEST-07-TC02 repeated seed execution does not duplicate demo data", () => {
  const harness = createFileTestDatabaseHarness();

  try {
    harness.reset();
    harness.seed();

    let database = harness.open();
    let firstSeedSnapshot;

    try {
      /**
       * Snapshot every application table instead of checking only users.
       *
       * This detects accidental duplication in bets, participant
       * relationships, sessions, migration history, or future application
       * tables without coupling the test to generated primary-key values.
       */
      firstSeedSnapshot = snapshotApplicationTableCounts(database);

      requireDemoUser(database, demoCreatorEmail);
      requireDemoUser(database, demoParticipantEmail);

      assertDatabaseIntegrity(database);
      assertForeignKeyIntegrity(database);
    } finally {
      database.close();
    }

    /**
     * Run the same production seed command again against the same database.
     *
     * The seed implementation promises that stable demo identities are
     * skipped when already present. Application seed fixtures should likewise
     * have controlled repeat behavior rather than silently multiplying data.
     */
    const secondSeedOutput = harness.seed();

    assert.match(
      secondSeedOutput,
      /Database seed complete\./,
      "Expected second seed execution to complete successfully.",
    );

    database = harness.open();

    try {
      const secondSeedSnapshot = snapshotApplicationTableCounts(database);

      assert.deepEqual(
        secondSeedSnapshot,
        firstSeedSnapshot,
        "Expected repeated seed execution to leave application row counts unchanged.",
      );

      /**
       * Stable semantic identities must still resolve to one record each
       * after the second seed run.
       */
      const creatorCount = database
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM users
            WHERE email = ? COLLATE NOCASE;
          `,
        )
        .get(demoCreatorEmail);

      const participantCount = database
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM users
            WHERE email = ? COLLATE NOCASE;
          `,
        )
        .get(demoParticipantEmail);

      assert.equal(
        creatorCount.count,
        1,
        "Repeated seeding must not duplicate the demo creator.",
      );

      assert.equal(
        participantCount.count,
        1,
        "Repeated seeding must not duplicate the demo participant.",
      );

      assertDatabaseIntegrity(database);
      assertForeignKeyIntegrity(database);
    } finally {
      database.close();
    }
  } finally {
    harness.cleanup();
  }
});

test("C-TEST-07-TC03 production seed is rejected without changing data", () => {
  const harness = createFileTestDatabaseHarness();

  try {
    harness.initialize();

    /**
     * Create a sentinel record before the rejected production seed.
     *
     * The sentinel proves the production guard is checked before any
     * destructive or fixture-insertion behavior can alter existing data.
     */
    let database = harness.open();

    try {
      const userRepository = createUserRepository(database);

      userRepository.createUser({
        username: "seed_guard_user",
        email: "seed-guard@example.com",
        passwordHash: "$argon2id$test-only-hash",
      });

      assertDatabaseIntegrity(database);
      assertForeignKeyIntegrity(database);
    } finally {
      database.close();
    }

    /**
     * The production seed utility explicitly refuses NODE_ENV=production.
     * execFileSync therefore must throw because the child exits non-zero.
     */
    assert.throws(
      () => harness.seed({ NODE_ENV: "production" }),
      (error) => {
        assert.notEqual(
          error.status,
          0,
          "Production seed must exit with a non-zero status.",
        );

        return true;
      },
    );

    database = harness.open();

    try {
      /**
       * Verify the original database state still exists.
       */
      const sentinel = database
        .prepare(
          `
            SELECT email
            FROM users
            WHERE email = ?;
          `,
        )
        .get("seed-guard@example.com");

      assert.ok(
        sentinel,
        "Expected sentinel data to survive rejected production seed.",
      );

      /**
       * The production guard must run before demo identities are inserted.
       */
      const unexpectedDemoUsers = database
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM users
            WHERE email IN (?, ?);
          `,
        )
        .get(demoCreatorEmail, demoParticipantEmail);

      assert.equal(
        unexpectedDemoUsers.count,
        0,
        "Production seed must not insert demo identities.",
      );

      assertDatabaseIntegrity(database);
      assertForeignKeyIntegrity(database);
    } finally {
      database.close();
    }
  } finally {
    harness.cleanup();
  }
});
