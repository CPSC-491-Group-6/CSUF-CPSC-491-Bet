import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";

import { createBetParticipationRepository } from "../../src/repositories/createBetParticipationRepository.js";
import { createBetParticipationService } from "../../src/services/createBetParticipationService.js";

/**
 * Create an isolated in-memory SQLite fixture for each test.
 *
 * The bets table retains Resolve columns because Join, Lock,
 * and Resolve share the same participation repository.
 */
function createFixture(t) {
  const database = new Database(":memory:");

  database.pragma("foreign_keys = ON");

  database.exec(`
    CREATE TABLE bets (
      id TEXT PRIMARY KEY,
      creator_id INTEGER NOT NULL,
      join_code TEXT NOT NULL UNIQUE,
      visibility TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      max_participants INTEGER NOT NULL,
      locked_at TEXT,
      resolved_at TEXT,
      winning_option_id TEXT
    );

    CREATE TABLE bet_options (
      id TEXT PRIMARY KEY,
      bet_id TEXT NOT NULL REFERENCES bets(id),
      label TEXT NOT NULL
    );

    CREATE TABLE bet_participants (
      bet_id TEXT NOT NULL REFERENCES bets(id),
      user_id INTEGER NOT NULL,
      selected_option_id TEXT,
      PRIMARY KEY (bet_id, user_id),
      FOREIGN KEY (selected_option_id)
        REFERENCES bet_options(id)
    );
  `);

  t.after(() => database.close());

  const repository = createBetParticipationRepository(database);

  const service = createBetParticipationService({
    participationRepository: repository,
  });

  /**
   * Insert a bet with its creator as the initial participant.
   */
  function seedBet({
    id = "public-bet",
    creatorID = 1,
    joinCode = "ABC123DEF456",
    visibility = "public",
    status = "open",
    capacity = 3,
  } = {}) {
    database
      .prepare(
        `
        INSERT INTO bets (
          id,
          creator_id,
          join_code,
          visibility,
          status,
          max_participants
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      )
      .run(id, creatorID, joinCode, visibility, status, capacity);

    database
      .prepare(
        `
        INSERT INTO bet_participants (
          bet_id,
          user_id,
          selected_option_id
        )
        VALUES (?, ?, NULL)
      `,
      )
      .run(id, creatorID);

    return id;
  }

  /**
   * Insert an answer option for a specific bet.
   */
  function seedOption(betID, optionID) {
    database
      .prepare(
        `
        INSERT INTO bet_options (
          id,
          bet_id,
          label
        )
        VALUES (?, ?, ?)
      `,
      )
      .run(optionID, betID, optionID);

    return optionID;
  }

  /**
   * Read the persisted membership count.
   */
  function countMembers(betID) {
    return database
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM bet_participants
        WHERE bet_id = ?
      `,
      )
      .get(betID).count;
  }

  /**
   * Verify that a rejected operation leaves membership unchanged.
   */
  function expectRejected(action, statusCode, errorCode, betID) {
    const before = countMembers(betID);

    assert.throws(action, (error) => {
      assert.equal(error.statusCode, statusCode);
      assert.equal(error.code, errorCode);

      return true;
    });

    assert.equal(countMembers(betID), before);
  }

  return {
    database,
    service,
    seedBet,
    seedOption,
    countMembers,
    expectRejected,
  };
}

test("PUBLIC-TC01: eligible user joins a public bet by ID", (t) => {
  const fixture = createFixture(t);
  fixture.seedBet();

  const participation = fixture.service.joinPublicById("public-bet", {}, 2);

  assert.equal(participation.bet_id, "public-bet");
  assert.equal(participation.user_id, 2);
  assert.equal(participation.selected_option_id, null);
  assert.equal(participation.current_participants, 2);
  assert.equal(fixture.countMembers("public-bet"), 2);
});

test("PUBLIC-TC02: private bets cannot be joined by ID", (t) => {
  const fixture = createFixture(t);

  fixture.seedBet({
    id: "private-bet",
    visibility: "private",
  });

  fixture.expectRejected(
    () => fixture.service.joinPublicById("private-bet", {}, 2),
    404,
    "BET_NOT_FOUND",
    "private-bet",
  );
});

test("PUBLIC-TC03: invite-code joining still accepts private bets", (t) => {
  const fixture = createFixture(t);

  fixture.seedBet({
    id: "private-bet",
    visibility: "private",
  });

  const participation = fixture.service.joinByCode(
    { join_code: "ABC123DEF456" },
    2,
  );

  assert.equal(participation.bet_id, "private-bet");
  assert.equal(participation.current_participants, 2);
  assert.equal(fixture.countMembers("private-bet"), 2);
});

test("PUBLIC-TC04: duplicate public joining is rejected", (t) => {
  const fixture = createFixture(t);
  fixture.seedBet();

  fixture.service.joinPublicById("public-bet", {}, 2);

  fixture.expectRejected(
    () => fixture.service.joinPublicById("public-bet", {}, 2),
    409,
    "ALREADY_JOINED",
    "public-bet",
  );
});

test("PUBLIC-TC05: creator cannot join a second time", (t) => {
  const fixture = createFixture(t);
  fixture.seedBet();

  fixture.expectRejected(
    () => fixture.service.joinPublicById("public-bet", {}, 1),
    409,
    "ALREADY_JOINED",
    "public-bet",
  );
});

test("PUBLIC-TC06: full public bet rejects another participant", (t) => {
  const fixture = createFixture(t);

  fixture.seedBet({ capacity: 2 });

  fixture.service.joinPublicById("public-bet", {}, 2);

  fixture.expectRejected(
    () => fixture.service.joinPublicById("public-bet", {}, 3),
    409,
    "BET_FULL",
    "public-bet",
  );
});

for (const status of ["locked", "resolved"]) {
  test(`PUBLIC-TC07: ${status} public bet rejects joining`, (t) => {
    const fixture = createFixture(t);

    fixture.seedBet({ status });

    fixture.expectRejected(
      () => fixture.service.joinPublicById("public-bet", {}, 2),
      409,
      "BET_NOT_OPEN",
      "public-bet",
    );
  });
}

test("PUBLIC-TC08: option-based public bet requires an answer", (t) => {
  const fixture = createFixture(t);
  fixture.seedBet();

  fixture.seedOption("public-bet", "option-yes");
  fixture.seedOption("public-bet", "option-no");

  fixture.expectRejected(
    () => fixture.service.joinPublicById("public-bet", {}, 2),
    400,
    "ANSWER_REQUIRED",
    "public-bet",
  );
});

test("PUBLIC-TC09: valid answer persists during public joining", (t) => {
  const fixture = createFixture(t);
  fixture.seedBet();

  fixture.seedOption("public-bet", "option-yes");

  const participation = fixture.service.joinPublicById(
    "public-bet",
    { selected_option_id: "option-yes" },
    2,
  );

  assert.equal(participation.selected_option_id, "option-yes");

  const record = fixture.database
    .prepare(
      `
      SELECT selected_option_id
      FROM bet_participants
      WHERE bet_id = ?
        AND user_id = ?
    `,
    )
    .get("public-bet", 2);

  assert.equal(record.selected_option_id, "option-yes");
});

test("PUBLIC-TC10: an answer from another bet is rejected", (t) => {
  const fixture = createFixture(t);

  fixture.seedBet();

  fixture.seedBet({
    id: "second-bet",
    joinCode: "FED456CBA123",
  });

  fixture.seedOption("public-bet", "option-yes");
  fixture.seedOption("second-bet", "other-option");

  fixture.expectRejected(
    () =>
      fixture.service.joinPublicById(
        "public-bet",
        { selected_option_id: "other-option" },
        2,
      ),
    400,
    "INVALID_OPTION",
    "public-bet",
  );
});

test("PUBLIC-TC11: invalid input does not create membership", (t) => {
  const fixture = createFixture(t);
  fixture.seedBet();

  fixture.expectRejected(
    () =>
      fixture.service.joinPublicById(
        "public-bet",
        { selected_option_id: "" },
        2,
      ),
    400,
    "VALIDATION_ERROR",
    "public-bet",
  );

  fixture.expectRejected(
    () => fixture.service.joinPublicById("", {}, 2),
    400,
    "VALIDATION_ERROR",
    "public-bet",
  );
});

test("PUBLIC-TC12: nonexistent bet returns 404", (t) => {
  const fixture = createFixture(t);
  fixture.seedBet();

  fixture.expectRejected(
    () => fixture.service.joinPublicById("unknown-bet", {}, 2),
    404,
    "BET_NOT_FOUND",
    "public-bet",
  );
});

test("PUBLIC-TC13: public joining preserves SQLite integrity", (t) => {
  const fixture = createFixture(t);
  fixture.seedBet();

  fixture.service.joinPublicById("public-bet", {}, 2);

  const integrity = fixture.database.prepare("PRAGMA integrity_check").get();

  assert.equal(integrity.integrity_check, "ok");

  const foreignKeys = fixture.database
    .prepare("PRAGMA foreign_key_check")
    .all();

  assert.deepEqual(foreignKeys, []);
});

test("PUBLIC-TC14: public joining does not break creator locking", (t) => {
  const fixture = createFixture(t);
  fixture.seedBet();

  fixture.service.joinPublicById("public-bet", {}, 2);

  const lockedBet = fixture.service.lockById("public-bet", 1);

  assert.equal(lockedBet.status, "locked");
  assert.ok(lockedBet.locked_at);
  assert.equal(fixture.countMembers("public-bet"), 2);

  fixture.expectRejected(
    () => fixture.service.joinPublicById("public-bet", {}, 3),
    409,
    "BET_NOT_OPEN",
    "public-bet",
  );
});

test("PUBLIC-TC15: public join retains creator Resolve and winners", (t) => {
  const fixture = createFixture(t);
  fixture.seedBet();

  fixture.seedOption("public-bet", "option-yes");
  fixture.seedOption("public-bet", "option-no");

  // Join the public bet with a stored answer.
  fixture.service.joinPublicById(
    "public-bet",
    { selected_option_id: "option-yes" },
    2,
  );

  // Complete the required Open -> Locked -> Resolved lifecycle.
  fixture.service.lockById("public-bet", 1);

  const result = fixture.service.resolveById(
    "public-bet",
    { winning_option_id: "option-yes" },
    1,
  );

  // Confirm final outcome and winning participant.
  assert.equal(result.bet.status, "resolved");
  assert.equal(result.bet.winning_option_id, "option-yes");
  assert.ok(result.bet.resolved_at);

  assert.deepEqual(result.winners, [
    {
      user_id: 2,
      selected_option_id: "option-yes",
    },
  ]);

  // Resolution must preserve participant membership.
  assert.equal(fixture.countMembers("public-bet"), 2);
});
