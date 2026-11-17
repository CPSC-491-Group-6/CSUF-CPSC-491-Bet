import assert from "node:assert/strict";
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
 * SCRUM-762: Bet state regression tests.
 *
 * Verify creator-only Lock behavior, participant preservation,
 * state transitions, and rejected operations using the real
 * Express routes and migrated SQLite database.
 */

const joinPath = "/api/bets/join";
const lockPath = (betID) => `/api/bets/${betID}/lock`;

/**
 * Construct an isolated application for each regression test.
 */
function setup(context) {
  const database = createBetTestDatabase();

  context.after(() => database.close());

  const repository = createBetRepository(database);
  const participationRepository = createBetParticipationRepository(database);

  const betService = {
    ...createBetService({
      betRepository: repository,
    }),
    ...createBetParticipationService({
      participationRepository,
    }),
  };

  const app = createApp({
    betService,
    sessionMiddleware: createAuthorizationTestSessionMiddleware(database),
  });

  return { database, repository, app };
}

/**
 * Read persisted state directly so API responses cannot
 * conceal unexpected database mutations.
 */
function snapshot(database, betId) {
  return {
    bet: database.prepare("SELECT * FROM bets WHERE id = ?").get(betId),

    participants: database
      .prepare(
        "SELECT user_id FROM bet_participants WHERE bet_id = ? ORDER BY user_id",
      )
      .all(betId),
  };
}

/**
 * Send an authenticated Lock request.
 */
function lockBet(app, state, betId) {
  return request(app).post(lockPath(betId)).set(getTestAuthHeaders(state));
}

/**
 * Submit a Join request using the current free-response contract.
 *
 * Existing authorization fixtures create option-less bets, which
 * SCRUM-826 classifies as free_response. These bets require
 * prediction_text from every newly joining participant.
 */
function joinBet(app, state, inviteCode) {
  return request(app).post(joinPath).set(getTestAuthHeaders(state)).send({
    join_code: inviteCode,
    prediction_text: "The predicted outcome for this test bet.",
  });
}

/**
 * Verify a successful HTTP response.
 */
function assertSuccess(response) {
  assert.ok(
    response.status >= 200 && response.status < 300,
    `Expected success, received ${response.status}`,
  );
}

/**
 * Verify structured application rejection instead of treating
 * an unrelated Express error as valid security behavior.
 */
function assertApplicationRejection(response, allowedStatuses) {
  assert.ok(
    allowedStatuses.includes(response.status),
    `Expected ${allowedStatuses.join(" or ")}, received ${response.status}`,
  );

  assert.equal(
    typeof response.body?.error?.code,
    "string",
    "Expected a structured application error.",
  );
}

/**
 * Lock preserves creator ownership and existing participants.
 */
test("SCRUM-762: successful lock persists and retains existing participants", async (t) => {
  const { database, repository, app } = setup(t);

  const creator = createCreatorState(database);
  const participant = createParticipantState(database, creator.bet);

  const before = snapshot(database, creator.bet.id);

  assert.equal(before.bet.status, "open");
  assert.equal(before.bet.locked_at, null);
  assert.equal(before.participants.length, 2);

  const response = await lockBet(app, creator, creator.bet.id);
  assertSuccess(response);

  const refreshedRepository = createBetRepository(database);
  const storedBet = refreshedRepository.findById(creator.bet.id);
  const after = snapshot(database, creator.bet.id);

  assert.equal(storedBet.status, "locked");
  assert.ok(storedBet.locked_at);
  assert.equal(storedBet.creator_id, creator.user.userID);
  assert.deepEqual(after.participants, before.participants);
  assert.equal(storedBet.current_participants, 2);

  assert.ok(
    after.participants.some(
      ({ user_id }) => user_id === participant.user.userID,
    ),
  );

  const lookup = await request(app)
    .get(`/api/bets/code/${creator.bet.join_code}`)
    .set(getTestAuthHeaders(creator));

  assert.equal(lookup.status, 200);
  assert.equal(lookup.body.bet.status, "locked");
  assert.equal(lookup.body.bet.locked_at, storedBet.locked_at);

  assert.equal(repository.findById(creator.bet.id).status, "locked");
});

/**
 * Locked bets reject additional participants without modifying
 * the existing state or membership records.
 */
test("SCRUM-762: locked bet rejects a new participant without changing state", async (t) => {
  const { database, app } = setup(t);

  const creator = createCreatorState(database, { status: "locked" });
  const outsider = createNonParticipantState(database, creator.bet);

  const before = snapshot(database, creator.bet.id);

  assert.equal(before.bet.status, "locked");
  assert.ok(before.bet.locked_at);

  const response = await joinBet(app, outsider, creator.bet.join_code);

  assertApplicationRejection(response, [403, 409, 422]);

  const after = snapshot(database, creator.bet.id);

  assert.deepEqual(after, before);
  assert.equal(after.bet.status, "locked");
  assert.equal(after.participants.length, 1);

  assert.ok(
    !after.participants.some(({ user_id }) => user_id === outsider.user.userID),
  );
});

/**
 * Joining is allowed before Lock, but rejected after Lock.
 */
test("SCRUM-762: Join succeeds before Lock and is rejected afterward", async (t) => {
  const { database, app } = setup(t);

  const creator = createCreatorState(database);
  const earlyUser = createNonParticipantState(database, creator.bet);

  const firstJoin = await joinBet(app, earlyUser, creator.bet.join_code);

  assertSuccess(firstJoin);

  const afterFirstJoin = snapshot(database, creator.bet.id);

  assert.equal(afterFirstJoin.bet.status, "open");
  assert.equal(afterFirstJoin.participants.length, 2);

  assert.ok(
    afterFirstJoin.participants.some(
      ({ user_id }) => user_id === earlyUser.user.userID,
    ),
  );

  const lockResponse = await lockBet(app, creator, creator.bet.id);

  assertSuccess(lockResponse);

  const afterLock = snapshot(database, creator.bet.id);

  assert.equal(afterLock.bet.status, "locked");
  assert.ok(afterLock.bet.locked_at);

  const lateUser = createNonParticipantState(database, creator.bet);
  const beforeRejectedJoin = snapshot(database, creator.bet.id);

  const secondJoin = await joinBet(app, lateUser, creator.bet.join_code);

  assertApplicationRejection(secondJoin, [403, 409, 422]);

  const afterRejectedJoin = snapshot(database, creator.bet.id);

  assert.deepEqual(afterRejectedJoin, beforeRejectedJoin);
  assert.equal(afterRejectedJoin.bet.status, "locked");
  assert.equal(afterRejectedJoin.participants.length, 2);
});

/**
 * Unauthorized Lock requests cannot interfere with a
 * subsequent valid Lock from the original creator.
 */
test("SCRUM-762: rejected Lock attempts do not interfere with a later creator lock", async (t) => {
  const { database, app } = setup(t);

  const creator = createCreatorState(database);
  const participant = createParticipantState(database, creator.bet);
  const outsider = createNonParticipantState(database, creator.bet);

  const original = snapshot(database, creator.bet.id);

  assert.equal(original.bet.status, "open");

  const participantResponse = await lockBet(app, participant, creator.bet.id);

  assertApplicationRejection(participantResponse, [403, 404]);
  assert.deepEqual(snapshot(database, creator.bet.id), original);

  const outsiderResponse = await lockBet(app, outsider, creator.bet.id);

  assertApplicationRejection(outsiderResponse, [403, 404]);
  assert.deepEqual(snapshot(database, creator.bet.id), original);

  const creatorResponse = await lockBet(app, creator, creator.bet.id);

  assertSuccess(creatorResponse);

  const afterCreatorLock = snapshot(database, creator.bet.id);

  assert.equal(afterCreatorLock.bet.status, "locked");
  assert.ok(afterCreatorLock.bet.locked_at);
  assert.deepEqual(afterCreatorLock.participants, original.participants);
});

/**
 * A missing bet cannot change another bet's lifecycle state.
 */
test("SCRUM-762: failed Lock on a nonexistent bet does not mutate another bet", async (t) => {
  const { database, app } = setup(t);

  const creator = createCreatorState(database);

  const before = snapshot(database, creator.bet.id);
  const missingBetId = "00000000-0000-4000-8000-000000000000";

  assert.notEqual(missingBetId, creator.bet.id);

  const response = await lockBet(app, creator, missingBetId);

  assertApplicationRejection(response, [404]);

  const after = snapshot(database, creator.bet.id);

  assert.deepEqual(after, before);
  assert.equal(after.bet.status, "open");
  assert.equal(after.bet.locked_at, null);
});

/**
 * Reading an independently locked bet cannot mutate its state.
 */
test("SCRUM-762: independently initialized locked state remains stable on retrieval", async (t) => {
  const { database, repository, app } = setup(t);

  const creator = createCreatorState(database, { status: "locked" });
  const before = snapshot(database, creator.bet.id);

  const response = await request(app)
    .get(`/api/bets/code/${creator.bet.join_code}`)
    .set(getTestAuthHeaders(creator));

  assert.equal(response.status, 200);
  assert.equal(response.body.bet.status, "locked");
  assert.ok(response.body.bet.locked_at);

  const after = snapshot(database, creator.bet.id);

  assert.deepEqual(after, before);
  assert.equal(repository.findById(creator.bet.id).status, "locked");
});
