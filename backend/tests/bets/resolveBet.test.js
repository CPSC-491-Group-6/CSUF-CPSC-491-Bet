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
 * Uses the existing authenticated Express test setup, the actual
 * Resolve service and repository, and an isolated migrated SQLite
 * database. Database snapshots verify that rejected HTTP requests
 * leave persistent state unchanged.
 */

const resolvePath = (betID) => `/api/bets/${betID}/resolve`;

/**
 * Create an isolated Express application with the real bet services.
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
 * Insert a valid answer option belonging to a specific bet.
 */
function addOption(database, betID, label, position) {
  const optionID = randomUUID();

  database
    .prepare(
      `
      INSERT INTO bet_options (
        id, bet_id, label, position
      )
      VALUES (?, ?, ?, ?)
      `,
    )
    .run(optionID, betID, label, position);

  return optionID;
}

/**
 * Capture all relevant stored records.
 *
 * Comparing these snapshots before and after a rejected request
 * verifies that no partial resolution or membership changes occurred.
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
 * Create a bet with two answer options and a participating winner.
 *
 * The existing creator fixture registers the creator automatically.
 * The participant fixture creates only the additional user.
 *
 * The participant's answer is updated directly to establish
 * deterministic test data; the HTTP Resolve operation is never
 * simulated through direct SQL.
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
 * Make an authenticated Resolve HTTP request.
 */
function resolveAs(fixture, user, winningOptionID, betID) {
  return request(fixture.app)
    .post(resolvePath(betID ?? fixture.creator.bet.id))
    .set(getTestAuthHeaders(user))
    .send({ winning_option_id: winningOptionID });
}

/**
 * Verify the application's structured HTTP error response.
 *
 * A plain Express 404 without an application error code is not
 * sufficient evidence of the intended failure behavior.
 */
function assertError(response, status, code) {
  assert.equal(response.status, status);
  assert.equal(response.body?.error?.code, code);
}

/**
 * TC17: Creator can resolve a locked bet through HTTP.
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
 * TC18: The existing authentication middleware rejects requests
 * without a valid user session.
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
 * TC19: A non-creator cannot resolve another user's bet.
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
 * TC20: An open bet must not transition directly to resolved.
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
 * TC21: Once resolved, the final winning outcome cannot be replaced.
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
 * TC22: An option belonging to another bet is rejected.
 */
test("C-TEST-08-TC22: foreign winning option is rejected", async (context) => {
  const fixture = createFixture(context);

  // Establish a distinct bet with an option that must not be accepted.
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
 * TC23: Resolving a nonexistent bet returns a structured 404.
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
 * TC24: A missing winning option is rejected before any database
 * state is changed.
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
