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
 * Each test uses a real migrated, isolated file-backed database.
 * These tests validate multiple-choice resolution independently
 * of the application's HTTP and service layers.
 */

/**
 * Read stored resolution data.
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
 * Read participant records in deterministic order.
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
 * Derive multiple-choice winners from the persisted outcome.
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
 * Perform the database-level Resolve operation.
 *
 * This deliberately bypasses the service layer to test SQLite
 * constraints and persistence independently.
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
 * Add an answer option using the production database schema.
 */
function insertOption(database, betID, optionID, label, position) {
  database
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
    .run(optionID, betID, label, position);
}

/**
 * Create one isolated multiple-choice Resolve fixture.
 *
 * The shared bet factory remains unchanged because other tests
 * rely on its option-less free-response behavior.
 *
 * The fixture explicitly sets answer_type after inserting its
 * multiple-choice options and before resolution.
 */
function createResolutionFixture(context) {
  const harness = createFileTestDatabaseHarness();
  let database;

  try {
    harness.initialize();
    database = harness.open();

    const creator = createCreatorUser(database);
    const winner = createParticipantUser(database);
    const loser = createParticipantUser(database);

    const bet = createLockedBet(database, creator, {
      title: "C-TEST-08 Resolve Persistence",
      description: "Isolated resolution persistence fixture",
      max_participants: 5,
    });

    const winningOptionID = randomUUID();
    const losingOptionID = randomUUID();

    insertOption(database, bet.id, winningOptionID, "Option A", 0);

    insertOption(database, bet.id, losingOptionID, "Option B", 1);

    /**
     * SCRUM-826 compatibility:
     *
     * The shared bet factory creates an option-less free-response
     * bet by default. These existing tests exercise the original
     * multiple-choice outcome contract, so explicitly classify
     * this fixture before performing Resolve.
     */
    const updated = database
      .prepare(
        `
        UPDATE bets
        SET answer_type = 'multiple_choice'
        WHERE id = ?
          AND status = 'locked'
      `,
      )
      .run(bet.id);

    assert.equal(updated.changes, 1);

    const storedType = database
      .prepare("SELECT answer_type FROM bets WHERE id = ?")
      .get(bet.id);

    assert.equal(storedType.answer_type, "multiple_choice");

    const insertParticipant = database.prepare(`
      INSERT INTO bet_participants (
        bet_id,
        user_id,
        selected_option_id
      )
      VALUES (?, ?, ?)
    `);

    // The creator is already registered by createLockedBet().
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

    insertParticipant.run(bet.id, winner.userID, winningOptionID);
    insertParticipant.run(bet.id, loser.userID, losingOptionID);

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

      get database() {
        return database;
      },

      /**
       * Reopen the same persisted SQLite file.
       */
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
 * C-TEST-08-TC01: Valid Resolve persists the final state.
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
 * C-TEST-08-TC02: Winner matching uses the stored winning option.
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
 * C-TEST-08-TC03: Resolution preserves bet and membership data.
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

  assert.deepEqual(afterParticipants, beforeParticipants);

  assert.deepEqual(
    afterParticipants.map((row) => row.user_id),
    [fixture.creator.userID, fixture.winner.userID, fixture.loser.userID],
  );
});

/**
 * C-TEST-08-TC04: Results survive closing and reopening SQLite.
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
 * C-TEST-08-TC05: A different bet's winning option is rejected.
 */
test("C-TEST-08-TC05: another bet's winning option is rejected", (context) => {
  const fixture = createResolutionFixture(context);

  const otherBet = createLockedBet(fixture.database, fixture.creator, {
    title: "Unrelated Resolve Test Bet",
  });

  const otherOptionID = randomUUID();

  insertOption(
    fixture.database,
    otherBet.id,
    otherOptionID,
    "Other Bet Option",
    0,
  );

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
 * C-TEST-08-TC06: Missing winning option violates lifecycle constraints.
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
 * C-TEST-08-TC07: Resolved bets require a lock timestamp.
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
 * C-TEST-08-TC08: Valid resolution preserves SQLite integrity.
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
