import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import Database from "better-sqlite3";
import request from "supertest";

import { createApp } from "../../src/createApp.js";
import { createBetRepository } from "../../src/repositories/createBetRepository.js";
import { createBetService } from "../../src/services/createBetService.js";

/** Apply the production migrations to a fresh, in-memory SQLite database. */
function setup() {
  const database = new Database(":memory:");
  database.pragma("foreign_keys = ON");

  for (const name of ["001_initial.sql", "002_add_bet_visibility.sql"]) {
    database.exec(
      readFileSync(
        new URL(`../../src/data/migrations/${name}`, import.meta.url),
        "utf8",
      ),
    );
  }

  const insertUser = database.prepare(`
    INSERT INTO users (username, email, passwordHash) VALUES (?, ?, ?)
  `);
  insertUser.run("owner", "owner@example.test", "dummy-hash");
  insertUser.run("other", "other@example.test", "dummy-hash");
  insertUser.run("third", "third@example.test", "dummy-hash");

  const repository = createBetRepository(database);
  const betService = createBetService({ betRepository: repository });
  const app = createApp({
    authService: {},
    betService,
    // Test-only session stub. Production uses its SQLite-backed session store.
    sessionMiddleware(req, res, next) {
      const userID = Number(req.get("x-test-user"));
      if ([1, 2, 3].includes(userID)) req.session = { userID };
      next();
    },
  });

  return { app, database, repository };
}

/** POST with authenticated user 1 unless otherwise specified by the test. */
function createBet(app, values = {}, user = 1) {
  return request(app)
    .post("/api/bets")
    .set("x-test-user", String(user))
    .send({ title: "Test bet", ...values });
}

test("creation assigns session owner, generates code and counts creator", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  const response = await createBet(app, {
    visibility: "public",
    max_participants: 2,
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.bet.creator_id, 1);
  assert.equal(response.body.bet.visibility, "public");
  assert.equal(response.body.bet.current_participants, 1);
  assert.equal(response.body.bet.status, "open");
  assert.match(response.body.bet.join_code, /^[0-9A-F]{12}$/);
  assert.equal(
    database.prepare("SELECT COUNT(*) AS n FROM bet_participants").get().n,
    1,
  );
});

test("default visibility is private and public listing starts empty", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  const created = await createBet(app);
  assert.equal(created.status, 201);
  assert.equal(created.body.bet.visibility, "private");
  assert.equal(created.body.bet.max_participants, 2);

  const publicList = await request(app)
    .get("/api/bets/public")
    .set("x-test-user", "2");
  assert.equal(publicList.status, 200);
  assert.deepEqual(publicList.body.bets, []);
});

test("invalid or client-controlled fields fail with 400 and no writes", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  for (const invalid of [
    { title: "" },
    { title: "ok", max_participants: 101 },
    { title: "ok", visibility: "unlisted" },
    { title: "ok", creator_id: 2 },
    { title: "ok", join_code: "CHOSEN" },
    { title: "ok", status: "resolved" },
  ]) {
    const response = await request(app)
      .post("/api/bets")
      .set("x-test-user", "1")
      .send(invalid);
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "VALIDATION_ERROR");
  }
  assert.equal(database.prepare("SELECT COUNT(*) AS n FROM bets").get().n, 0);
});

test("My Bets remains owner-scoped; discovery excludes private bets and codes", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  const privateBet = (await createBet(app, { visibility: "private" })).body.bet;
  const publicBet = (await createBet(app, { visibility: "public" }, 2)).body
    .bet;

  const mine = await request(app).get("/api/bets").set("x-test-user", "1");
  assert.equal(mine.status, 200);
  assert.deepEqual(
    mine.body.bets.map((bet) => bet.id),
    [privateBet.id],
  );

  const publicList = await request(app)
    .get("/api/bets/public")
    .set("x-test-user", "1");
  assert.equal(publicList.status, 200);
  assert.deepEqual(
    publicList.body.bets.map((bet) => bet.id),
    [publicBet.id],
  );
  assert.equal(publicList.body.bets[0].current_participants, 1);
  assert.equal(Object.hasOwn(publicList.body.bets[0], "join_code"), false);
});

test("a full public bet stays discoverable with its live participant count", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  const bet = (await createBet(app, { visibility: "public" })).body.bet;
  database
    .prepare("INSERT INTO bet_participants (bet_id, user_id) VALUES (?, ?)")
    .run(bet.id, 2);

  const publicList = await request(app)
    .get("/api/bets/public")
    .set("x-test-user", "3");
  assert.equal(publicList.status, 200);
  assert.equal(publicList.body.bets.length, 1);
  assert.equal(publicList.body.bets[0].current_participants, 2);
  assert.equal(publicList.body.bets[0].max_participants, 2);
});

test("join-code lookup handles private bets, case-insensitivity and live count", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  const bet = (await createBet(app, { max_participants: 2 })).body.bet;
  // Simulate the Join Bet persistence maintained in another workstream.
  database
    .prepare("INSERT INTO bet_participants (bet_id, user_id) VALUES (?, ?)")
    .run(bet.id, 2);

  const response = await request(app)
    .get(`/api/bets/code/${bet.join_code.toLowerCase()}`)
    .set("x-test-user", "3");
  assert.equal(response.status, 200);
  assert.equal(response.body.bet.id, bet.id);
  assert.equal(response.body.bet.status, "open");
  assert.equal(response.body.bet.visibility, "private");
  assert.equal(response.body.bet.current_participants, 2);
  assert.equal(response.body.bet.max_participants, 2);
});

test("join-code lookup validates input and returns 404 for unknown codes", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  const invalid = await request(app)
    .get("/api/bets/code/INVALID%20CODE")
    .set("x-test-user", "1");
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, "VALIDATION_ERROR");

  const missing = await request(app)
    .get("/api/bets/code/MISSINGCODE")
    .set("x-test-user", "1");
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, "BET_NOT_FOUND");
});

test("all Bet API routes preserve existing session authorization", async (t) => {
  const { app, database } = setup();
  t.after(() => database.close());

  for (const { method, path } of [
    { method: "post", path: "/api/bets" },
    { method: "get", path: "/api/bets" },
    { method: "get", path: "/api/bets/public" },
    { method: "get", path: "/api/bets/code/TEST" },
  ]) {
    const response = await request(app)[method](path);
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, "AUTH_REQUIRED");
  }
});

test("visibility migration defaults existing bets to private", (t) => {
  const database = new Database(":memory:");
  t.after(() => database.close());
  database.exec(
    readFileSync(
      new URL("../../src/data/migrations/001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  database
    .prepare(
      "INSERT INTO users (username, email, passwordHash) VALUES (?, ?, ?)",
    )
    .run("legacy", "legacy@example.test", "dummy-hash");
  database
    .prepare(
      "INSERT INTO bets (id, creator_id, title, join_code) VALUES (?, ?, ?, ?)",
    )
    .run("legacy-bet", 1, "Legacy bet", "LEGACYCODE");

  database.exec(
    readFileSync(
      new URL(
        "../../src/data/migrations/002_add_bet_visibility.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(
    database
      .prepare("SELECT visibility FROM bets WHERE id = ?")
      .get("legacy-bet").visibility,
    "private",
  );
});
