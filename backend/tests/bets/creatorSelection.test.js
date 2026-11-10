import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";

import { createBetRepository } from "../../src/repositories/createBetRepository.js";
import { createBetService } from "../../src/services/createBetService.js";

/**
 * Initialize an isolated database for each test.
 *
 * The fixture models the relevant production relationships.
 * Full application migrations remain covered by backend CI.
 */
function createFixture(t) {
  const database = new Database(":memory:");

  database.pragma("foreign_keys = ON");

  database.exec(`
    CREATE TABLE users (
      userID INTEGER PRIMARY KEY,
      username TEXT NOT NULL
    );

    CREATE TABLE bets (
      id TEXT PRIMARY KEY,
      creator_id INTEGER NOT NULL REFERENCES users(userID),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      join_code TEXT NOT NULL UNIQUE,
      visibility TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      max_participants INTEGER NOT NULL,
      winning_option_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      locked_at TEXT,
      resolved_at TEXT
    );

    CREATE TABLE bet_options (
      id TEXT PRIMARY KEY,
      bet_id TEXT NOT NULL REFERENCES bets(id),
      label TEXT NOT NULL,
      position INTEGER NOT NULL,
      UNIQUE (bet_id, position)
    );

    CREATE TABLE bet_participants (
      bet_id TEXT NOT NULL REFERENCES bets(id),
      user_id INTEGER NOT NULL REFERENCES users(userID),
      selected_option_id TEXT REFERENCES bet_options(id),
      joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (bet_id, user_id)
    );

    CREATE TRIGGER check_participant_option_insert
    BEFORE INSERT ON bet_participants
    WHEN NEW.selected_option_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM bet_options
        WHERE id = NEW.selected_option_id
          AND bet_id = NEW.bet_id
      )
    BEGIN
      SELECT RAISE(
        ABORT,
        'selected option does not belong to bet'
      );
    END;
  `);

  database
    .prepare(
      `
      INSERT INTO users (userID, username)
      VALUES (?, ?)
    `,
    )
    .run(17, "creator");

  t.after(() => database.close());

  const repository = createBetRepository(database);

  const service = createBetService({
    betRepository: repository,
    makeJoinCode: () => "CREATORTEST01",
  });

  /**
   * Count records to verify both successful writes
   * and complete rollback after failed creation.
   */
  function count(table) {
    const allowed = ["bets", "bet_options", "bet_participants"];

    if (!allowed.includes(table)) {
      throw new Error("Unexpected test table.");
    }

    return database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()
      .count;
  }

  return {
    database,
    repository,
    service,
    count,
  };
}

/**
 * Produce deterministic test-only Create Bet input.
 */
function makeInput(overrides = {}) {
  return {
    title: "Creator Selection Test",
    description: "Verify the creator answer is stored.",
    visibility: "private",
    max_participants: 3,
    options: ["Yes", "No"],
    ...overrides,
  };
}

/**
 * Verify a rejected Create Bet request creates no records.
 */
function expectInvalidCreation(fixture, input) {
  assert.throws(
    () => fixture.service.createBet(input, 17),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "VALIDATION_ERROR");
      return true;
    },
  );

  assert.equal(fixture.count("bets"), 0);
  assert.equal(fixture.count("bet_options"), 0);
  assert.equal(fixture.count("bet_participants"), 0);
}

for (const [index, expectedLabel] of [
  [0, "Yes"],
  [1, "No"],
]) {
  test(`CREATOR-TC01: creator selects ${expectedLabel} at index ${index}`, (t) => {
    const fixture = createFixture(t);

    const bet = fixture.service.createBet(
      makeInput({
        creator_selected_option_index: index,
      }),
      17,
    );

    assert.equal(bet.creator_id, 17);
    assert.equal(bet.current_participants, 1);
    assert.equal(fixture.count("bets"), 1);
    assert.equal(fixture.count("bet_options"), 2);
    assert.equal(fixture.count("bet_participants"), 1);

    const membership = fixture.database
      .prepare(
        `
          SELECT
            bp.user_id,
            bp.selected_option_id,
            o.label,
            o.position
          FROM bet_participants AS bp
          JOIN bet_options AS o
            ON o.id = bp.selected_option_id
           AND o.bet_id = bp.bet_id
          WHERE bp.bet_id = ?
            AND bp.user_id = ?
        `,
      )
      .get(bet.id, 17);

    assert.ok(membership);
    assert.equal(membership.user_id, 17);
    assert.equal(membership.label, expectedLabel);
    assert.equal(membership.position, index);
    assert.ok(membership.selected_option_id);

    // The creator can retrieve the persisted selection.
    const details = fixture.service.getBetById(bet.id, 17);

    assert.equal(details.options.length, 2);
    assert.equal(details.participants.length, 1);
    assert.equal(
      details.participants[0].selected_option_id,
      membership.selected_option_id,
    );
  });
}

test("CREATOR-TC02: legacy Create Bet without a choice remains valid", (t) => {
  const fixture = createFixture(t);

  const bet = fixture.service.createBet(makeInput(), 17);

  const participant = fixture.database
    .prepare(
      `
      SELECT selected_option_id
      FROM bet_participants
      WHERE bet_id = ?
        AND user_id = ?
    `,
    )
    .get(bet.id, 17);

  assert.equal(participant.selected_option_id, null);
  assert.equal(bet.current_participants, 1);
  assert.equal(fixture.count("bet_options"), 2);
});

test("CREATOR-TC03: optionless legacy bet retains creator membership", (t) => {
  const fixture = createFixture(t);

  const bet = fixture.service.createBet(makeInput({ options: undefined }), 17);

  const participant = fixture.database
    .prepare(
      `
      SELECT selected_option_id
      FROM bet_participants
      WHERE bet_id = ?
        AND user_id = ?
    `,
    )
    .get(bet.id, 17);

  assert.equal(participant.selected_option_id, null);
  assert.equal(bet.current_participants, 1);
  assert.equal(fixture.count("bet_options"), 0);
});

test("CREATOR-TC04: out-of-range selection is rejected", (t) => {
  const fixture = createFixture(t);

  expectInvalidCreation(
    fixture,
    makeInput({
      creator_selected_option_index: 2,
    }),
  );
});

test("CREATOR-TC05: negative selection is rejected", (t) => {
  const fixture = createFixture(t);

  expectInvalidCreation(
    fixture,
    makeInput({
      creator_selected_option_index: -1,
    }),
  );
});

test("CREATOR-TC06: fractional selection is rejected", (t) => {
  const fixture = createFixture(t);

  expectInvalidCreation(
    fixture,
    makeInput({
      creator_selected_option_index: 0.5,
    }),
  );
});

test("CREATOR-TC07: string selection is rejected", (t) => {
  const fixture = createFixture(t);

  expectInvalidCreation(
    fixture,
    makeInput({
      creator_selected_option_index: "0",
    }),
  );
});

test("CREATOR-TC08: choice without answer options is rejected", (t) => {
  const fixture = createFixture(t);

  expectInvalidCreation(
    fixture,
    makeInput({
      options: undefined,
      creator_selected_option_index: 0,
    }),
  );
});

test("CREATOR-TC09: invalid creator choice rolls back direct repository writes", (t) => {
  const fixture = createFixture(t);

  // Bypass service validation to verify transaction safety.
  assert.throws(
    () =>
      fixture.repository.createBet({
        id: "invalid-bet",
        creator_id: 17,
        join_code: "BADCREATORCHOICE",
        title: "Invalid Repository Input",
        description: "",
        visibility: "private",
        max_participants: 3,
        options: ["Yes", "No"],
        creator_selected_option_index: 5,
      }),
    RangeError,
  );

  assert.equal(fixture.count("bets"), 0);
  assert.equal(fixture.count("bet_options"), 0);
  assert.equal(fixture.count("bet_participants"), 0);
});

test("CREATOR-TC10: creator choice qualifies for winner matching", (t) => {
  const fixture = createFixture(t);

  const bet = fixture.service.createBet(
    makeInput({
      creator_selected_option_index: 1,
    }),
    17,
  );

  const selectedOption = fixture.database
    .prepare(
      `
      SELECT o.id
      FROM bet_options AS o
      JOIN bet_participants AS bp
        ON bp.selected_option_id = o.id
       AND bp.bet_id = o.bet_id
      WHERE bp.bet_id = ?
        AND bp.user_id = ?
        AND o.label = 'No'
    `,
    )
    .get(bet.id, 17);

  assert.ok(selectedOption);

  // Use the same option comparison used by winner retrieval.
  const winningParticipants = fixture.database
    .prepare(
      `
      SELECT user_id
      FROM bet_participants
      WHERE bet_id = ?
        AND selected_option_id = ?
    `,
    )
    .all(bet.id, selectedOption.id);

  assert.deepEqual(winningParticipants, [{ user_id: 17 }]);
});

test("CREATOR-TC11: creator selection preserves database integrity", (t) => {
  const fixture = createFixture(t);

  fixture.service.createBet(
    makeInput({
      creator_selected_option_index: 0,
    }),
    17,
  );

  const integrity = fixture.database.prepare("PRAGMA integrity_check").get();

  assert.equal(integrity.integrity_check, "ok");

  const violations = fixture.database.prepare("PRAGMA foreign_key_check").all();

  assert.deepEqual(violations, []);
});
