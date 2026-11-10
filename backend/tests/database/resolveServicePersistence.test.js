import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { createBetParticipationRepository } from "../../src/repositories/createBetParticipationRepository.js";
import { createBetParticipationService } from "../../src/services/createBetParticipationService.js";

import {
  assertDatabaseIntegrity,
  assertForeignKeyIntegrity,
  createFileTestDatabaseHarness,
} from "../helpers/fileTestDatabase.js";

import { createLockedBet, createOpenBet } from "../fixtures/bets.js";

import {
  createCreatorUser,
  createParticipantUser,
  createNonParticipantUser,
} from "../fixtures/users.js";

/**
 * SCRUM-735 / C-TEST-08
 *
 * Verify application-level Resolve persistence using the real service,
 * repository, migrated SQLite schema, and isolated file-backed database.
 *
 * Unlike the schema-only tests, these tests never update resolution
 * columns directly. They invoke resolveById() through the application
 * service, then independently query SQLite to verify the outcome.
 */

/**
 * Read the complete stored resolution state.
 */
function readBet(database, betID) {
  return database
    .prepare(
      `
      SELECT
        id,
        creator_id,
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
 * Read memberships deterministically for before/after comparisons.
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
 * Read winners directly from SQLite, independently of the API result.
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
 * Add an option using the existing application schema.
 */
function insertOption(database, betID, label, position) {
  const optionID = randomUUID();

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

  return optionID;
}

/**
 * Add a participating user with a selected option.
 *
 * The creator is not inserted here because createOpenBet() and
 * createLockedBet() already register the creator as a participant.
 */
function insertParticipant(database, betID, userID, optionID) {
  database
    .prepare(
      `
      INSERT INTO bet_participants (
        bet_id,
        user_id,
        selected_option_id
      )
      VALUES (?, ?, ?)
      `,
    )
    .run(betID, userID, optionID);
}

/**
 * Create a service bound to an open SQLite connection.
 *
 * After reopening the database, create a fresh service to verify that
 * the application can read persisted state through a new connection.
 */
function createResolveService(database) {
  const participationRepository = createBetParticipationRepository(database);

  return createBetParticipationService({
    participationRepository,
  });
}

/**
 * Create one isolated, file-backed Resolve integration fixture.
 *
 * The test harness applies the application's real migrations.
 * Every test receives a separate temporary SQLite file.
 */
function createFixture(context, { locked = true } = {}) {
  const harness = createFileTestDatabaseHarness();
  let database;

  try {
    harness.initialize();
    database = harness.open();

    const creator = createCreatorUser(database);
    const winner = createParticipantUser(database);
    const loser = createParticipantUser(database);
    const outsider = createNonParticipantUser(database);

    const betOptions = {
      title: "SCRUM-735 Resolve Service Persistence",
      description: "Isolated integration test",
      max_participants: 5,
    };

    const bet = locked
      ? createLockedBet(database, creator, betOptions)
      : createOpenBet(database, creator, betOptions);

    const winningOptionID = insertOption(database, bet.id, "Winning answer", 0);

    const losingOptionID = insertOption(database, bet.id, "Losing answer", 1);

    insertParticipant(database, bet.id, winner.userID, winningOptionID);

    insertParticipant(database, bet.id, loser.userID, losingOptionID);

    const initialBet = readBet(database, bet.id);
    const initialParticipants = readParticipants(database, bet.id);

    assert.equal(initialParticipants.length, 3);

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
      outsider,
      winningOptionID,
      losingOptionID,
      initialBet,
      initialParticipants,

      get database() {
        return database;
      },

      get service() {
        return createResolveService(database);
      },

      /**
       * Close and reopen the same SQLite file.
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
 * Invoke the actual Resolve service with a valid outcome.
 */
function resolveFixture(fixture, overrides = {}) {
  return fixture.service.resolveById(
    overrides.betID ?? fixture.bet.id,
    {
      winning_option_id: overrides.winningOptionID ?? fixture.winningOptionID,
    },
    overrides.userID ?? fixture.creator.userID,
  );
}

/**
 * Verify that an application error contains the expected HTTP status
 * and stable backend error code.
 */
function assertApplicationError(operation, statusCode, code) {
  assert.throws(operation, (error) => {
    assert.equal(error.statusCode, statusCode);
    assert.equal(error.code, code);
    return true;
  });
}

/**
 * C-TEST-08-TC09
 *
 * The actual Resolve service persists a valid final outcome and
 * returns the expected winning participant.
 */
test("C-TEST-08-TC09: service resolves a locked bet and identifies winners", (context) => {
  const fixture = createFixture(context);

  const before = readBet(fixture.database, fixture.bet.id);
  const beforeParticipants = readParticipants(fixture.database, fixture.bet.id);

  const result = resolveFixture(fixture);

  assert.equal(result.bet.id, fixture.bet.id);
  assert.equal(result.bet.status, "resolved");
  assert.equal(result.bet.winning_option_id, fixture.winningOptionID);
  assert.ok(result.bet.resolved_at);

  assert.deepEqual(result.winners, [
    {
      user_id: fixture.winner.userID,
      selected_option_id: fixture.winningOptionID,
    },
  ]);

  const stored = readBet(fixture.database, fixture.bet.id);

  assert.equal(stored.status, "resolved");
  assert.equal(stored.winning_option_id, fixture.winningOptionID);
  assert.ok(stored.resolved_at);
  assert.equal(stored.locked_at, before.locked_at);
  assert.equal(stored.creator_id, fixture.creator.userID);

  assert.deepEqual(
    readParticipants(fixture.database, fixture.bet.id),
    beforeParticipants,
  );

  assert.deepEqual(
    readWinners(fixture.database, fixture.bet.id),
    result.winners,
  );
});

/**
 * C-TEST-08-TC10
 *
 * A second Resolve operation must not overwrite the first outcome.
 */
test("C-TEST-08-TC10: duplicate resolution is rejected without changing the result", (context) => {
  const fixture = createFixture(context);

  resolveFixture(fixture);

  const before = readBet(fixture.database, fixture.bet.id);
  const participantsBefore = readParticipants(fixture.database, fixture.bet.id);

  assertApplicationError(
    () =>
      resolveFixture(fixture, {
        winningOptionID: fixture.losingOptionID,
      }),
    409,
    "BET_ALREADY_RESOLVED",
  );

  assert.deepEqual(readBet(fixture.database, fixture.bet.id), before);

  assert.deepEqual(
    readParticipants(fixture.database, fixture.bet.id),
    participantsBefore,
  );

  assert.deepEqual(readWinners(fixture.database, fixture.bet.id), [
    {
      user_id: fixture.winner.userID,
      selected_option_id: fixture.winningOptionID,
    },
  ]);
});

/**
 * C-TEST-08-TC11
 *
 * An open bet must not be resolved through the application service.
 */
test("C-TEST-08-TC11: open bet resolution is rejected without writes", (context) => {
  const fixture = createFixture(context, { locked: false });

  assert.equal(fixture.initialBet.status, "open");

  assertApplicationError(() => resolveFixture(fixture), 409, "BET_NOT_LOCKED");

  assert.deepEqual(
    readBet(fixture.database, fixture.bet.id),
    fixture.initialBet,
  );

  assert.deepEqual(
    readParticipants(fixture.database, fixture.bet.id),
    fixture.initialParticipants,
  );
});

/**
 * C-TEST-08-TC12
 *
 * The winning option must belong to the bet being resolved.
 */
test("C-TEST-08-TC12: cross-bet winning option is rejected without writes", (context) => {
  const fixture = createFixture(context);

  const otherBet = createLockedBet(fixture.database, fixture.creator, {
    title: "Unrelated Resolution Bet",
    max_participants: 5,
  });

  const foreignOptionID = insertOption(
    fixture.database,
    otherBet.id,
    "Other bet answer",
    0,
  );

  assertApplicationError(
    () =>
      resolveFixture(fixture, {
        winningOptionID: foreignOptionID,
      }),
    400,
    "INVALID_OPTION",
  );

  assert.deepEqual(
    readBet(fixture.database, fixture.bet.id),
    fixture.initialBet,
  );

  assert.deepEqual(
    readParticipants(fixture.database, fixture.bet.id),
    fixture.initialParticipants,
  );

  assertForeignKeyIntegrity(fixture.database);
});

/**
 * C-TEST-08-TC13
 *
 * Only the original bet creator may resolve it.
 */
test("C-TEST-08-TC13: non-creator resolution is rejected without writes", (context) => {
  const fixture = createFixture(context);

  assertApplicationError(
    () =>
      resolveFixture(fixture, {
        userID: fixture.outsider.userID,
      }),
    403,
    "NOT_RESOLVE_CREATOR",
  );

  assert.deepEqual(
    readBet(fixture.database, fixture.bet.id),
    fixture.initialBet,
  );

  assert.deepEqual(
    readParticipants(fixture.database, fixture.bet.id),
    fixture.initialParticipants,
  );
});

/**
 * C-TEST-08-TC14
 *
 * A nonexistent bet must not change existing records.
 */
test("C-TEST-08-TC14: nonexistent bet resolution leaves database unchanged", (context) => {
  const fixture = createFixture(context);

  assertApplicationError(
    () =>
      resolveFixture(fixture, {
        betID: randomUUID(),
      }),
    404,
    "BET_NOT_FOUND",
  );

  assert.deepEqual(
    readBet(fixture.database, fixture.bet.id),
    fixture.initialBet,
  );

  assert.deepEqual(
    readParticipants(fixture.database, fixture.bet.id),
    fixture.initialParticipants,
  );
});

/**
 * C-TEST-08-TC15
 *
 * Missing or malformed winning option identifiers are rejected before
 * any persistent state can change.
 */
test("C-TEST-08-TC15: invalid resolution payloads leave no partial state", (context) => {
  const fixture = createFixture(context);

  const invalidInputs = [
    {},
    { winning_option_id: null },
    { winning_option_id: "" },
    { winning_option_id: 123 },
    { winning_option_id: " " },
    { winning_option_id: "x".repeat(101) },
  ];

  for (const input of invalidInputs) {
    assertApplicationError(
      () =>
        fixture.service.resolveById(
          fixture.bet.id,
          input,
          fixture.creator.userID,
        ),
      400,
      "VALIDATION_ERROR",
    );

    assert.deepEqual(
      readBet(fixture.database, fixture.bet.id),
      fixture.initialBet,
    );

    assert.deepEqual(
      readParticipants(fixture.database, fixture.bet.id),
      fixture.initialParticipants,
    );
  }
});

/**
 * C-TEST-08-TC16
 *
 * A successful service-level resolution must survive a complete
 * database close/reopen cycle.
 */
test("C-TEST-08-TC16: service resolution and winners survive database reopening", (context) => {
  const fixture = createFixture(context);

  const result = resolveFixture(fixture);

  const storedBefore = readBet(fixture.database, fixture.bet.id);
  const participantsBefore = readParticipants(fixture.database, fixture.bet.id);

  assert.equal(result.bet.status, "resolved");

  const reopenedDatabase = fixture.reopen();

  assert.deepEqual(readBet(reopenedDatabase, fixture.bet.id), storedBefore);

  assert.deepEqual(
    readParticipants(reopenedDatabase, fixture.bet.id),
    participantsBefore,
  );

  assert.deepEqual(
    readWinners(reopenedDatabase, fixture.bet.id),
    result.winners,
  );

  // A new service instance must also reject a duplicate resolution.
  assertApplicationError(
    () =>
      fixture.service.resolveById(
        fixture.bet.id,
        { winning_option_id: fixture.losingOptionID },
        fixture.creator.userID,
      ),
    409,
    "BET_ALREADY_RESOLVED",
  );

  assertDatabaseIntegrity(reopenedDatabase);
  assertForeignKeyIntegrity(reopenedDatabase);
});
