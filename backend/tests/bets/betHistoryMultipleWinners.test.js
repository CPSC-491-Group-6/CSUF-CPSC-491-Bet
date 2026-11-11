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
 * Load the production SQL migrations.
 */
function migrationSql(name) {
  return readFileSync(
    new URL(`../../src/data/migrations/${name}`, import.meta.url),
    "utf8",
  );
}

/**
 * Create an isolated SQLite database using the application's
 * existing schema and outcome migration.
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

    // Migration 006 rebuilds the bets table.
    database.pragma("foreign_keys = OFF");

    try {
      database.transaction(() => {
        database.exec(migrationSql("006_replace_outcome_user_id.sql"));

        assert.deepEqual(database.pragma("foreign_key_check"), []);
      })();
    } finally {
      database.pragma("foreign_keys = ON");
    }

    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

/**
 * Register one deterministic test-only account and return its ID.
 */
function createTestUser(database, username) {
  const result = database
    .prepare(
      `
      INSERT INTO users (username, email, passwordHash)
      VALUES (?, ?, ?)
    `,
    )
    .run(username, `${username}@test.local`, "test-hash");

  return Number(result.lastInsertRowid);
}

/**
 * Build the real Bet services and HTTP routes.
 *
 * Authentication is simulated through a test-only session
 * middleware, while production authorization logic remains active.
 */
function createFixture() {
  const database = createTestDatabase();

  const creatorID = createTestUser(database, "winnercreator");
  const secondWinnerID = createTestUser(database, "secondwinner");
  const losingParticipantID = createTestUser(database, "losingparticipant");

  const validUserIDs = new Set([
    creatorID,
    secondWinnerID,
    losingParticipantID,
  ]);

  const betService = {
    ...createBetService({
      betRepository: createBetRepository(database),
    }),
    ...createBetParticipationService({
      participationRepository: createBetParticipationRepository(database),
    }),
    ...createBetHistoryService({
      historyRepository: createBetHistoryRepository(database),
    }),
  };

  const app = createApp({
    authService: {},
    betService,

    sessionMiddleware(req, res, next) {
      const userID = Number(req.get("x-test-user"));

      if (validUserIDs.has(userID)) {
        req.session = { userID };
      }

      next();
    },
  });

  return {
    app,
    database,
    creatorID,
    secondWinnerID,
    losingParticipantID,
  };
}

/**
 * Seed one open bet with exactly three participants.
 *
 * Creator: Yes
 * Second participant: Yes
 * Third participant: No
 *
 * The bet is initially open so the application must
 * perform the real Lock and Resolve transitions.
 */
function seedMultiWinnerBet(fixture) {
  const { database, creatorID, secondWinnerID, losingParticipantID } = fixture;

  const betID = "history-multiple-winners";
  const yesID = "history-winning-yes";
  const noID = "history-losing-no";

  database
    .prepare(
      `
      INSERT INTO bets (
        id,
        creator_id,
        title,
        description,
        join_code,
        max_participants,
        visibility
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      betID,
      creatorID,
      "Multiple Winners Test",
      "Two participants must both win.",
      "MULTIWINTEST",
      3,
      "private",
    );

  const insertOption = database.prepare(`
    INSERT INTO bet_options (id, bet_id, label, position)
    VALUES (?, ?, ?, ?)
  `);

  insertOption.run(yesID, betID, "Yes", 0);
  insertOption.run(noID, betID, "No", 1);

  const insertParticipant = database.prepare(`
    INSERT INTO bet_participants (
      bet_id,
      user_id,
      selected_option_id
    )
    VALUES (?, ?, ?)
  `);

  insertParticipant.run(betID, creatorID, yesID);
  insertParticipant.run(betID, secondWinnerID, yesID);
  insertParticipant.run(betID, losingParticipantID, noID);

  return { betID, yesID, noID };
}

/**
 * Read history through the authenticated HTTP endpoint.
 */
async function getHistoryEntry(app, userID, betID) {
  const response = await request(app)
    .get("/api/bets/history?status=resolved")
    .set("x-test-user", String(userID));

  assert.equal(response.status, 200);
  assert.equal(response.body.bets.length, 1);

  const entry = response.body.bets[0];
  assert.equal(entry.id, betID);

  return entry;
}

/**
 * TC06: Multiple participants selecting the same outcome
 * are equally recognized as winners, without tie-breaking.
 */
test("C-HIST-TC06: multiple participants win the same resolved outcome", async (context) => {
  const fixture = createFixture();

  context.after(() => fixture.database.close());

  const { app, database, creatorID, secondWinnerID, losingParticipantID } =
    fixture;

  const { betID, yesID, noID } = seedMultiWinnerBet(fixture);

  // Step 1: Confirm the bet begins in the open state.
  const initial = database
    .prepare(
      `
      SELECT status, winning_option_id, resolved_at
      FROM bets
      WHERE id = ?
    `,
    )
    .get(betID);

  assert.equal(initial.status, "open");
  assert.equal(initial.winning_option_id, null);
  assert.equal(initial.resolved_at, null);

  // Step 2: Lock through the real creator-only HTTP endpoint.
  const locked = await request(app)
    .post(`/api/bets/${betID}/lock`)
    .set("x-test-user", String(creatorID));

  assert.equal(locked.status, 200);
  assert.equal(locked.body.bet.status, "locked");

  // Step 3: Resolve with Yes as the winning outcome.
  const resolved = await request(app)
    .post(`/api/bets/${betID}/resolve`)
    .set("x-test-user", String(creatorID))
    .send({ winning_option_id: yesID });

  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.bet.status, "resolved");
  assert.equal(resolved.body.bet.winning_option_id, yesID);
  assert.ok(resolved.body.bet.resolved_at);

  // Step 4: Both matching participants must be returned
  // as winners. There must be no single-winner selection.
  assert.deepEqual(resolved.body.winners, [
    {
      user_id: creatorID,
      selected_option_id: yesID,
    },
    {
      user_id: secondWinnerID,
      selected_option_id: yesID,
    },
  ]);

  // Step 5: Independently read each user's resolved history.
  const creatorHistory = await getHistoryEntry(app, creatorID, betID);

  const secondWinnerHistory = await getHistoryEntry(app, secondWinnerID, betID);

  const loserHistory = await getHistoryEntry(app, losingParticipantID, betID);

  assert.equal(creatorHistory.is_winner, true);
  assert.equal(secondWinnerHistory.is_winner, true);
  assert.equal(loserHistory.is_winner, false);

  assert.equal(creatorHistory.selected_option_id, yesID);
  assert.equal(secondWinnerHistory.selected_option_id, yesID);
  assert.equal(loserHistory.selected_option_id, noID);

  // All three histories reference the same final outcome.
  for (const entry of [creatorHistory, secondWinnerHistory, loserHistory]) {
    assert.equal(entry.winning_option_id, yesID);
    assert.equal(entry.status, "resolved");
    assert.equal(entry.resolved_at, resolved.body.bet.resolved_at);
  }

  // Step 6: Verify winner identities directly in SQLite.
  const persistedWinners = database
    .prepare(
      `
      SELECT bp.user_id
      FROM bet_participants AS bp
      JOIN bets AS b ON b.id = bp.bet_id
      WHERE b.id = ?
        AND b.status = 'resolved'
        AND bp.selected_option_id = b.winning_option_id
      ORDER BY bp.user_id
    `,
    )
    .all(betID)
    .map((row) => row.user_id);

  assert.deepEqual(persistedWinners, [creatorID, secondWinnerID]);

  // Step 7: Repeated resolution cannot alter the result.
  const repeated = await request(app)
    .post(`/api/bets/${betID}/resolve`)
    .set("x-test-user", String(creatorID))
    .send({ winning_option_id: noID });

  assert.equal(repeated.status, 409);
  assert.equal(repeated.body.error.code, "BET_ALREADY_RESOLVED");

  const stored = database
    .prepare(
      `
      SELECT status, winning_option_id, resolved_at
      FROM bets
      WHERE id = ?
    `,
    )
    .get(betID);

  assert.equal(stored.status, "resolved");
  assert.equal(stored.winning_option_id, yesID);
  assert.equal(stored.resolved_at, resolved.body.bet.resolved_at);

  // Step 8: Confirm SQLite remains structurally valid.
  assert.equal(database.pragma("integrity_check", { simple: true }), "ok");

  assert.deepEqual(database.pragma("foreign_key_check"), []);
});
