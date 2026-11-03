import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../../src/createApp.js";
import { createBetRepository } from "../../src/repositories/createBetRepository.js";
import { createBetParticipationRepository } from "../../src/repositories/createBetParticipationRepository.js";
import { createBetService } from "../../src/services/createBetService.js";
import { createBetParticipationService } from "../../src/services/createBetParticipationService.js";

import { createBetTestDatabase } from "../helpers/betStateTestUtils.js";
import {
  createAuthorizationTestSessionMiddleware,
  createParticipantState,
} from "../helpers/authorizationTestUtils.js";

import {
  createCreatorUser,
  createNonParticipantUser,
} from "../fixtures/users.js";

import { createOpenBet, createLockedBet } from "../fixtures/bets.js";
import {
  createValidInviteCode,
  createInvalidInviteCode,
} from "../fixtures/inviteCodes.js";

// SCRUM-760: Join Bet integration and participant-state tests.
// These tests exercise real backend services and an isolated SQLite database.

async function withDatabase(callback) {
  const database = createBetTestDatabase();

  try {
    return await callback(database);
  } finally {
    database.close();
  }
}

function participants(database, betId) {
  return database
    .prepare(
      `SELECT user_id
       FROM bet_participants
       WHERE bet_id = ?
       ORDER BY user_id`,
    )
    .all(betId);
}

function testApp(database) {
  const betRepository = createBetRepository(database);
  const participationRepository = createBetParticipationRepository(database);

  const betService = {
    ...createBetService({ betRepository }),
    ...createBetParticipationService({ participationRepository }),
  };

  return createApp({
    authService: {},
    betService,
    sessionMiddleware: createAuthorizationTestSessionMiddleware(database),
  });
}

async function join(database, userID, inviteCode) {
  const body = inviteCode === undefined ? {} : { join_code: inviteCode };

  const operation = request(testApp(database))
    .post("/api/bets/join")
    .send(body);

  if (userID !== null && userID !== undefined) {
    operation.set("x-test-user", String(userID));
  }

  return operation;
}

function assertApiError(response, status, code) {
  assert.equal(
    response.status,
    status,
    `Expected HTTP ${status}, received ${response.status}`,
  );

  assert.match(response.headers["content-type"] ?? "", /application\/json/);

  assert.equal(typeof response.body.error?.code, "string");
  assert.ok(response.body.error.code.length > 0);

  if (code) {
    assert.equal(response.body.error.code, code);
  }
}

function assertJoinSuccess(response, bet, userID, participantCount) {
  assert.equal(response.status, 201);

  const joined = response.body.participation;

  assert.ok(joined, "Successful Join must return participation data.");
  assert.equal(joined.bet_id, bet.id);
  assert.equal(joined.user_id, userID);
  assert.equal(joined.current_participants, participantCount);
}

// --------------------------------------------------
// INVITE-CODE LOOKUP
// --------------------------------------------------

test("SCRUM-760: valid invite code identifies the correct bet", () => {
  const database = createBetTestDatabase();

  try {
    const creator = createCreatorUser(database);
    const bet = createOpenBet(database, creator);
    const code = createValidInviteCode(database, bet);
    const repository = createBetRepository(database);

    assert.equal(repository.findByJoinCode(code).id, bet.id);
    assert.equal(repository.findByJoinCode(code.toLowerCase()).id, bet.id);
    assert.equal(participants(database, bet.id).length, 1);
  } finally {
    database.close();
  }
});

test("SCRUM-760: unknown invite-code lookup leaves membership unchanged", () => {
  const database = createBetTestDatabase();

  try {
    const creator = createCreatorUser(database);
    const bet = createOpenBet(database, creator);
    const unknownCode = createInvalidInviteCode(database);

    const before = participants(database, bet.id);

    assert.equal(
      createBetRepository(database).findByJoinCode(unknownCode),
      undefined,
    );

    assert.deepEqual(participants(database, bet.id), before);
  } finally {
    database.close();
  }
});

// --------------------------------------------------
// JOIN BET API INTEGRATION
// --------------------------------------------------

test("SCRUM-760: eligible user joins an open bet successfully", async () => {
  await withDatabase(async (database) => {
    const creator = createCreatorUser(database);
    const user = createNonParticipantUser(database);
    const bet = createOpenBet(database, creator);
    const code = createValidInviteCode(database, bet);

    const before = participants(database, bet.id);

    assert.equal(before.length, 1);

    const response = await join(database, user.userID, code);

    assertJoinSuccess(response, bet, user.userID, 2);

    const after = participants(database, bet.id);

    assert.equal(after.length, 2);
    assert.ok(after.some((entry) => entry.user_id === user.userID));

    const storedBet = createBetRepository(database).findById(bet.id);

    assert.equal(storedBet.current_participants, 2);
    assert.equal(storedBet.status, "open");
  });
});

test("SCRUM-760: duplicate joining is rejected without state change", async () => {
  await withDatabase(async (database) => {
    const creator = createCreatorUser(database);
    const bet = createOpenBet(database, creator);
    const { user } = createParticipantState(database, bet);
    const code = createValidInviteCode(database, bet);

    const before = participants(database, bet.id);

    assert.equal(before.length, 2);

    const response = await join(database, user.userID, code);

    assertApiError(response, 409, "ALREADY_JOINED");

    const after = participants(database, bet.id);

    assert.deepEqual(after, before);
    assert.equal(
      after.filter((entry) => entry.user_id === user.userID).length,
      1,
    );

    assert.equal(
      createBetRepository(database).findById(bet.id).current_participants,
      2,
    );
  });
});

test("SCRUM-760: locked bet rejects a new participant", async () => {
  await withDatabase(async (database) => {
    const creator = createCreatorUser(database);
    const user = createNonParticipantUser(database);
    const bet = createLockedBet(database, creator);
    const code = createValidInviteCode(database, bet);

    const before = participants(database, bet.id);

    assert.equal(bet.status, "locked");

    const response = await join(database, user.userID, code);

    assertApiError(response, 409, "BET_NOT_OPEN");

    const after = participants(database, bet.id);

    assert.deepEqual(after, before);
    assert.ok(!after.some((entry) => entry.user_id === user.userID));

    const storedBet = createBetRepository(database).findById(bet.id);

    assert.equal(storedBet.status, "locked");
  });
});

test("SCRUM-760: unknown invite code is rejected without modifying participants", async () => {
  await withDatabase(async (database) => {
    const creator = createCreatorUser(database);
    const user = createNonParticipantUser(database);
    const bet = createOpenBet(database, creator);

    const before = participants(database, bet.id);
    const code = createInvalidInviteCode(database);

    const response = await join(database, user.userID, code);

    assertApiError(response, 404, "BET_NOT_FOUND");
    assert.deepEqual(participants(database, bet.id), before);
  });
});

test("SCRUM-760: malformed invite code is rejected", async () => {
  await withDatabase(async (database) => {
    const creator = createCreatorUser(database);
    const user = createNonParticipantUser(database);
    const bet = createOpenBet(database, creator);

    const before = participants(database, bet.id);

    const response = await join(database, user.userID, "INVALID!");

    assertApiError(response, 400, "VALIDATION_ERROR");
    assert.deepEqual(participants(database, bet.id), before);
  });
});

test("SCRUM-760: empty invite code is rejected", async () => {
  await withDatabase(async (database) => {
    const creator = createCreatorUser(database);
    const user = createNonParticipantUser(database);
    const bet = createOpenBet(database, creator);

    const before = participants(database, bet.id);

    const response = await join(database, user.userID, "");

    assertApiError(response, 400, "VALIDATION_ERROR");
    assert.deepEqual(participants(database, bet.id), before);
  });
});

// --------------------------------------------------
// AUTHENTICATION AND REPEATED REQUESTS
// --------------------------------------------------

test("SCRUM-760: unauthenticated joining is rejected", async () => {
  await withDatabase(async (database) => {
    const creator = createCreatorUser(database);
    const user = createNonParticipantUser(database);
    const bet = createOpenBet(database, creator);
    const code = createValidInviteCode(database, bet);

    // Confirm the endpoint works for an eligible authenticated user.
    const authorized = await join(database, user.userID, code);

    assertJoinSuccess(authorized, bet, user.userID, 2);

    const before = participants(database, bet.id);

    // No synthetic user identity is supplied.
    const response = await join(database, null, code);

    assertApiError(response, 401, "AUTH_REQUIRED");
    assert.deepEqual(participants(database, bet.id), before);
  });
});

test("SCRUM-760: repeated joining never creates duplicate membership", async () => {
  await withDatabase(async (database) => {
    const creator = createCreatorUser(database);
    const user = createNonParticipantUser(database);
    const bet = createOpenBet(database, creator);
    const code = createValidInviteCode(database, bet);

    const firstResponse = await join(database, user.userID, code);

    assertJoinSuccess(firstResponse, bet, user.userID, 2);

    const afterFirst = participants(database, bet.id);

    assert.equal(afterFirst.length, 2);

    const secondResponse = await join(database, user.userID, code);

    assertApiError(secondResponse, 409, "ALREADY_JOINED");

    const afterSecond = participants(database, bet.id);

    assert.deepEqual(afterSecond, afterFirst);
    assert.equal(
      afterSecond.filter((entry) => entry.user_id === user.userID).length,
      1,
    );

    assert.equal(
      createBetRepository(database).findById(bet.id).current_participants,
      2,
    );
  });
});
