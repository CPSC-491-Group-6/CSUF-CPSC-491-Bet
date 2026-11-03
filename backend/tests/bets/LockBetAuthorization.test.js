import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../../src/createApp.js";
import { createBetService } from "../../src/services/createBetService.js";
import { createBetRepository } from "../../src/repositories/createBetRepository.js";

import {
  createCreatorState,
  createParticipantState,
  createNonParticipantState,
  createAuthorizationTestSessionMiddleware,
  getTestAuthHeaders,
} from "../helpers/authorizationTestUtils.js";

import { createBetTestDatabase } from "../helpers/betStateTestUtils.js";

const lockPath = (betId) => `/api/bets/${betId}/lock`;

function setup(t) {
  const database = createBetTestDatabase();
  t.after(() => database.close());

  const repository = createBetRepository(database);
  const betService = createBetService({ betRepository: repository });

  const app = createApp({
    betService,
    sessionMiddleware: createAuthorizationTestSessionMiddleware(database),
  });

  return { database, repository, app };
}

function readBet(repository, betId) {
  return repository.findById(betId);
}

function assertRejected(response) {
  assert.ok(
    response.status === 403 || response.status === 404,
    `Expected authorization rejection, received ${response.status}`,
  );
  assert.ok(
    response.body?.error?.code,
    "Expected a structured application authorization error.",
  );
}

test("SCRUM-762: creator can lock an open bet", async (t) => {
  const { database, repository, app } = setup(t);
  const creator = createCreatorState(database);

  assert.equal(creator.bet.status, "open");

  const response = await request(app)
    .post(lockPath(creator.bet.id))
    .set(getTestAuthHeaders(creator));

  assert.ok(
    response.status >= 200 && response.status < 300,
    `Expected successful lock, received ${response.status}`,
  );

  const storedBet = readBet(repository, creator.bet.id);

  assert.equal(storedBet.status, "locked");
  assert.ok(storedBet.locked_at);
  assert.equal(storedBet.creator_id, creator.user.userID);
});

test("SCRUM-762: participant cannot lock another user's bet", async (t) => {
  const { database, repository, app } = setup(t);
  const creator = createCreatorState(database);
  const participant = createParticipantState(database, creator.bet);

  assert.notEqual(participant.user.userID, creator.user.userID);

  const before = readBet(repository, creator.bet.id);

  const response = await request(app)
    .post(lockPath(creator.bet.id))
    .set(getTestAuthHeaders(participant));

  assertRejected(response);

  const after = readBet(repository, creator.bet.id);

  assert.deepEqual(after, before);
  assert.equal(after.status, "open");
  assert.equal(after.locked_at, null);
});

test("SCRUM-762: non-participant cannot lock another user's bet", async (t) => {
  const { database, repository, app } = setup(t);
  const creator = createCreatorState(database);
  const outsider = createNonParticipantState(database, creator.bet);

  assert.notEqual(outsider.user.userID, creator.user.userID);

  const before = readBet(repository, creator.bet.id);

  const response = await request(app)
    .post(lockPath(creator.bet.id))
    .set(getTestAuthHeaders(outsider));

  assertRejected(response);

  const after = readBet(repository, creator.bet.id);

  assert.deepEqual(after, before);
  assert.equal(after.status, "open");
  assert.equal(after.locked_at, null);
});

test("SCRUM-762: repeated locking does not corrupt bet state", async (t) => {
  const { database, repository, app } = setup(t);
  const creator = createCreatorState(database);

  const first = await request(app)
    .post(lockPath(creator.bet.id))
    .set(getTestAuthHeaders(creator));

  assert.ok(first.status >= 200 && first.status < 300);

  const lockedBet = readBet(repository, creator.bet.id);

  assert.equal(lockedBet.status, "locked");
  assert.ok(lockedBet.locked_at);

  const second = await request(app)
    .post(lockPath(creator.bet.id))
    .set(getTestAuthHeaders(creator));

  // Accept idempotent success or an explicit conflict.
  assert.ok(
    (second.status >= 200 && second.status < 300) || second.status === 409,
  );

  const after = readBet(repository, creator.bet.id);

  assert.deepEqual(after, lockedBet);
});

test("SCRUM-762: unauthenticated lock attempt is rejected", async (t) => {
  const { database, repository, app } = setup(t);
  const creator = createCreatorState(database);
  const before = readBet(repository, creator.bet.id);

  const response = await request(app).post(lockPath(creator.bet.id));

  assert.equal(response.status, 401);

  const after = readBet(repository, creator.bet.id);

  assert.deepEqual(after, before);
});
