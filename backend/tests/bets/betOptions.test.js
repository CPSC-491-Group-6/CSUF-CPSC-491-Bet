import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

import { createApp } from "../../src/createApp.js";
import { createBetRepository } from "../../src/repositories/createBetRepository.js";
import { createBetParticipationRepository } from "../../src/repositories/createBetParticipationRepository.js";
import { createBetService } from "../../src/services/createBetService.js";
import { createBetParticipationService } from "../../src/services/createBetParticipationService.js";

import { createBetTestDatabase } from "../helpers/betStateTestUtils.js";
import { createCreatorUser, createParticipantUser } from "../fixtures/users.js";

/**
 * SCRUM-735 / C-TEST-08
 *
 * Verify that Create Bet persists selectable answer options and
 * supplies the data required by Join Bet and Resolve Bet.
 *
 * Each test uses an isolated SQLite database with the application's
 * existing migrations and real backend services.
 */

/**
 * Construct an authenticated Express test application.
 *
 * The test-only session middleware matches the established Bet API
 * testing pattern. It does not sign or create production sessions.
 */
function setup(context) {
  const database = createBetTestDatabase();
  context.after(() => database.close());

  const creator = createCreatorUser(database);
  const participant = createParticipantUser(database);

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
    sessionMiddleware(req, res, next) {
      const userID = Number(req.get("x-test-user"));

      if (userID === creator.userID || userID === participant.userID) {
        req.session = { userID };
      }

      next();
    },
  });

  return {
    app,
    database,
    creator,
    participant,
  };
}

/**
 * Send an authenticated Create Bet request.
 *
 * Default fields match the existing Create Bet contract.
 */
function createBet(fixture, values = {}, userID = fixture.creator.userID) {
  return request(fixture.app)
    .post("/api/bets")
    .set("x-test-user", String(userID))
    .send({
      title: "SCRUM-735 Answer Options Test",
      description: "Testing selectable bet outcomes.",
      max_participants: 3,
      visibility: "private",
      ...values,
    });
}

/**
 * Retrieve one bet through the actual HTTP endpoint.
 */
function getBet(fixture, betID, userID = fixture.creator.userID) {
  return request(fixture.app)
    .get(`/api/bets/${betID}`)
    .set("x-test-user", String(userID));
}

/**
 * Read stored answer options independently of the API response.
 *
 * This proves that option records were actually persisted in SQLite.
 */
function readOptions(database, betID) {
  return database
    .prepare(
      `
      SELECT id, bet_id, label, position
      FROM bet_options
      WHERE bet_id = ?
      ORDER BY position, id
      `,
    )
    .all(betID);
}

/**
 * Count rows for rollback and failed-validation assertions.
 *
 * The table names are fixed constants controlled by these tests.
 */
function countRows(database, tableName) {
  return database.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get()
    .count;
}

/**
 * Capture all records affected by Create Bet.
 */
function snapshotCounts(database) {
  return {
    bets: countRows(database, "bets"),
    options: countRows(database, "bet_options"),
    participants: countRows(database, "bet_participants"),
  };
}

/**
 * Verify a standard structured validation failure.
 */
function assertValidationError(response) {
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "VALIDATION_ERROR");
}

/**
 * C-TEST-08-TC25
 *
 * Valid answer options receive generated identifiers and persist
 * in the order submitted by the creator.
 */
test("C-TEST-08-TC25: Create Bet persists ordered answer options", async (context) => {
  const fixture = setup(context);

  const labels = ["Team A wins", "Team B wins", "Draw"];

  const response = await createBet(fixture, {
    options: labels,
  });

  assert.equal(response.status, 201);

  const bet = response.body.bet;

  assert.equal(bet.status, "open");
  assert.equal(bet.creator_id, fixture.creator.userID);
  assert.equal(bet.current_participants, 1);

  const storedOptions = readOptions(fixture.database, bet.id);

  assert.equal(storedOptions.length, 3);

  assert.deepEqual(
    storedOptions.map((option) => option.label),
    labels,
  );

  assert.deepEqual(
    storedOptions.map((option) => option.position),
    [0, 1, 2],
  );

  assert.equal(new Set(storedOptions.map((option) => option.id)).size, 3);

  for (const option of storedOptions) {
    assert.match(
      option.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    assert.equal(option.bet_id, bet.id);
  }

  assert.deepEqual(fixture.database.pragma("foreign_key_check"), []);
});

/**
 * C-TEST-08-TC26
 *
 * Bet Detail must return stored options so the Resolve frontend
 * can display the available outcomes.
 */
test("C-TEST-08-TC26: Bet Detail returns persisted answer options", async (context) => {
  const fixture = setup(context);

  const created = await createBet(fixture, {
    options: ["Yes", "No"],
  });

  assert.equal(created.status, 201);

  const betID = created.body.bet.id;

  const detail = await getBet(fixture, betID);

  assert.equal(detail.status, 200);
  assert.equal(detail.body.bet.id, betID);

  const options = detail.body.bet.options;

  assert.ok(Array.isArray(options));
  assert.equal(options.length, 2);

  assert.deepEqual(
    options.map((option) => option.label),
    ["Yes", "No"],
  );

  assert.deepEqual(
    options.map((option) => option.position),
    [0, 1],
  );

  assert.deepEqual(
    options.map((option) => option.id),
    readOptions(fixture.database, betID).map((option) => option.id),
  );
});

/**
 * C-TEST-08-TC27
 *
 * Duplicate labels, including case-insensitive and whitespace
 * variants, must be rejected before writing database records.
 */
test("C-TEST-08-TC27: duplicate answer labels are rejected", async (context) => {
  const fixture = setup(context);

  const originalCounts = snapshotCounts(fixture.database);

  for (const options of [
    ["Yes", "Yes"],
    ["Yes", "yes"],
    [" Yes ", "YES"],
  ]) {
    const response = await createBet(fixture, {
      options,
    });

    assertValidationError(response);

    assert.deepEqual(snapshotCounts(fixture.database), originalCounts);
  }
});

/**
 * C-TEST-08-TC28
 *
 * When options are supplied, the accepted range is 2 through 20.
 */
test("C-TEST-08-TC28: invalid option counts are rejected", async (context) => {
  const fixture = setup(context);

  const originalCounts = snapshotCounts(fixture.database);

  for (const options of [
    [],
    ["Only one"],
    Array.from({ length: 21 }, (_, index) => `Option ${index + 1}`),
  ]) {
    const response = await createBet(fixture, {
      options,
    });

    assertValidationError(response);

    assert.deepEqual(snapshotCounts(fixture.database), originalCounts);
  }
});

/**
 * C-TEST-08-TC29
 *
 * Blank, oversized, and non-string option labels are invalid.
 */
test("C-TEST-08-TC29: invalid answer labels are rejected without writes", async (context) => {
  const fixture = setup(context);

  const originalCounts = snapshotCounts(fixture.database);

  for (const options of [
    ["", "No"],
    ["   ", "No"],
    ["Y".repeat(151), "No"],
    ["Yes", 123],
    ["Yes", null],
  ]) {
    const response = await createBet(fixture, {
      options,
    });

    assertValidationError(response);

    assert.deepEqual(snapshotCounts(fixture.database), originalCounts);
  }
});

/**
 * C-TEST-08-TC30
 *
 * Legacy Create Bet requests without an options field must
 * remain valid for backward compatibility.
 */
test("C-TEST-08-TC30: Create Bet remains compatible without options", async (context) => {
  const fixture = setup(context);

  const response = await createBet(fixture);

  assert.equal(response.status, 201);

  const betID = response.body.bet.id;

  assert.deepEqual(readOptions(fixture.database, betID), []);

  const detail = await getBet(fixture, betID);

  assert.equal(detail.status, 200);
  assert.deepEqual(detail.body.bet.options, []);

  assert.equal(response.body.bet.current_participants, 1);
});

/**
 * C-TEST-08-TC31
 *
 * Private options must not bypass existing Bet Detail access rules.
 * Public bet details can expose selectable options but must not
 * expose their creator's join code to other users.
 */
test("C-TEST-08-TC31: option retrieval preserves bet access restrictions", async (context) => {
  const fixture = setup(context);

  const privateCreation = await createBet(fixture, {
    visibility: "private",
    options: ["Private A", "Private B"],
  });

  assert.equal(privateCreation.status, 201);

  const privateBet = privateCreation.body.bet;

  const forbidden = await getBet(
    fixture,
    privateBet.id,
    fixture.participant.userID,
  );

  assert.equal(forbidden.status, 404);
  assert.equal(forbidden.body.error.code, "BET_NOT_FOUND");

  const publicCreation = await createBet(fixture, {
    visibility: "public",
    options: ["Public A", "Public B"],
  });

  assert.equal(publicCreation.status, 201);

  const publicBet = publicCreation.body.bet;

  const allowed = await getBet(
    fixture,
    publicBet.id,
    fixture.participant.userID,
  );

  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.bet.id, publicBet.id);

  assert.deepEqual(
    allowed.body.bet.options.map((option) => option.label),
    ["Public A", "Public B"],
  );

  assert.equal(Object.hasOwn(allowed.body.bet, "join_code"), false);

  // Even public bet details require an authenticated session.
  const unauthenticated = await request(fixture.app).get(
    `/api/bets/${publicBet.id}`,
  );

  assert.equal(unauthenticated.status, 401);
});

/**
 * C-TEST-08-TC32
 *
 * Inject a failure during the second option insertion.
 *
 * SQLite must roll back the bet row, creator membership, and
 * previously inserted answer option.
 */
test("C-TEST-08-TC32: failed option insertion rolls back complete bet creation", async (context) => {
  const fixture = setup(context);

  const originalCounts = snapshotCounts(fixture.database);

  // This trigger exists only inside the test's isolated database.
  fixture.database.exec(`
    CREATE TEMP TRIGGER fail_second_bet_option
    BEFORE INSERT ON main.bet_options
    WHEN NEW.position = 1
    BEGIN
      SELECT RAISE(ABORT, 'injected test option failure');
    END;
  `);

  const response = await createBet(fixture, {
    options: ["First", "Second"],
  });

  // The existing application error handler must not expose SQL internals.
  assert.equal(response.status, 500);

  assert.deepEqual(snapshotCounts(fixture.database), originalCounts);

  assert.deepEqual(fixture.database.pragma("foreign_key_check"), []);
});

/**
 * C-TEST-08-TC33
 *
 * Verify the full backend workflow through real HTTP endpoints:
 *
 * Create -> Get Options -> Join -> Lock -> Resolve.
 *
 * The winning participant must match the previously stored
 * selected option.
 */
test("C-TEST-08-TC33: Create Join Lock Resolve workflow preserves outcome data", async (context) => {
  const fixture = setup(context);

  // Creator establishes a bet with two possible outcomes.
  const created = await createBet(fixture, {
    options: ["Outcome A", "Outcome B"],
  });

  assert.equal(created.status, 201);

  const bet = created.body.bet;

  // Retrieve the server-generated option identifiers.
  const detail = await getBet(fixture, bet.id);

  assert.equal(detail.status, 200);
  assert.equal(detail.body.bet.options.length, 2);

  const winningOptionID = detail.body.bet.options[0].id;

  // A second user joins the bet and selects the winning option.
  const joined = await request(fixture.app)
    .post("/api/bets/join")
    .set("x-test-user", String(fixture.participant.userID))
    .send({
      join_code: bet.join_code,
      selected_option_id: winningOptionID,
    });

  assert.equal(joined.status, 201);

  // The creator locks the bet against further participation.
  const locked = await request(fixture.app)
    .post(`/api/bets/${bet.id}/lock`)
    .set("x-test-user", String(fixture.creator.userID));

  assert.equal(locked.status, 200);
  assert.equal(locked.body.bet.status, "locked");

  // The creator selects the final winning outcome.
  const resolved = await request(fixture.app)
    .post(`/api/bets/${bet.id}/resolve`)
    .set("x-test-user", String(fixture.creator.userID))
    .send({
      winning_option_id: winningOptionID,
    });

  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.bet.status, "resolved");

  assert.equal(resolved.body.bet.winning_option_id, winningOptionID);

  assert.deepEqual(resolved.body.winners, [
    {
      user_id: fixture.participant.userID,
      selected_option_id: winningOptionID,
    },
  ]);

  // Verify the final result directly against persisted SQLite records.
  const stored = fixture.database
    .prepare(
      `
      SELECT
        status,
        creator_id,
        locked_at,
        resolved_at,
        winning_option_id
      FROM bets
      WHERE id = ?
      `,
    )
    .get(bet.id);

  assert.equal(stored.status, "resolved");
  assert.equal(stored.creator_id, fixture.creator.userID);
  assert.equal(stored.winning_option_id, winningOptionID);
  assert.ok(stored.locked_at);
  assert.ok(stored.resolved_at);

  const membership = fixture.database
    .prepare(
      `
      SELECT selected_option_id
      FROM bet_participants
      WHERE bet_id = ? AND user_id = ?
      `,
    )
    .get(bet.id, fixture.participant.userID);

  assert.equal(membership.selected_option_id, winningOptionID);

  assert.deepEqual(fixture.database.pragma("foreign_key_check"), []);
});
