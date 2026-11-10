import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import Database from "better-sqlite3";
import request from "supertest";

import { createApp } from "../../src/createApp.js";
import { createBetHistoryRepository } from "../../src/repositories/createBetHistoryRepository.js";
import { createBetParticipationRepository } from "../../src/repositories/createBetParticipationRepository.js";
import { createBetRepository } from "../../src/repositories/createBetRepository.js";
import { createBetHistoryService } from "../../src/services/createBetHistoryService.js";
import { createBetParticipationService } from "../../src/services/createBetParticipationService.js";
import { createBetService } from "../../src/services/createBetService.js";

/**
 * Load the relevant production migration from the project.
 */
function migrationSql(name) {
  return readFileSync(
    new URL(`../../src/data/migrations/${name}`, import.meta.url),
    "utf8",
  );
}

/**
 * Create an isolated database using the production bet schema.
 *
 * Migration 006 rebuilds the bets table and must run with
 * foreign keys disabled outside the transaction.
 */
function createDatabase() {
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
        assert.deepEqual(database.pragma("foreign_key_check"), []);
      })();
    } finally {
      database.pragma("foreign_keys = ON");
    }

    const insert = database.prepare(`
      INSERT INTO users (username, email, passwordHash)
      VALUES (?, ?, ?)
    `);

    insert.run("creator", "creator@test.local", "test-hash");
    insert.run("participant", "participant@test.local", "test-hash");
    insert.run("outsider", "outsider@test.local", "test-hash");

    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

/**
 * Construct the real Bet services against one isolated database.
 * Test-only session headers replace login, not authorization logic.
 */
function setup() {
  const database = createDatabase();

  const betRepository = createBetRepository(database);
  const historyRepository = createBetHistoryRepository(database);
  const participationRepository = createBetParticipationRepository(database);

  const betService = {
    ...createBetService({ betRepository }),
    ...createBetParticipationService({ participationRepository }),
    ...createBetHistoryService({ historyRepository }),
  };

  const app = createApp({
    authService: {},
    betService,

    sessionMiddleware(req, res, next) {
      const userID = Number(req.get("x-test-user"));

      if ([1, 2, 3].includes(userID)) {
        req.session = { userID };
      }

      next();
    },
  });

  return { app, database };
}

/**
 * Seed a bet with deterministic membership, options, and timestamps.
 *
 * Each participant receives the "Yes" answer. The creator is also
 * stored as a participant, matching the production Create Bet flow.
 */
function seedBet(
  database,
  {
    id,
    creatorID = 1,
    participantIDs = [],
    status = "open",
    visibility = "private",
    createdAt = "2026-11-01T10:00:00.000Z",
  },
) {
  database
    .prepare(
      `
      INSERT INTO bets (
        id, creator_id, title, description,
        join_code, max_participants, visibility, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      id,
      creatorID,
      `History ${id}`,
      "Automated history test",
      `CODE-${id}`,
      3,
      visibility,
      createdAt,
    );

  const yesID = `${id}-yes`;
  const noID = `${id}-no`;

  const insertOption = database.prepare(`
    INSERT INTO bet_options (id, bet_id, label, position)
    VALUES (?, ?, ?, ?)
  `);

  insertOption.run(yesID, id, "Yes", 0);
  insertOption.run(noID, id, "No", 1);

  const insertParticipant = database.prepare(`
    INSERT INTO bet_participants (
      bet_id, user_id, selected_option_id
    )
    VALUES (?, ?, ?)
  `);

  // The creator is always an initial participant.
  insertParticipant.run(id, creatorID, yesID);

  for (const userID of participantIDs) {
    if (userID !== creatorID) {
      insertParticipant.run(id, userID, yesID);
    }
  }

  if (status === "locked" || status === "resolved") {
    database
      .prepare(
        `
        UPDATE bets
        SET status = 'locked',
            locked_at = '2026-11-09T10:00:00.000Z'
        WHERE id = ?
      `,
      )
      .run(id);
  }

  if (status === "resolved") {
    database
      .prepare(
        `
        UPDATE bets
        SET status = 'resolved',
            winning_option_id = ?,
            resolved_at = '2026-11-09T11:00:00.000Z'
        WHERE id = ?
      `,
      )
      .run(yesID, id);
  }

  return { id, yesID, noID };
}

/**
 * Request history with a test user's authenticated session.
 */
function getHistory(app, userID = 1, query = "") {
  return request(app)
    .get(`/api/bets/history${query}`)
    .set("x-test-user", String(userID));
}

// TC01: A participant sees a private bet created by another user.
test("C-HIST-TC01: joined private bet appears in participant history", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  const bet = seedBet(database, {
    id: "joined-private",
    creatorID: 2,
    participantIDs: [1],
  });

  const response = await getHistory(app, 1);

  assert.equal(response.status, 200);
  assert.equal(response.body.bets.length, 1);

  const entry = response.body.bets[0];

  assert.equal(entry.id, bet.id);
  assert.equal(entry.creator_id, 2);
  assert.equal(entry.is_creator, false);
  assert.equal(entry.selected_option_id, bet.yesID);
  assert.equal(entry.selected_option_label, "Yes");
  assert.equal(entry.current_participants, 2);

  // Another creator's private join code must not be exposed.
  assert.equal(Object.hasOwn(entry, "join_code"), false);
});

// TC02: Membership determines history access, not public visibility.
test("C-HIST-TC02: unrelated bets are excluded and anonymous access is rejected", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  seedBet(database, { id: "my-private", creatorID: 1 });

  seedBet(database, {
    id: "unrelated-private",
    creatorID: 2,
  });

  seedBet(database, {
    id: "unrelated-public",
    creatorID: 3,
    visibility: "public",
  });

  const response = await getHistory(app, 1);

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.bets.map((bet) => bet.id),
    ["my-private"],
  );

  const anonymous = await request(app).get("/api/bets/history");

  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.body.error.code, "AUTH_REQUIRED");
});

// TC03: History must have deterministic newest-first ordering.
test("C-HIST-TC03: history orders by creation time and bet ID", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  const timestamp = "2026-11-09T10:00:00.000Z";

  seedBet(database, {
    id: "bet-old",
    createdAt: "2026-11-01T10:00:00.000Z",
  });

  for (const id of ["bet-a", "bet-c", "bet-b"]) {
    seedBet(database, { id, createdAt: timestamp });
  }

  const response = await getHistory(app);

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.bets.map((bet) => bet.id),
    ["bet-c", "bet-b", "bet-a", "bet-old"],
  );
});

// TC04: Filtering must return only the requested lifecycle state.
test("C-HIST-TC04: status filtering validates query values", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  seedBet(database, { id: "open-bet", status: "open" });
  seedBet(database, { id: "locked-bet", status: "locked" });
  seedBet(database, { id: "resolved-bet", status: "resolved" });

  const response = await getHistory(app, 1, "?status=resolved");

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.bets.map((bet) => bet.id),
    ["resolved-bet"],
  );

  const invalid = await getHistory(app, 1, "?status=finished");

  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, "VALIDATION_ERROR");
});

// TC05: Resolve and History must agree on the stored outcome.
test("C-HIST-TC05: resolved history preserves outcome and timestamp", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  const bet = seedBet(database, {
    id: "resolved-history",
    creatorID: 1,
    participantIDs: [2],
    status: "locked",
  });

  // Resolve through the real application endpoint.
  const resolved = await request(app)
    .post(`/api/bets/${bet.id}/resolve`)
    .set("x-test-user", "1")
    .send({ winning_option_id: bet.yesID });

  assert.equal(resolved.status, 200);

  const history = await getHistory(app, 2, "?status=resolved");

  assert.equal(history.status, 200);
  assert.equal(history.body.bets.length, 1);

  const entry = history.body.bets[0];

  assert.equal(entry.status, "resolved");
  assert.equal(entry.winning_option_id, bet.yesID);
  assert.equal(entry.winning_option_label, "Yes");
  assert.equal(entry.is_winner, true);
  assert.ok(entry.resolved_at);

  // A second resolution must not replace the original result.
  const repeated = await request(app)
    .post(`/api/bets/${bet.id}/resolve`)
    .set("x-test-user", "1")
    .send({ winning_option_id: bet.noID });

  assert.equal(repeated.status, 409);
  assert.equal(repeated.body.error.code, "BET_ALREADY_RESOLVED");

  const after = await getHistory(app, 2, "?status=resolved");
  const finalEntry = after.body.bets[0];

  assert.equal(finalEntry.winning_option_id, entry.winning_option_id);
  assert.equal(finalEntry.resolved_at, entry.resolved_at);

  // Verify HTTP history agrees with persistent SQLite state.
  const stored = database
    .prepare(
      `
      SELECT winning_option_id, resolved_at
      FROM bets
      WHERE id = ?
    `,
    )
    .get(bet.id);

  assert.equal(stored.winning_option_id, entry.winning_option_id);
  assert.equal(stored.resolved_at, entry.resolved_at);
  assert.equal(database.pragma("integrity_check", { simple: true }), "ok");
  assert.deepEqual(database.pragma("foreign_key_check"), []);
});
