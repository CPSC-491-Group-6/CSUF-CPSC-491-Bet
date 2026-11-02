
import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

import { createApp } from "../../src/createApp.js";
import { createBetRepository } from "../../src/repositories/createBetRepository.js";
import { createBetService } from "../../src/services/createBetService.js";

import { createBetTestDatabase } from "../helpers/betStateTestUtils.js";
import {
  createAuthorizationTestSessionMiddleware,
  createParticipantState,
} from "../helpers/authorizationTestUtils.js";

import {
  createCreatorUser,
  createNonParticipantUser,
} from "../fixtures/users.js";

import {
  createOpenBet,
  createLockedBet,
} from "../fixtures/bets.js";

import {
  createValidInviteCode,
  createInvalidInviteCode,
} from "../fixtures/inviteCodes.js";

// SCRUM-760: Join Bet and Participant Integration Tests
//
// Test-driven development:
// The endpoint-dependent tests are intentionally active.
// They should fail until POST /api/bets/join is implemented.

async function withDatabase(run) {
  const db = createBetTestDatabase();

  try {
    return await run(db);
  } finally {
    db.close();
  }
}

function participants(db, betId) {
  return db
    .prepare(
      `SELECT user_id
       FROM bet_participants
       WHERE bet_id = ?
       ORDER BY user_id`,
    )
    .all(betId);
}

function testApp(db) {
  return createApp({
    authService: {},
    betService: createBetService({
      betRepository: createBetRepository(db),
    }),
    sessionMiddleware:
      createAuthorizationTestSessionMiddleware(db),
  });
}

async function join(db, userID, inviteCode) {
  const body =
    inviteCode === undefined
      ? {}
      : { invite_code: inviteCode };

  const req = request(testApp(db)).post("/api/bets/join");

  if (userID != null) {
    req.set("x-test-user", String(userID));
  }

  return req.send(body);
}

function assertApiError(response, expectedStatus) {
  assert.equal(response.status, expectedStatus);

  assert.match(
    response.headers["content-type"] ?? "",
    /application\/json/,
    "Expected a JSON API response",
  );

  assert.ok(
    typeof response.body.error?.code === "string" &&
      response.body.error.code.length > 0,
    "Expected a structured API error code",
  );
}

// --------------------------------------------------
// EXISTING REPOSITORY FUNCTIONALITY
// These tests should pass before Join API exists.
// --------------------------------------------------

test("SCRUM-760: valid invite code identifies the correct bet", () => {
  const db = createBetTestDatabase();

  try {
    const creator = createCreatorUser(db);
    const bet = createOpenBet(db, creator);

    const code = createValidInviteCode(db, bet);
    const repository = createBetRepository(db);

    assert.equal(repository.findByJoinCode(code).id, bet.id);

    assert.equal(
      repository.findByJoinCode(code.toLowerCase()).id,
      bet.id,
    );

    assert.equal(participants(db, bet.id).length, 1);
  } finally {
    db.close();
  }
});

test("SCRUM-760: unknown invite-code lookup leaves membership unchanged", () => {
  const db = createBetTestDatabase();

  try {
    const creator = createCreatorUser(db);
    const bet = createOpenBet(db, creator);

    const invalidCode = createInvalidInviteCode(db);
    const before = participants(db, bet.id);

    assert.equal(
      createBetRepository(db).findByJoinCode(invalidCode),
      undefined,
    );

    assert.deepEqual(participants(db, bet.id), before);
  } finally {
    db.close();
  }
});

// --------------------------------------------------
// BACKEND JOIN API INTEGRATION TESTS
// Expected to fail until Join endpoint is implemented.
// --------------------------------------------------

test("SCRUM-760: eligible user joins an open bet successfully", async () => {
  await withDatabase(async (db) => {
    const creator = createCreatorUser(db);
    const user = createNonParticipantUser(db);

    const bet = createOpenBet(db, creator);
    const code = createValidInviteCode(db, bet);

    const before = participants(db, bet.id);

    assert.equal(before.length, 1);

    const response = await join(db, user.userID, code);

    assert.ok(
      [200, 201].includes(response.status),
      `Expected successful join, received ${response.status}`,
    );

    assert.equal(response.body.bet?.id, bet.id);

    const after = participants(db, bet.id);

    assert.equal(after.length, 2);

    assert.ok(
      after.some((p) => p.user_id === user.userID),
      "Joined user should appear in participant records",
    );

    const repository = createBetRepository(db);

    assert.equal(
      repository.findById(bet.id).current_participants,
      2,
    );
  });
});

test("SCRUM-760: duplicate joining is rejected without state change", async () => {
  await withDatabase(async (db) => {
    const creator = createCreatorUser(db);
    const bet = createOpenBet(db, creator);

    const { user } = createParticipantState(db, bet);
    const code = createValidInviteCode(db, bet);

    const before = participants(db, bet.id);

    const response = await join(db, user.userID, code);

    assertApiError(response, 409);

    const after = participants(db, bet.id);

    assert.deepEqual(after, before);

    assert.equal(
      after.filter((p) => p.user_id === user.userID).length,
      1,
    );
  });
});

test("SCRUM-760: locked bet rejects a new participant", async () => {
  await withDatabase(async (db) => {
    const creator = createCreatorUser(db);
    const user = createNonParticipantUser(db);

    const bet = createLockedBet(db, creator);
    const code = createValidInviteCode(db, bet);

    const before = participants(db, bet.id);

    const response = await join(db, user.userID, code);

    assertApiError(response, 409);

    assert.deepEqual(participants(db, bet.id), before);

    assert.ok(
      !participants(db, bet.id).some(
        (p) => p.user_id === user.userID,
      ),
    );
  });
});

test("SCRUM-760: unknown invite code is rejected without modifying participants", async () => {
  await withDatabase(async (db) => {
    const creator = createCreatorUser(db);
    const user = createNonParticipantUser(db);

    const bet = createOpenBet(db, creator);
    const before = participants(db, bet.id);

    const invalidCode = createInvalidInviteCode(db);

    const response = await join(
      db,
      user.userID,
      invalidCode,
    );

    // A missing Express route also returns 404.
    // Require a structured JSON error to avoid false success.
    assertApiError(response, 404);

    assert.deepEqual(participants(db, bet.id), before);
  });
});

test("SCRUM-760: malformed invite code is rejected", async () => {
  await withDatabase(async (db) => {
    const creator = createCreatorUser(db);
    const user = createNonParticipantUser(db);

    const bet = createOpenBet(db, creator);
    const before = participants(db, bet.id);

    const response = await join(
      db,
      user.userID,
      "INVALID!",
    );

    assertApiError(response, 400);

    assert.deepEqual(participants(db, bet.id), before);
  });
});

test("SCRUM-760: empty invite code is rejected", async () => {
  await withDatabase(async (db) => {
    const creator = createCreatorUser(db);
    const user = createNonParticipantUser(db);

    const bet = createOpenBet(db, creator);
    const before = participants(db, bet.id);

    const response = await join(db, user.userID, "");

    assertApiError(response, 400);

    assert.deepEqual(participants(db, bet.id), before);
  });
});

test("SCRUM-760: unauthenticated joining is rejected", async () => {
  await withDatabase(async (db) => {
    const creator = createCreatorUser(db);
    const user = createNonParticipantUser(db);

    const bet = createOpenBet(db, creator);
    const code = createValidInviteCode(db, bet);

    // Verify the endpoint exists and works for an
    // authenticated eligible user first.
    const authorized = await join(db, user.userID, code);

    assert.ok(
      [200, 201].includes(authorized.status),
      "Expected Join endpoint to accept a valid authenticated user",
    );

    const before = participants(db, bet.id);

    const response = await join(db, null, code);

    assertApiError(response, 401);

    assert.equal(response.body.error.code, "AUTH_REQUIRED");

    assert.deepEqual(participants(db, bet.id), before);
  });
});

test("SCRUM-760: repeated joining never creates duplicate membership", async () => {
  await withDatabase(async (db) => {
    const creator = createCreatorUser(db);
    const user = createNonParticipantUser(db);

    const bet = createOpenBet(db, creator);
    const code = createValidInviteCode(db, bet);

    const first = await join(db, user.userID, code);

    assert.ok(
      [200, 201].includes(first.status),
      "First join should succeed",
    );

    const afterFirst = participants(db, bet.id);

    assert.equal(afterFirst.length, 2);

    const second = await join(db, user.userID, code);

    assertApiError(second, 409);

    const afterSecond = participants(db, bet.id);

    assert.deepEqual(afterSecond, afterFirst);

    assert.equal(
      afterSecond.filter(
        (p) => p.user_id === user.userID,
      ).length,
      1,
    );
  });
});
