import test from "node:test";
import assert from "node:assert/strict";

import { createBetRepository } from "../../src/repositories/createBetRepository.js";
import {
  createBetTestDatabase,
  resetBetTestState,
} from "../helpers/betStateTestUtils.js";
import {
  createCreatorState,
  createParticipantState,
  createNonParticipantState,
} from "../helpers/authorizationTestUtils.js";

function withTestDatabase(callback) {
  const db = createBetTestDatabase();

  try {
    return callback(db);
  } finally {
    db.close();
  }
}

function getParticipants(db, betId) {
  return db
    .prepare(
      `SELECT user_id
       FROM bet_participants
       WHERE bet_id = ?
       ORDER BY user_id`,
    )
    .all(betId);
}

test("SCRUM-760: creator is registered as initial participant", () => {
  withTestDatabase((db) => {
    const { user, bet } = createCreatorState(db);
    const participants = getParticipants(db, bet.id);

    assert.equal(participants.length, 1);
    assert.equal(participants[0].user_id, user.userID);

    const repository = createBetRepository(db);
    assert.equal(repository.findById(bet.id).current_participants, 1);
  });
});

test("SCRUM-760: existing participant state is recorded correctly", () => {
  withTestDatabase((db) => {
    const { bet } = createCreatorState(db);
    const { user } = createParticipantState(db, bet);

    const participants = getParticipants(db, bet.id);

    assert.equal(participants.length, 2);

    assert.ok(
      participants.some((participant) => participant.user_id === user.userID),
    );

    const repository = createBetRepository(db);

    assert.equal(repository.findById(bet.id).current_participants, 2);
  });
});

test("SCRUM-760: non-participant has no membership record", () => {
  withTestDatabase((db) => {
    const { bet } = createCreatorState(db);
    const { user } = createNonParticipantState(db, bet);

    const participants = getParticipants(db, bet.id);

    assert.equal(participants.length, 1);

    assert.ok(
      !participants.some((participant) => participant.user_id === user.userID),
    );
  });
});

test("SCRUM-760: duplicate membership insert is rejected without state change", () => {
  withTestDatabase((db) => {
    const { bet } = createCreatorState(db);
    const { user } = createParticipantState(db, bet);

    const before = getParticipants(db, bet.id);

    assert.throws(() => {
      db.prepare(
        `INSERT INTO bet_participants (bet_id, user_id)
         VALUES (?, ?)`,
      ).run(bet.id, user.userID);
    }, /UNIQUE constraint failed/);

    const after = getParticipants(db, bet.id);

    assert.deepEqual(after, before);
    assert.equal(after.length, 2);
  });
});

test("SCRUM-760: participant membership is isolated between bets", () => {
  withTestDatabase((db) => {
    const { bet: firstBet } = createCreatorState(db);
    const { bet: secondBet } = createCreatorState(db);

    const { user } = createParticipantState(db, firstBet);

    const firstParticipants = getParticipants(db, firstBet.id);
    const secondParticipants = getParticipants(db, secondBet.id);

    assert.equal(firstParticipants.length, 2);
    assert.equal(secondParticipants.length, 1);

    assert.ok(firstParticipants.some((p) => p.user_id === user.userID));

    assert.ok(!secondParticipants.some((p) => p.user_id === user.userID));
  });
});

test("SCRUM-760: participant test state can be reset and recreated", () => {
  withTestDatabase((db) => {
    const { bet } = createCreatorState(db);
    createParticipantState(db, bet);

    assert.equal(getParticipants(db, bet.id).length, 2);

    resetBetTestState(db);

    const remaining = db
      .prepare("SELECT COUNT(*) AS total FROM bet_participants")
      .get();

    assert.equal(remaining.total, 0);

    const { bet: newBet } = createCreatorState(db);

    assert.equal(getParticipants(db, newBet.id).length, 1);
  });
});
