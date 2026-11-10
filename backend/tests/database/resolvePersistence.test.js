import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import {
  assertDatabaseIntegrity,
  assertForeignKeyIntegrity,
  createFileTestDatabaseHarness,
} from "../helpers/fileTestDatabase.js";

import { createCreatorUser, createParticipantUser } from "../fixtures/users.js";

import { createLockedBet } from "../fixtures/bets.js";

/**
 * SCRUM-735 / C-TEST-08
 *
 * Verify SQLite persistence requirements for Resolve Bet.
 *
 * These tests use real migrations and an isolated file-backed database.
 * They validate resolved-state storage, winning-option relationships,
 * participant preservation, restart durability, and database constraints.
 *
 * Until the backend Resolve operation is available, a test-only SQL
 * operation establishes resolved state. Application-level Resolve
 * validation will be added separately.
 */

/**
 * Read the persistent resolution fields for one bet.
 *
 * @param {import("better-sqlite3").Database} database
 * @param {string} betID
 * @returns {object | undefined}
 */
function readBet(database, betID) {
  return database
    .prepare(
      `
      SELECT
        id,
        creator_id,
        title,
        join_code,
        status,
        locked_at,
        resolved_at,
        winning_option_id
      FROM bets
      WHERE id = ?
      `,
    )
    .get(betID);
}

/**
 * Read existing participant relationships and selected answers.
 *
 * Deterministic ordering allows complete before/after comparisons.
 *
 * @param {import("better-sqlite3").Database} database
 * @param {string} betID
 * @returns {object[]}
 */
function readParticipants(database, betID) {
  return database
    .prepare(
      `
      SELECT
        bet_id,
        user_id,
        joined_at,
        selected_option_id
      FROM bet_participants
      WHERE bet_id = ?
      ORDER BY user_id
      `,
    )
    .all(betID);
}

/**
 * Identify winners using the persisted winning option.
 *
 * A participant wins when their selected option matches the resolved
 * bet's winning_option_id.
 *
 * This query does not create new winner records or modify memberships.
 *
 * @param {import("better-sqlite3").Database} database
 * @param {string} betID
 * @returns {object[]}
 */
function readWinners(database, betID) {
  return database
    .prepare(
      `
      SELECT
        bp.user_id,
        bp.selected_option_id
      FROM bet_participants AS bp
      JOIN bets AS b
        ON b.id = bp.bet_id
      WHERE b.id = ?
        AND b.status = 'resolved'
        AND bp.selected_option_id = b.winning_option_id
      ORDER BY bp.user_id
      `,
    )
    .all(betID);
}

/**
 * Establish a resolved state directly in the isolated test database.
 *
 * This is a database test helper, NOT an application Resolve
 * implementation.
 *
 * The UPDATE includes a locked-state condition to establish the
 * expected starting state for database-level tests.
 *
 * @param {import("better-sqlite3").Database} database
 * @param {string} betID
 * @param {string} winningOptionID
 * @returns {number} Number of updated rows.
 */
function persistTestResolution(database, betID, winningOptionID) {
  const result = database
    .prepare(
      `
      UPDATE bets
      SET
        status = 'resolved',
        winning_option_id = ?,
        resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
        AND status = 'locked'
      `,
    )
    .run(winningOptionID, betID);

  return result.changes;
}

/**
 * Build one independent Resolve persistence fixture.
 *
 * The fixture uses:
 * - The existing file-backed test database harness.
 * - The application's actual migration runner.
 * - Existing creator and participant user helpers.
 * - The existing locked-bet fixture.
 * - Two valid bet options.
 * - Creator, winning participant, and losing participant membership.
 *
 * Every test gets its own SQLite file. The database and temporary
 * directory are cleaned up automatically after the test.
 *
 * @param {import("node:test").TestContext} context
 * @returns {object} Fixture and database access helpers.
 */
function createResolutionFixture(context) {
  const harness = createFileTestDatabaseHarness();

  let database;

  try {
    // Initialize the real application schema in an isolated SQLite file.
    harness.initialize();
    database = harness.open();

    const creator = createCreatorUser(database);
    const winner = createParticipantUser(database);
    const loser = createParticipantUser(database);

    // Reuse the existing fixture for a valid locked bet.
    const bet = createLockedBet(database, creator, {
      title: "C-TEST-08 Resolve Persistence",
      description: "Isolated resolution persistence fixture",
      max_participants: 5,
    });

    const winningOptionID = randomUUID();
    const losingOptionID = randomUUID();

    // Create two outcomes belonging to this exact bet.
    const insertOption = database.prepare(
      `
      INSERT INTO bet_options (
        id,
        bet_id,
        label,
        position
      )
      VALUES (?, ?, ?, ?)
      `,
    );

    insertOption.run(winningOptionID, bet.id, "Option A", 0);
    insertOption.run(losingOptionID, bet.id, "Option B", 1);

    // Store the original memberships and selected answers.
    const insertParticipant = database.prepare(
      `
      INSERT INTO bet_participants (
        bet_id,
        user_id,
        selected_option_id
      )
      VALUES (?, ?, ?)
      `,
    );

    /**
     * createLockedBet() uses createBetRepository(), which automatically
     * registers the creator as the bet's initial participant.
     *
     * Verify that the creator's membership already exists instead of
     * inserting it again and violating the composite primary key.
     */
    const creatorMembership = database
      .prepare(
        `
        SELECT
          bet_id,
          user_id,
          selected_option_id
        FROM bet_participants
        WHERE bet_id = ?
          AND user_id = ?
        `,
      )
      .get(bet.id, creator.userID);

    assert.ok(
      creatorMembership,
      "The creator must already be registered as a participant.",
    );

    assert.equal(creatorMembership.bet_id, bet.id);
    assert.equal(creatorMembership.user_id, creator.userID);
    assert.equal(creatorMembership.selected_option_id, null);

    /**
     * Add only the additional participants.
     *
     * These records represent one winning selection and one losing
     * selection for the persistence tests.
     */
    insertParticipant.run(bet.id, winner.userID, winningOptionID);

    insertParticipant.run(bet.id, loser.userID, losingOptionID);

    /**
     * Register cleanup before returning the fixture.
     *
     * Reopened connections replace the database reference, ensuring
     * the final active connection is closed before removing the files.
     */
    context.after(() => {
      if (database?.open) {
        database.close();
      }

      harness.cleanup();
    });

    return {
      harness,
      bet,
      creator,
      winner,
      loser,
      winningOptionID,
      losingOptionID,

      // Return the currently active SQLite connection.
      get database() {
        return database;
      },

      // Close and reopen the same file to verify durable storage.
      reopen() {
        database.close();
        database = harness.open();

        return database;
      },
    };
  } catch (error) {
    if (database?.open) {
      database.close();
    }

    harness.cleanup();

    throw error;
  }
}

/**
 * C-TEST-08-TC01
 *
 * A valid database-level resolution stores the final status,
 * winning option, and resolution timestamp.
 */
test("C-TEST-08-TC01: valid resolution persists resolved state", (context) => {
  const fixture = createResolutionFixture(context);

  const before = readBet(fixture.database, fixture.bet.id);

  assert.equal(before.status, "locked");
  assert.ok(before.locked_at);
  assert.equal(before.resolved_at, null);
  assert.equal(before.winning_option_id, null);

  const changes = persistTestResolution(
    fixture.database,
    fixture.bet.id,
    fixture.winningOptionID,
  );

  assert.equal(changes, 1);

  const after = readBet(fixture.database, fixture.bet.id);

  assert.equal(after.status, "resolved");
  assert.equal(after.winning_option_id, fixture.winningOptionID);
  assert.ok(after.resolved_at);
  assert.equal(after.locked_at, before.locked_at);
  assert.equal(after.creator_id, fixture.creator.userID);
});

/**
 * C-TEST-08-TC02
 *
 * Participants selecting the persisted winning option are winners.
 * Participants selecting another option are excluded.
 */
test("C-TEST-08-TC02: winning participants match the stored outcome", (context) => {
  const fixture = createResolutionFixture(context);

  assert.equal(
    persistTestResolution(
      fixture.database,
      fixture.bet.id,
      fixture.winningOptionID,
    ),
    1,
  );

  const winners = readWinners(fixture.database, fixture.bet.id);

  assert.deepEqual(winners, [
    {
      user_id: fixture.winner.userID,
      selected_option_id: fixture.winningOptionID,
    },
  ]);

  assert.ok(!winners.some((row) => row.user_id === fixture.loser.userID));

  assert.ok(!winners.some((row) => row.user_id === fixture.creator.userID));
});

/**
 * C-TEST-08-TC03
 *
 * Resolution must preserve the original bet owner and every
 * participant relationship, including selected answers.
 */
test("C-TEST-08-TC03: resolution preserves creator and participants", (context) => {
  const fixture = createResolutionFixture(context);

  const beforeBet = readBet(fixture.database, fixture.bet.id);

  const beforeParticipants = readParticipants(fixture.database, fixture.bet.id);

  assert.equal(beforeParticipants.length, 3);

  assert.equal(
    persistTestResolution(
      fixture.database,
      fixture.bet.id,
      fixture.winningOptionID,
    ),
    1,
  );

  const afterBet = readBet(fixture.database, fixture.bet.id);

  const afterParticipants = readParticipants(fixture.database, fixture.bet.id);

  assert.equal(afterBet.creator_id, beforeBet.creator_id);
  assert.equal(afterBet.id, beforeBet.id);
  assert.equal(afterBet.title, beforeBet.title);
  assert.equal(afterBet.join_code, beforeBet.join_code);
  assert.equal(afterBet.locked_at, beforeBet.locked_at);

  // Compare every persisted membership field.
  assert.deepEqual(afterParticipants, beforeParticipants);

  // Confirm that all expected users retain membership.
  assert.deepEqual(
    afterParticipants.map((row) => row.user_id),
    [fixture.creator.userID, fixture.winner.userID, fixture.loser.userID],
  );
});

/**
 * C-TEST-08-TC04
 *
 * Closing and reopening the SQLite file must preserve both the
 * resolved bet and the ability to identify winning participants.
 */
test("C-TEST-08-TC04: resolved outcome survives database reopening", (context) => {
  const fixture = createResolutionFixture(context);

  assert.equal(
    persistTestResolution(
      fixture.database,
      fixture.bet.id,
      fixture.winningOptionID,
    ),
    1,
  );

  const before = readBet(fixture.database, fixture.bet.id);

  const participantsBefore = readParticipants(fixture.database, fixture.bet.id);

  // Reopen the same SQLite file through the existing harness.
  const reopenedDatabase = fixture.reopen();

  const after = readBet(reopenedDatabase, fixture.bet.id);

  const participantsAfter = readParticipants(reopenedDatabase, fixture.bet.id);

  assert.deepEqual(after, before);
  assert.deepEqual(participantsAfter, participantsBefore);

  assert.equal(after.status, "resolved");
  assert.equal(after.winning_option_id, fixture.winningOptionID);
  assert.ok(after.resolved_at);

  assert.deepEqual(readWinners(reopenedDatabase, fixture.bet.id), [
    {
      user_id: fixture.winner.userID,
      selected_option_id: fixture.winningOptionID,
    },
  ]);

  assertDatabaseIntegrity(reopenedDatabase);
  assertForeignKeyIntegrity(reopenedDatabase);
});

/**
 * C-TEST-08-TC05
 *
 * SQLite must reject an outcome option owned by another bet.
 * The failed update must leave the original bet state unchanged.
 */
test("C-TEST-08-TC05: another bet's winning option is rejected", (context) => {
  const fixture = createResolutionFixture(context);

  const otherBet = createLockedBet(fixture.database, fixture.creator, {
    title: "Unrelated Resolve Test Bet",
  });

  const otherOptionID = randomUUID();

  fixture.database
    .prepare(
      `
      INSERT INTO bet_options (
        id,
        bet_id,
        label,
        position
      )
      VALUES (?, ?, ?, ?)
      `,
    )
    .run(otherOptionID, otherBet.id, "Other Bet Option", 0);

  const before = readBet(fixture.database, fixture.bet.id);

  const participantsBefore = readParticipants(fixture.database, fixture.bet.id);

  assert.throws(
    () =>
      persistTestResolution(fixture.database, fixture.bet.id, otherOptionID),
    /winning option does not belong to bet|FOREIGN KEY constraint failed/,
  );

  assert.deepEqual(readBet(fixture.database, fixture.bet.id), before);

  assert.deepEqual(
    readParticipants(fixture.database, fixture.bet.id),
    participantsBefore,
  );

  assert.deepEqual(readWinners(fixture.database, fixture.bet.id), []);

  assertForeignKeyIntegrity(fixture.database);
});

/**
 * C-TEST-08-TC06
 *
 * A resolved state without a winning option violates the database
 * lifecycle constraint.
 *
 * The failed operation must not modify the locked bet.
 */
test("C-TEST-08-TC06: resolution without an outcome is rejected", (context) => {
  const fixture = createResolutionFixture(context);

  const before = readBet(fixture.database, fixture.bet.id);

  assert.throws(
    () =>
      fixture.database
        .prepare(
          `
          UPDATE bets
          SET
            status = 'resolved',
            resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
            winning_option_id = NULL
          WHERE id = ?
          `,
        )
        .run(fixture.bet.id),
    /CHECK constraint failed/,
  );

  assert.deepEqual(readBet(fixture.database, fixture.bet.id), before);
});

/**
 * C-TEST-08-TC07
 *
 * A resolved bet must retain a non-null lock timestamp.
 * SQLite rejects a resolved record with a missing lock timestamp.
 */
test("C-TEST-08-TC07: resolved state without lock timestamp is rejected", (context) => {
  const fixture = createResolutionFixture(context);

  const before = readBet(fixture.database, fixture.bet.id);

  assert.throws(
    () =>
      fixture.database
        .prepare(
          `
          UPDATE bets
          SET
            status = 'resolved',
            locked_at = NULL,
            resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
            winning_option_id = ?
          WHERE id = ?
          `,
        )
        .run(fixture.winningOptionID, fixture.bet.id),
    /CHECK constraint failed/,
  );

  assert.deepEqual(readBet(fixture.database, fixture.bet.id), before);
});

/**
 * C-TEST-08-TC08
 *
 * A successfully resolved bet must preserve SQLite structural
 * integrity and all foreign-key relationships.
 */
test("C-TEST-08-TC08: resolved data preserves SQLite integrity", (context) => {
  const fixture = createResolutionFixture(context);

  assert.equal(
    persistTestResolution(
      fixture.database,
      fixture.bet.id,
      fixture.winningOptionID,
    ),
    1,
  );

  assertDatabaseIntegrity(fixture.database);
  assertForeignKeyIntegrity(fixture.database);

  const bet = readBet(fixture.database, fixture.bet.id);

  assert.equal(bet.status, "resolved");

  const option = fixture.database
    .prepare(
      `
      SELECT id, bet_id
      FROM bet_options
      WHERE id = ?
      `,
    )
    .get(bet.winning_option_id);

  assert.ok(option);
  assert.equal(option.id, fixture.winningOptionID);
  assert.equal(option.bet_id, fixture.bet.id);

  const participantCount = fixture.database
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM bet_participants
      WHERE bet_id = ?
      `,
    )
    .get(fixture.bet.id);

  assert.equal(participantCount.count, 3);

  const integrityResult = fixture.database.pragma("integrity_check", {
    simple: true,
  });

  const foreignKeyViolations = fixture.database.pragma("foreign_key_check");

  assert.equal(integrityResult, "ok");
  assert.deepEqual(foreignKeyViolations, []);
});
