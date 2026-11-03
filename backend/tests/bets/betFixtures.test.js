import assert from "node:assert/strict";
import test from "node:test";

import { createBetRepository } from "../../src/repositories/createBetRepository.js";

import {
  createBetTestDatabase,
  resetBetTestState,
} from "../helpers/betStateTestUtils.js";

import {
  createCreatorState,
  createParticipantState,
  createNonParticipantState,
  createAuthorizationTestSessionMiddleware,
  getTestAuthHeaders,
} from "../helpers/authorizationTestUtils.js";

import {
  createCreatorUser,
  createParticipantUser,
  createNonParticipantUser,
} from "../fixtures/users.js";

import { createOpenBet, createLockedBet } from "../fixtures/bets.js";

import {
  createValidInviteCode,
  createInvalidInviteCode,
} from "../fixtures/inviteCodes.js";

// Every test receives its own isolated database.
function setup(t) {
  const database = createBetTestDatabase();
  t.after(() => database.close());
  return database;
}

function getParticipants(database, betID) {
  return database
    .prepare("SELECT user_id FROM bet_participants WHERE bet_id = ?")
    .all(betID)
    .map((row) => row.user_id);
}

function countRows(database, table) {
  return database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
}

test("Creator, participant, and non-participant users are distinct", (t) => {
  const db = setup(t);

  const creator = createCreatorUser(db);
  const participant = createParticipantUser(db);
  const nonParticipant = createNonParticipantUser(db);

  const ids = [creator.userID, participant.userID, nonParticipant.userID];

  assert.equal(new Set(ids).size, 3);
  assert.equal(countRows(db, "users"), 3);
});

test("Open bet fixture creates valid ownership and state", (t) => {
  const db = setup(t);

  const creator = createCreatorUser(db);
  const bet = createOpenBet(db, creator);

  assert.equal(bet.creator_id, creator.userID);
  assert.equal(bet.status, "open");
  assert.equal(bet.locked_at, null);
  assert.equal(bet.resolved_at, null);

  assert.ok(getParticipants(db, bet.id).includes(creator.userID));
});

test("Locked bet fixture creates valid locked state", (t) => {
  const db = setup(t);

  const creator = createCreatorUser(db);
  const openBet = createOpenBet(db, creator);
  const lockedBet = createLockedBet(db, creator);

  assert.equal(openBet.status, "open");
  assert.equal(lockedBet.status, "locked");

  assert.equal(openBet.locked_at, null);
  assert.ok(lockedBet.locked_at);

  assert.notEqual(openBet.id, lockedBet.id);
  assert.equal(lockedBet.creator_id, creator.userID);
});

test("Authorization fixtures establish correct role relationships", (t) => {
  const db = setup(t);

  const creator = createCreatorState(db);
  const participant = createParticipantState(db, creator.bet);
  const nonParticipant = createNonParticipantState(db, creator.bet);

  const members = getParticipants(db, creator.bet.id);

  assert.equal(creator.bet.creator_id, creator.user.userID);

  assert.ok(members.includes(creator.user.userID));
  assert.ok(members.includes(participant.user.userID));
  assert.ok(!members.includes(nonParticipant.user.userID));

  assert.equal(
    new Set([
      creator.user.userID,
      participant.user.userID,
      nonParticipant.user.userID,
    ]).size,
    3,
  );
});

test("Role fixtures work with locked bets", (t) => {
  const db = setup(t);

  const creator = createCreatorState(db, {
    status: "locked",
  });

  const participant = createParticipantState(db, creator.bet);
  const nonParticipant = createNonParticipantState(db, creator.bet);

  const members = getParticipants(db, creator.bet.id);

  assert.equal(creator.bet.status, "locked");
  assert.ok(members.includes(participant.user.userID));
  assert.ok(!members.includes(nonParticipant.user.userID));
});

test("Valid and invalid invite codes resolve correctly", (t) => {
  const db = setup(t);

  const creator = createCreatorUser(db);
  const bet = createOpenBet(db, creator);

  const validCode = createValidInviteCode(db, bet);
  const invalidCode = createInvalidInviteCode(db);

  const repository = createBetRepository(db);

  assert.equal(repository.findByJoinCode(validCode).id, bet.id);

  assert.equal(repository.findByJoinCode(validCode.toLowerCase()).id, bet.id);

  assert.equal(repository.findByJoinCode(invalidCode), undefined);
  assert.notEqual(validCode, invalidCode);
});

test("Authentication helper initializes only valid test users", (t) => {
  const db = setup(t);

  const creator = createCreatorState(db);
  const participant = createParticipantState(db, creator.bet);

  const middleware = createAuthorizationTestSessionMiddleware(db);
  const headers = getTestAuthHeaders(participant);

  const req = {
    get: (name) => headers[name],
  };

  let nextCalled = false;

  middleware(req, {}, () => {
    nextCalled = true;
  });

  assert.equal(req.session.userID, participant.user.userID);
  assert.equal(nextCalled, true);

  const invalidReq = {
    get: () => "999999",
  };

  middleware(invalidReq, {}, () => {});

  assert.equal(invalidReq.session, undefined);
});

test("Database reset clears all test state", (t) => {
  const db = setup(t);

  const creator = createCreatorState(db);
  createParticipantState(db, creator.bet);
  createNonParticipantState(db, creator.bet);

  db.prepare(
    "INSERT INTO sessions (sid, session, expiresAt) VALUES (?, ?, ?)",
  ).run("test-session", "{}", Date.now() + 60000);

  resetBetTestState(db);

  for (const table of ["sessions", "bet_participants", "bets", "users"]) {
    assert.equal(countRows(db, table), 0);
  }

  // Resetting a clean database must also be safe.
  resetBetTestState(db);

  const recreated = createCreatorState(db);

  assert.equal(recreated.user.userID, 1);
  assert.equal(recreated.bet.status, "open");
});

test("Failed fixture initialization rolls back partial state", (t) => {
  const db = setup(t);

  const creator = createCreatorState(db);

  const usersBefore = countRows(db, "users");
  const participantsBefore = countRows(db, "bet_participants");

  assert.throws(() => {
    createParticipantState(db, {
      id: "nonexistent-bet",
    });
  });

  assert.equal(countRows(db, "users"), usersBefore);

  assert.equal(countRows(db, "bet_participants"), participantsBefore);

  assert.equal(creator.bet.status, "open");
});

test("Independent test databases do not share state", (t) => {
  const first = setup(t);
  const second = setup(t);

  const firstCreator = createCreatorState(first);

  assert.equal(countRows(first, "users"), 1);
  assert.equal(countRows(second, "users"), 0);

  const secondCreator = createCreatorState(second, {
    status: "locked",
  });

  assert.equal(firstCreator.user.userID, 1);
  assert.equal(secondCreator.user.userID, 1);

  assert.equal(firstCreator.bet.status, "open");
  assert.equal(secondCreator.bet.status, "locked");

  assert.equal(countRows(first, "bets"), 1);
  assert.equal(countRows(second, "bets"), 1);
});
