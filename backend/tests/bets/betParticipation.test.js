import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import Database from "better-sqlite3";
import request from "supertest";

import { createApp } from "../../src/createApp.js";
import { createBetRepository } from "../../src/repositories/createBetRepository.js";
import { createBetParticipationRepository } from "../../src/repositories/createBetParticipationRepository.js";
import { createBetService } from "../../src/services/createBetService.js";
import { createBetParticipationService } from "../../src/services/createBetParticipationService.js";

// Use deterministic IDs and join codes so test results are repeatable.
const BET_ID = "test-bet-one";
const JOIN_CODE = "ABC123DEF456";

const USERS = {
  creator: 1,
  participant: 2,
  other: 3,
};

/**
 * Read a production migration using its repository-relative path.
 */
function migrationSql(name) {
  return readFileSync(
    new URL(`../../src/data/migrations/${name}`, import.meta.url),
    "utf8",
  );
}

/**
 * Initialize an isolated SQLite database with the relevant production
 * bet migrations. The historical user and visibility schema is preserved.
 *
 * Migration 006 rebuilds a referenced table, so foreign-key enforcement
 * must be disabled outside its transaction and restored afterward.
 */
function createTestDatabase() {
  const database = new Database(":memory:");

  try {
    database.pragma("foreign_keys = ON");

    for (const name of [
      "001_initial.sql",
      "002_add_bet_visibility.sql",
      "005_bet_options_and_answers.sql",
    ]) {
      database.exec(migrationSql(name));
    }

    database.pragma("foreign_keys = OFF");

    try {
      database.transaction(() => {
        database.exec(migrationSql("006_replace_outcome_user_id.sql"));

        const violations = database.pragma("foreign_key_check");

        assert.deepEqual(
          violations,
          [],
          "Migration must preserve foreign-key integrity",
        );
      })();
    } finally {
      database.pragma("foreign_keys = ON");
    }

    assert.equal(database.pragma("foreign_keys", { simple: true }), 1);

    assert.equal(database.pragma("integrity_check", { simple: true }), "ok");

    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

/**
 * Create three test users. Real authentication is replaced only by the
 * session middleware stub; the production requireAuth middleware remains.
 */
function seedUsers(database) {
  const insert = database.prepare(`
    INSERT INTO users (username, email, passwordHash)
    VALUES (?, ?, ?)
  `);

  insert.run("creator", "creator@example.test", "test-hash");
  insert.run("participant", "participant@example.test", "test-hash");
  insert.run("other", "other@example.test", "test-hash");
}

/**
 * Create a bet directly in the test database and register its creator
 * as the first participant, matching existing Create Bet behavior.
 */
function seedBet(
  database,
  {
    id = BET_ID,
    code = JOIN_CODE,
    creatorID = USERS.creator,
    capacity = 3,
    status = "open",
  } = {},
) {
  database
    .prepare(
      `
      INSERT INTO bets (
        id,
        creator_id,
        title,
        description,
        join_code,
        max_participants
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      id,
      creatorID,
      "Join and Lock Test Bet",
      "Automated integration test",
      code,
      capacity,
    );

  database
    .prepare(
      `
      INSERT INTO bet_participants (bet_id, user_id)
      VALUES (?, ?)
    `,
    )
    .run(id, creatorID);

  if (status === "locked") {
    database
      .prepare(
        `
        UPDATE bets
        SET status = 'locked',
            locked_at = '2026-11-02T12:00:00.000Z'
        WHERE id = ?
      `,
      )
      .run(id);
  }

  return { id, code, creatorID, capacity };
}

/**
 * Add a creator-defined answer option for a particular bet.
 */
function seedOption(
  database,
  { id = "option-yes", betID = BET_ID, label = "Yes", position = 0 } = {},
) {
  database
    .prepare(
      `
      INSERT INTO bet_options (id, bet_id, label, position)
      VALUES (?, ?, ?, ?)
    `,
    )
    .run(id, betID, label, position);

  return id;
}

/**
 * Create the real Join/Lock services with isolated SQLite repositories
 * and an authenticated test-session adapter.
 */
function setup() {
  const database = createTestDatabase();

  try {
    seedUsers(database);

    const betRepository = createBetRepository(database);

    const participationRepository = createBetParticipationRepository(database);

    const betService = {
      ...createBetService({ betRepository }),
      ...createBetParticipationService({
        participationRepository,
      }),
    };

    const app = createApp({
      authService: {},
      betService,

      // Production requireAuth still checks req.session.userID.
      // The test header only creates a session for known users.
      sessionMiddleware(req, res, next) {
        const userID = Number(req.get("x-test-user"));

        if (Object.values(USERS).includes(userID)) {
          req.session = { userID };
        }

        next();
      },
    });

    return { app, database };
  } catch (error) {
    database.close();
    throw error;
  }
}

/**
 * Submit a Join Bet request with the selected test account.
 */
function joinBet(
  app,
  { code = JOIN_CODE, userID = USERS.participant, selectedOptionID } = {},
) {
  const payload = { join_code: code };

  if (selectedOptionID !== undefined) {
    payload.selected_option_id = selectedOptionID;
  }

  return request(app)
    .post("/api/bets/join")
    .set("x-test-user", String(userID))
    .send(payload);
}

/**
 * Submit a Lock Bet request with the selected test account.
 */
function lockBet(app, { betID = BET_ID, userID = USERS.creator } = {}) {
  return request(app)
    .post(`/api/bets/${betID}/lock`)
    .set("x-test-user", String(userID))
    .send({});
}

/**
 * Count participants in one bet, excluding unrelated test records.
 */
function participantCount(database, betID = BET_ID) {
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
 * Retrieve the current persistent state of a bet.
 */
function getBet(database, betID = BET_ID) {
  return database
    .prepare(
      `
      SELECT id, status, locked_at, winning_option_id
      FROM bets
      WHERE id = ?
    `,
    )
    .get(betID);
}

// ------------------------------------------------------------
// TC01: Valid authenticated join
// ------------------------------------------------------------

test("TC01: valid join persists participant membership", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  seedBet(database);

  const response = await joinBet(app);

  assert.equal(response.status, 201);
  assert.equal(response.body.participation.bet_id, BET_ID);
  assert.equal(response.body.participation.user_id, USERS.participant);
  assert.equal(response.body.participation.current_participants, 2);

  assert.equal(participantCount(database), 2);

  const participant = database
    .prepare(
      `
      SELECT bet_id, user_id, selected_option_id
      FROM bet_participants
      WHERE bet_id = ? AND user_id = ?
    `,
    )
    .get(BET_ID, USERS.participant);

  assert.equal(participant.bet_id, BET_ID);
  assert.equal(participant.user_id, USERS.participant);
  assert.equal(participant.selected_option_id, null);

  assert.equal(getBet(database).status, "open");
});

// ------------------------------------------------------------
// TC02: Invalid join code
// ------------------------------------------------------------

test("TC02: unknown join code returns 404 without writes", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  seedBet(database);

  const before = participantCount(database);

  const response = await joinBet(app, {
    code: "FFFFFFFFFFFF",
  });

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, "BET_NOT_FOUND");

  assert.equal(participantCount(database), before);
  assert.equal(getBet(database).status, "open");
});

// ------------------------------------------------------------
// TC03: Duplicate join
// ------------------------------------------------------------

test("TC03: duplicate join returns 409 without duplicate rows", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  seedBet(database);

  const first = await joinBet(app);
  assert.equal(first.status, 201);

  const second = await joinBet(app);

  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, "ALREADY_JOINED");

  assert.equal(participantCount(database), 2);

  const matches = database
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM bet_participants
      WHERE bet_id = ? AND user_id = ?
    `,
    )
    .get(BET_ID, USERS.participant).count;

  assert.equal(matches, 1);
});

// ------------------------------------------------------------
// TC04: Capacity
// ------------------------------------------------------------

test("TC04: full bet returns 409 without adding participants", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  seedBet(database, { capacity: 2 });

  // Creator already occupies the first slot.
  database
    .prepare(
      `
      INSERT INTO bet_participants (bet_id, user_id)
      VALUES (?, ?)
    `,
    )
    .run(BET_ID, USERS.other);

  assert.equal(participantCount(database), 2);

  const response = await joinBet(app);

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, "BET_FULL");

  assert.equal(participantCount(database), 2);

  const added = database
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM bet_participants
      WHERE bet_id = ? AND user_id = ?
    `,
    )
    .get(BET_ID, USERS.participant).count;

  assert.equal(added, 0);
});

// ------------------------------------------------------------
// TC05: Locked bet rejects joining
// ------------------------------------------------------------

test("TC05: locked bet rejects new participation", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  seedBet(database, { status: "locked" });

  const before = participantCount(database);

  const response = await joinBet(app);

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, "BET_NOT_OPEN");

  assert.equal(participantCount(database), before);
  assert.equal(getBet(database).status, "locked");
});

// ------------------------------------------------------------
// TC06: Unauthorized lock
// ------------------------------------------------------------

test("TC06: non-creator cannot lock another user's bet", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  seedBet(database);

  const response = await lockBet(app, {
    userID: USERS.participant,
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, "NOT_BET_CREATOR");

  const bet = getBet(database);

  assert.equal(bet.status, "open");
  assert.equal(bet.locked_at, null);
  assert.equal(participantCount(database), 1);
});

// ------------------------------------------------------------
// TC07: Valid creator lock
// ------------------------------------------------------------

test("TC07: creator locks bet and persists locked_at", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  seedBet(database);

  const response = await lockBet(app);

  assert.equal(response.status, 200);
  assert.equal(response.body.bet.id, BET_ID);
  assert.equal(response.body.bet.status, "locked");
  assert.ok(response.body.bet.locked_at);

  const bet = getBet(database);

  assert.equal(bet.status, "locked");
  assert.ok(bet.locked_at);
  assert.equal(bet.winning_option_id, null);

  assert.equal(participantCount(database), 1);
});

// ------------------------------------------------------------
// TC08: Duplicate lock
// ------------------------------------------------------------

test("TC08: locking an already locked bet returns 409", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  seedBet(database);

  const first = await lockBet(app);
  assert.equal(first.status, 200);

  const previous = getBet(database);

  const second = await lockBet(app);

  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, "BET_NOT_OPEN");

  assert.deepEqual(getBet(database), previous);
});

// ------------------------------------------------------------
// TC09: Missing authentication
// ------------------------------------------------------------

test("TC09: join and lock require an authenticated session", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  seedBet(database);

  const before = getBet(database);
  const beforeCount = participantCount(database);

  const joinResponse = await request(app)
    .post("/api/bets/join")
    .send({ join_code: JOIN_CODE });

  assert.equal(joinResponse.status, 401);
  assert.equal(joinResponse.body.error.code, "AUTH_REQUIRED");

  const lockResponse = await request(app)
    .post(`/api/bets/${BET_ID}/lock`)
    .send({});

  assert.equal(lockResponse.status, 401);
  assert.equal(lockResponse.body.error.code, "AUTH_REQUIRED");

  assert.equal(participantCount(database), beforeCount);
  assert.deepEqual(getBet(database), before);
});

// ------------------------------------------------------------
// TC10: Selected answer persistence
// ------------------------------------------------------------

test("TC10: valid answer selection persists during join", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  seedBet(database);

  seedOption(database, {
    id: "option-yes",
    label: "Yes",
    position: 0,
  });

  seedOption(database, {
    id: "option-no",
    label: "No",
    position: 1,
  });

  const response = await joinBet(app, {
    selectedOptionID: "option-yes",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.participation.selected_option_id, "option-yes");

  const saved = database
    .prepare(
      `
      SELECT selected_option_id
      FROM bet_participants
      WHERE bet_id = ? AND user_id = ?
    `,
    )
    .get(BET_ID, USERS.participant);

  assert.equal(saved.selected_option_id, "option-yes");
  assert.equal(participantCount(database), 2);
});

// ------------------------------------------------------------
// TC11: Missing required answer
// ------------------------------------------------------------

test("TC11: joining an option-based bet requires an answer", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  seedBet(database);
  seedOption(database);

  const response = await joinBet(app);

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "ANSWER_REQUIRED");

  assert.equal(participantCount(database), 1);
});

// ------------------------------------------------------------
// TC12: Wrong answer option
// ------------------------------------------------------------

test("TC12: option belonging to another bet is rejected", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  seedBet(database);

  // A different bet has its own answer choices.
  seedBet(database, {
    id: "second-bet",
    code: "FED654CBA321",
    capacity: 3,
  });

  seedOption(database, {
    id: "second-bet-option",
    betID: "second-bet",
    label: "Different answer",
  });

  const before = participantCount(database);

  const response = await joinBet(app, {
    selectedOptionID: "second-bet-option",
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "INVALID_OPTION");

  assert.equal(participantCount(database), before);
});

// ------------------------------------------------------------
// TC13: Join code case-insensitivity
// ------------------------------------------------------------

test("TC13: join code matching is case-insensitive", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  seedBet(database);

  const response = await joinBet(app, {
    code: JOIN_CODE.toLowerCase(),
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.participation.bet_id, BET_ID);
  assert.equal(participantCount(database), 2);
});

// ------------------------------------------------------------
// TC14: Missing bet on lock
// ------------------------------------------------------------

test("TC14: locking an unknown bet returns 404", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  seedBet(database);

  const response = await lockBet(app, {
    betID: "nonexistent-bet",
  });

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, "BET_NOT_FOUND");

  assert.equal(getBet(database).status, "open");
});

// ------------------------------------------------------------
// TC15: Final database integrity
// ------------------------------------------------------------

test("TC15: Join and Lock preserve database integrity", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  seedBet(database);

  const joined = await joinBet(app);
  assert.equal(joined.status, 201);

  const locked = await lockBet(app);
  assert.equal(locked.status, 200);

  assert.equal(
    database.pragma("integrity_check", {
      simple: true,
    }),
    "ok",
  );

  assert.deepEqual(database.pragma("foreign_key_check"), []);

  assert.equal(participantCount(database), 2);
  assert.equal(getBet(database).status, "locked");
});
