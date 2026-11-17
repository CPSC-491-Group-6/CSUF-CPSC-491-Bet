import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import request from "supertest";

import { createApp } from "../../src/createApp.js";
import { createBetRepository } from "../../src/repositories/createBetRepository.js";
import { createBetParticipationRepository } from "../../src/repositories/createBetParticipationRepository.js";
import { createBetService } from "../../src/services/createBetService.js";
import { createBetParticipationService } from "../../src/services/createBetParticipationService.js";

import { createBetTestDatabase } from "../helpers/betStateTestUtils.js";

import {
  createCreatorState,
  createParticipantState,
  createNonParticipantState,
  createAuthorizationTestSessionMiddleware,
  getTestAuthHeaders,
} from "../helpers/authorizationTestUtils.js";

/**
 * SCRUM-735 / C-TEST-08
 *
 * HTTP integration tests for Resolve Bet.
 *
 * Uses real Express routes, the Resolve service and repository,
 * and an isolated migrated SQLite database.
 *
 * Rejected operations are checked against database snapshots
 * to confirm no persistent state changes occurred.
 */

const resolvePath = (betID) => `/api/bets/${betID}/resolve`;

/**
 * Create an isolated application using the real bet services.
 */
function setup(context) {
  const database = createBetTestDatabase();

  context.after(() => database.close());

  const betRepository = createBetRepository(database);
  const participationRepository = createBetParticipationRepository(database);

  const betService = {
    ...createBetService({ betRepository }),
    ...createBetParticipationService({
      participationRepository,
    }),
  };

  const app = createApp({
    betService,
    sessionMiddleware: createAuthorizationTestSessionMiddleware(database),
  });

  return { database, app };
}

/**
 * Insert a valid answer option belonging to the specified bet.
 */
function addOption(database, betID, label, position) {
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
 * Capture the complete relevant state of a bet.
 *
 * Snapshot comparisons verify that rejected HTTP requests
 * leave the original bet and participants unchanged.
 */
function snapshot(database, betID) {
  return {
    bet: database.prepare("SELECT * FROM bets WHERE id = ?").get(betID),

    participants: database
      .prepare(
        `
        SELECT *
        FROM bet_participants
        WHERE bet_id = ?
        ORDER BY user_id
        `,
      )
      .all(betID),

    options: database
      .prepare(
        `
        SELECT *
        FROM bet_options
        WHERE bet_id = ?
        ORDER BY position
        `,
      )
      .all(betID),
  };
}

/**
 * Create a multiple-choice Resolve fixture with two answer options
 * and one participating winner.
 *
 * The shared creator fixture automatically registers the creator.
 * The participant fixture registers one additional user.
 *
 * SCRUM-826 compatibility:
 * The shared creator fixture creates an option-less free-response
 * bet. This test adds multiple-choice options and explicitly sets
 * answer_type before attempting Resolve.
 */
function createFixture(context, { locked = true } = {}) {
  const { database, app } = setup(context);

  const creator = createCreatorState(
    database,
    locked ? { status: "locked" } : {},
  );

  const participant = createParticipantState(database, creator.bet);
  const outsider = createNonParticipantState(database, creator.bet);

  const winningOptionID = addOption(
    database,
    creator.bet.id,
    "Winning answer",
    0,
  );

  const losingOptionID = addOption(
    database,
    creator.bet.id,
    "Losing answer",
    1,
  );

  /**
   * Classify this fixture as multiple-choice.
   *
   * This is intentionally limited to the test fixture.
   * Production free-response validation remains unchanged.
   */
  const updated = database
    .prepare(
      `
      UPDATE bets
      SET answer_type = 'multiple_choice'
      WHERE id = ?
        AND status IN ('open', 'locked')
      `,
    )
    .run(creator.bet.id);

  assert.equal(updated.changes, 1);

  const storedType = database
    .prepare(
      `
      SELECT answer_type
      FROM bets
      WHERE id = ?
      `,
    )
    .get(creator.bet.id);

  assert.equal(storedType.answer_type, "multiple_choice");

  /**
   * Assign the selected winning option to the test participant.
   * The actual Resolve operation still runs through HTTP.
   */
  database
    .prepare(
      `
      UPDATE bet_participants
      SET selected_option_id = ?
      WHERE bet_id = ?
        AND user_id = ?
      `,
    )
    .run(winningOptionID, creator.bet.id, participant.user.userID);

  const initial = snapshot(database, creator.bet.id);

  assert.equal(initial.bet.status, locked ? "locked" : "open");
  assert.equal(initial.participants.length, 2);

  return {
    database,
    app,
    creator,
    participant,
    outsider,
    winningOptionID,
    losingOptionID,
    initial,
  };
}

/**
 * Make an authenticated HTTP Resolve request.
 */
function resolveAs(fixture, user, winningOptionID, betID) {
  return request(fixture.app)
    .post(resolvePath(betID ?? fixture.creator.bet.id))
    .set(getTestAuthHeaders(user))
    .send({
      winning_option_id: winningOptionID,
    });
}

/**
 * Verify an application error returned by the HTTP endpoint.
 */
function assertError(response, status, code) {
  assert.equal(response.status, status);
  assert.equal(response.body?.error?.code, code);
}

/**
 * C-TEST-08-TC17
 *
 * A creator can resolve a locked bet through HTTP.
 */
test("C-TEST-08-TC17: creator resolves locked bet through HTTP", async (context) => {
  const fixture = createFixture(context);

  const response = await resolveAs(
    fixture,
    fixture.creator,
    fixture.winningOptionID,
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.bet.id, fixture.creator.bet.id);
  assert.equal(response.body.bet.status, "resolved");
  assert.equal(response.body.bet.winning_option_id, fixture.winningOptionID);
  assert.ok(response.body.bet.resolved_at);

  assert.deepEqual(response.body.winners, [
    {
      user_id: fixture.participant.user.userID,
      selected_option_id: fixture.winningOptionID,
    },
  ]);

  const stored = snapshot(fixture.database, fixture.creator.bet.id);

  assert.equal(stored.bet.status, "resolved");
  assert.equal(stored.bet.winning_option_id, fixture.winningOptionID);
  assert.ok(stored.bet.resolved_at);
  assert.equal(stored.bet.creator_id, fixture.initial.bet.creator_id);

  assert.deepEqual(stored.participants, fixture.initial.participants);
});

/**
 * C-TEST-08-TC18
 *
 * Unauthenticated Resolve attempts are rejected.
 */
test("C-TEST-08-TC18: unauthenticated Resolve is rejected", async (context) => {
  const fixture = createFixture(context);

  const response = await request(fixture.app)
    .post(resolvePath(fixture.creator.bet.id))
    .send({
      winning_option_id: fixture.winningOptionID,
    });

  assert.equal(response.status, 401);

  assert.deepEqual(
    snapshot(fixture.database, fixture.creator.bet.id),
    fixture.initial,
  );
});

/**
 * C-TEST-08-TC19
 *
 * A non-creator cannot resolve another user's bet.
 */
test("C-TEST-08-TC19: non-creator cannot resolve a locked bet", async (context) => {
  const fixture = createFixture(context);

  const response = await resolveAs(
    fixture,
    fixture.outsider,
    fixture.winningOptionID,
  );

  assertError(response, 403, "NOT_RESOLVE_CREATOR");

  assert.deepEqual(
    snapshot(fixture.database, fixture.creator.bet.id),
    fixture.initial,
  );
});

/**
 * C-TEST-08-TC20
 *
 * Open bets cannot transition directly to resolved.
 */
test("C-TEST-08-TC20: open bet cannot be resolved", async (context) => {
  const fixture = createFixture(context, { locked: false });

  const response = await resolveAs(
    fixture,
    fixture.creator,
    fixture.winningOptionID,
  );

  assertError(response, 409, "BET_NOT_LOCKED");

  assert.deepEqual(
    snapshot(fixture.database, fixture.creator.bet.id),
    fixture.initial,
  );
});

/**
 * C-TEST-08-TC21
 *
 * A resolved outcome cannot be overwritten.
 */
test("C-TEST-08-TC21: repeated Resolve cannot overwrite outcome", async (context) => {
  const fixture = createFixture(context);

  const first = await resolveAs(
    fixture,
    fixture.creator,
    fixture.winningOptionID,
  );

  assert.equal(first.status, 200);

  const afterFirst = snapshot(fixture.database, fixture.creator.bet.id);

  const second = await resolveAs(
    fixture,
    fixture.creator,
    fixture.losingOptionID,
  );

  assertError(second, 409, "BET_ALREADY_RESOLVED");

  assert.deepEqual(
    snapshot(fixture.database, fixture.creator.bet.id),
    afterFirst,
  );

  assert.equal(afterFirst.bet.winning_option_id, fixture.winningOptionID);
});

/**
 * C-TEST-08-TC22
 *
 * A winning option must belong to the bet being resolved.
 */
test("C-TEST-08-TC22: foreign winning option is rejected", async (context) => {
  const fixture = createFixture(context);

  const otherCreator = createCreatorState(fixture.database);

  const foreignOptionID = addOption(
    fixture.database,
    otherCreator.bet.id,
    "Other bet answer",
    0,
  );

  const before = snapshot(fixture.database, fixture.creator.bet.id);

  const response = await resolveAs(fixture, fixture.creator, foreignOptionID);

  assertError(response, 400, "INVALID_OPTION");

  assert.deepEqual(snapshot(fixture.database, fixture.creator.bet.id), before);
});

/**
 * C-TEST-08-TC23
 *
 * A nonexistent bet cannot be resolved.
 */
test("C-TEST-08-TC23: unknown bet cannot be resolved", async (context) => {
  const fixture = createFixture(context);

  const missingBetID = randomUUID();

  const response = await resolveAs(
    fixture,
    fixture.creator,
    fixture.winningOptionID,
    missingBetID,
  );

  assertError(response, 404, "BET_NOT_FOUND");

  assert.deepEqual(
    snapshot(fixture.database, fixture.creator.bet.id),
    fixture.initial,
  );
});

/**
 * C-TEST-08-TC24
 *
 * Missing resolution payloads are rejected before any
 * persistent changes are made.
 */
test("C-TEST-08-TC24: missing winning option is rejected", async (context) => {
  const fixture = createFixture(context);

  const response = await request(fixture.app)
    .post(resolvePath(fixture.creator.bet.id))
    .set(getTestAuthHeaders(fixture.creator))
    .send({});

  assertError(response, 400, "VALIDATION_ERROR");

  assert.deepEqual(
    snapshot(fixture.database, fixture.creator.bet.id),
    fixture.initial,
  );
});
