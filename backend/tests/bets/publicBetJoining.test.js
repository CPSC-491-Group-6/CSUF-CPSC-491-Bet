import assert from "node:assert/strict";
import test from "node:test";

import Database from "better-sqlite3";

import { createBetParticipationRepository } from "../../src/repositories/createBetParticipationRepository.js";
import { createBetParticipationService } from "../../src/services/createBetParticipationService.js";

/**
 * Create an isolated in-memory SQLite fixture for each test.
 *
 * The lightweight schema includes all fields required by the
 * production participation repository after SCRUM-826.
 *
 * Legacy bets retain their original option-less join behavior.
 * Bets with seeded options are classified as multiple-choice.
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
      answer_type TEXT NOT NULL DEFAULT 'legacy'
        CHECK (
          answer_type IN (
            'legacy',
            'multiple_choice',
            'free_response'
          )
        ),
      locked_at TEXT,
      resolved_at TEXT,
      winning_option_id TEXT,
      resolution_text TEXT
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
      prediction_text TEXT,
      PRIMARY KEY (bet_id, user_id),
      FOREIGN KEY (selected_option_id)
        REFERENCES bet_options(id)
    );

    CREATE TABLE bet_winners (
      bet_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      PRIMARY KEY (bet_id, user_id),
      FOREIGN KEY (bet_id, user_id)
        REFERENCES bet_participants(bet_id, user_id)
        ON DELETE CASCADE
    );
  `);

  // Release the isolated database after each test.
  t.after(() => database.close());

  const repository = createBetParticipationRepository(database);

  const service = createBetParticipationService({
    participationRepository: repository,
  });

  /**
   * Insert a bet and its creator as the first participant.
   *
   * Existing option-less test cases represent historical bets,
   * so they use the legacy answer type.
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
          max_participants,
          answer_type,
          locked_at,
          resolved_at
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, 'legacy',
          CASE WHEN ? IN ('locked', 'resolved')
            THEN '2026-11-09T10:00:00.000Z'
            ELSE NULL
          END,
          CASE WHEN ? = 'resolved'
            THEN '2026-11-09T11:00:00.000Z'
            ELSE NULL
          END
        )
      `,
      )
      .run(
        id,
        creatorID,
        joinCode,
        visibility,
        status,
        capacity,
        status,
        status,
      );

    database
      .prepare(
        `
        INSERT INTO bet_participants (
          bet_id,
          user_id,
          selected_option_id,
          prediction_text
        )
        VALUES (?, ?, NULL, NULL)
      `,
      )
      .run(id, creatorID);

    return id;
  }

  /**
   * Insert a choice and classify the bet as multiple-choice.
   *
   * This matches the existing tests that add options after
   * seeding the bet.
   */
  function seedOption(betID, optionID) {
    const updated = database
      .prepare(
        `
        UPDATE bets
        SET answer_type = 'multiple_choice'
        WHERE id = ?
          AND status <> 'resolved'
      `,
      )
      .run(betID);

    assert.equal(updated.changes, 1);

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
   * Read the number of stored participants for a bet.
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
   * Verify the expected application error and ensure that
   * rejected operations do not add membership records.
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

/**
 * PUBLIC-TC01
 * Eligible users can join public bets directly by ID.
 */
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

/**
 * PUBLIC-TC02
 * Private bets cannot be joined directly by ID.
 */
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

/**
 * PUBLIC-TC03
 * Private bets remain joinable through their invite codes.
 */
test("PUBLIC-TC03: invite-code joining still accepts private bets", (t) => {
  const fixture = createFixture(t);

  fixture.seedBet({
    id: "private-bet",
    joinCode: "PRIVATE123456",
    visibility: "private",
  });

  const participation = fixture.service.joinByCode(
    { join_code: "PRIVATE123456" },
    2,
  );

  assert.equal(participation.bet_id, "private-bet");
  assert.equal(participation.user_id, 2);
  assert.equal(fixture.countMembers("private-bet"), 2);
});

/**
 * PUBLIC-TC04
 * Repeated joining cannot duplicate membership.
 */
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

  assert.equal(fixture.countMembers("public-bet"), 2);
});

/**
 * PUBLIC-TC05
 * The creator cannot join again because creator membership
 * is established when the bet is created.
 */
test("PUBLIC-TC05: creator cannot join a second time", (t) => {
  const fixture = createFixture(t);
  fixture.seedBet();

  fixture.expectRejected(
    () => fixture.service.joinPublicById("public-bet", {}, 1),
    409,
    "ALREADY_JOINED",
    "public-bet",
  );

  assert.equal(fixture.countMembers("public-bet"), 1);
});

/**
 * PUBLIC-TC06
 * Capacity includes the creator's initial membership.
 */
test("PUBLIC-TC06: full public bet rejects another participant", (t) => {
  const fixture = createFixture(t);

  fixture.seedBet({
    capacity: 2,
  });

  fixture.service.joinPublicById("public-bet", {}, 2);

  fixture.expectRejected(
    () => fixture.service.joinPublicById("public-bet", {}, 3),
    409,
    "BET_FULL",
    "public-bet",
  );

  assert.equal(fixture.countMembers("public-bet"), 2);
});

/**
 * PUBLIC-TC07
 * Both locked and resolved bets reject new participants.
 */
for (const status of ["locked", "resolved"]) {
  test(`PUBLIC-TC07: ${status} public bet rejects joining`, (t) => {
    const fixture = createFixture(t);

    fixture.seedBet({
      status,
    });

    fixture.expectRejected(
      () => fixture.service.joinPublicById("public-bet", {}, 2),
      409,
      "BET_NOT_OPEN",
      "public-bet",
    );

    assert.equal(fixture.countMembers("public-bet"), 1);

    const stored = fixture.database
      .prepare("SELECT status FROM bets WHERE id = ?")
      .get("public-bet");

    assert.equal(stored.status, status);
  });
}

/**
 * PUBLIC-TC08
 * Multiple-choice bets require a valid answer selection.
 */
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

/**
 * PUBLIC-TC09
 * A valid multiple-choice selection is stored with membership.
 */
test("PUBLIC-TC09: valid answer persists during public joining", (t) => {
  const fixture = createFixture(t);
  fixture.seedBet();

  fixture.seedOption("public-bet", "option-yes");
  fixture.seedOption("public-bet", "option-no");

  const participation = fixture.service.joinPublicById(
    "public-bet",
    { selected_option_id: "option-yes" },
    2,
  );

  assert.equal(participation.bet_id, "public-bet");
  assert.equal(participation.selected_option_id, "option-yes");
  assert.equal(participation.current_participants, 2);

  const stored = fixture.database
    .prepare(
      `
      SELECT selected_option_id
      FROM bet_participants
      WHERE bet_id = ?
        AND user_id = ?
    `,
    )
    .get("public-bet", 2);

  assert.equal(stored.selected_option_id, "option-yes");
});

/**
 * PUBLIC-TC10
 * An option belonging to another bet is not valid.
 */
test("PUBLIC-TC10: an answer from another bet is rejected", (t) => {
  const fixture = createFixture(t);

  fixture.seedBet();

  fixture.seedBet({
    id: "other-bet",
    joinCode: "OTHER1234567",
  });

  fixture.seedOption("public-bet", "option-yes");
  fixture.seedOption("other-bet", "other-option");

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

/**
 * PUBLIC-TC11
 * Malformed answers must not create participants.
 */
test("PUBLIC-TC11: invalid input does not create membership", (t) => {
  const fixture = createFixture(t);
  fixture.seedBet();

  fixture.seedOption("public-bet", "option-yes");

  const invalidInputs = [
    { selected_option_id: "" },
    { selected_option_id: 123 },
    { selected_option_id: "x".repeat(101) },
    {
      selected_option_id: "option-yes",
      prediction_text: "Conflicting answer",
    },
  ];

  for (const input of invalidInputs) {
    fixture.expectRejected(
      () => fixture.service.joinPublicById("public-bet", input, 2),
      400,
      input.selected_option_id === "option-yes"
        ? "INVALID_ANSWER_TYPE"
        : "VALIDATION_ERROR",
      "public-bet",
    );
  }
});

/**
 * PUBLIC-TC12
 * Unknown public bet IDs return an application-level 404.
 */
test("PUBLIC-TC12: nonexistent bet returns 404", (t) => {
  const fixture = createFixture(t);

  fixture.expectRejected(
    () => fixture.service.joinPublicById("missing-bet", {}, 2),
    404,
    "BET_NOT_FOUND",
    "missing-bet",
  );
});

/**
 * PUBLIC-TC13
 * A successful public join preserves SQLite integrity.
 */
test("PUBLIC-TC13: public joining preserves SQLite integrity", (t) => {
  const fixture = createFixture(t);
  fixture.seedBet();

  fixture.service.joinPublicById("public-bet", {}, 2);

  assert.equal(
    fixture.database.pragma("integrity_check", { simple: true }),
    "ok",
  );

  assert.deepEqual(fixture.database.pragma("foreign_key_check"), []);

  assert.equal(fixture.countMembers("public-bet"), 2);
});

/**
 * PUBLIC-TC14
 * Public joining does not interfere with creator-only Lock.
 */
test("PUBLIC-TC14: public joining does not break creator locking", (t) => {
  const fixture = createFixture(t);
  fixture.seedBet();

  fixture.service.joinPublicById("public-bet", {}, 2);

  const locked = fixture.service.lockById("public-bet", 1);

  assert.equal(locked.id, "public-bet");
  assert.equal(locked.status, "locked");
  assert.ok(locked.locked_at);

  assert.equal(fixture.countMembers("public-bet"), 2);

  fixture.expectRejected(
    () => fixture.service.joinPublicById("public-bet", {}, 3),
    409,
    "BET_NOT_OPEN",
    "public-bet",
  );
});

/**
 * PUBLIC-TC15
 * Public Join preserves existing creator Resolve behavior
 * and multiple-choice winner identification.
 */
test("PUBLIC-TC15: public join retains creator Resolve and winners", (t) => {
  const fixture = createFixture(t);
  fixture.seedBet();

  fixture.seedOption("public-bet", "option-yes");
  fixture.seedOption("public-bet", "option-no");

  const participation = fixture.service.joinPublicById(
    "public-bet",
    { selected_option_id: "option-yes" },
    2,
  );

  assert.equal(participation.selected_option_id, "option-yes");

  const locked = fixture.service.lockById("public-bet", 1);

  assert.equal(locked.status, "locked");

  const result = fixture.service.resolveById(
    "public-bet",
    { winning_option_id: "option-yes" },
    1,
  );

  assert.equal(result.bet.status, "resolved");
  assert.equal(result.bet.winning_option_id, "option-yes");

  assert.deepEqual(result.winners, [
    {
      user_id: 2,
      selected_option_id: "option-yes",
    },
  ]);

  const stored = fixture.database
    .prepare(
      `
      SELECT status, winning_option_id, resolved_at
      FROM bets
      WHERE id = ?
    `,
    )
    .get("public-bet");

  assert.equal(stored.status, "resolved");
  assert.equal(stored.winning_option_id, "option-yes");
  assert.ok(stored.resolved_at);

  assert.deepEqual(fixture.database.pragma("foreign_key_check"), []);
});
