
import assert from "node:assert/strict";
import test from "node:test";

import request from "supertest";

import { createApp } from "../../src/createApp.js";
import { createUserRepository } from "../../src/repositories/createUserRepository.js";
import { createBetRepository } from "../../src/repositories/createBetRepository.js";
import { createAuthService } from "../../src/services/createAuthService.js";
import { createBetService } from "../../src/services/createBetService.js";

import { createSecurityTestDatabase } from "../helpers/securityTestDatabase.js";
import { createTestSessionMiddleware } from "../helpers/testSession.js";

// Sprint 4 - Member B
// SOC 2 - Authorization and Access Control
// Risk 1 - Unauthorized Private Bet Visibility

function createTestContext() {
  // Use an isolated SQLite database with the real bet schema.
  const database = createSecurityTestDatabase();

  const userRepository = createUserRepository(database);
  const betRepository = createBetRepository(database);

  // Deterministic password behavior for automated tests.
  const passwordService = {
    async hashPassword(password) {
      return `hashed:${password}`;
    },

    async verifyPassword(passwordHash, password) {
      return passwordHash === `hashed:${password}`;
    },
  };

  const authService = createAuthService({
    userRepository,
    passwordService,
  });

  const betService = createBetService({
    betRepository,
  });

  const { middleware: sessionMiddleware } =
    createTestSessionMiddleware(database);

  const app = createApp({
    authService,
    sessionMiddleware,
    betService,
  });

  return {
    app,
    database,
    userRepository,
  };
}

// Create a user and return an authenticated Supertest agent.
async function createAuthenticatedAgent(context, username, email) {
  const password = "ExamplePassword123!";

  context.userRepository.createUser({
    username,
    email,
    passwordHash: `hashed:${password}`,
  });

  const agent = request.agent(context.app);

  await agent
    .post("/api/auth/login")
    .send({
      email,
      password,
    })
    .expect(200);

  return agent;
}

// Create a bet using the real Create Bet API.
async function createTestBet(agent, title, visibility) {
  const response = await agent
    .post("/api/bets")
    .send({
      title,
      description: "Sprint 4 SOC 2 authorization test.",
      visibility,
      max_participants: 5,
    })
    .expect(201);

  assert.ok(response.body.bet);
  return response.body.bet;
}

// B-R01-T01: Creator can retrieve their private bet.
test("B-R01-T01: Account A can retrieve its private bet", async () => {
  const context = createTestContext();

  try {
    const accountA = await createAuthenticatedAgent(
      context,
      "AccountA",
      "accounta@example.com",
    );

    const privateBet = await createTestBet(
      accountA,
      "Account A Private Bet",
      "private",
    );

    const response = await accountA.get("/api/bets").expect(200);

    assert.ok(Array.isArray(response.body.bets));

    assert.ok(
      response.body.bets.some(
        (bet) => bet.id === privateBet.id,
      ),
      "Creator should be able to retrieve their private bet.",
    );
  } finally {
    context.database.close();
  }
});

// B-R01-T02: Another account cannot retrieve the creator's private bet.
test("B-R01-T02: Account B cannot retrieve Account A private bet", async () => {
  const context = createTestContext();

  try {
    const accountA = await createAuthenticatedAgent(
      context,
      "AccountA",
      "accounta@example.com",
    );

    const accountB = await createAuthenticatedAgent(
      context,
      "AccountB",
      "accountb@example.com",
    );

    const privateBet = await createTestBet(
      accountA,
      "Account A Private Bet",
      "private",
    );

    const response = await accountB.get("/api/bets").expect(200);

    assert.ok(Array.isArray(response.body.bets));

    assert.ok(
      !response.body.bets.some(
        (bet) => bet.id === privateBet.id,
      ),
      "Account B must not retrieve Account A private bet.",
    );
  } finally {
    context.database.close();
  }
});

// B-R01-T03: Public listing must exclude private bets.
test("B-R01-T03: Public listing excludes private bets", async () => {
  const context = createTestContext();

  try {
    const accountA = await createAuthenticatedAgent(
      context,
      "AccountA",
      "accounta@example.com",
    );

    const accountB = await createAuthenticatedAgent(
      context,
      "AccountB",
      "accountb@example.com",
    );

    const publicBet = await createTestBet(
      accountA,
      "Account A Public Bet",
      "public",
    );

    const privateBet = await createTestBet(
      accountA,
      "Account A Private Bet",
      "private",
    );

    const response = await accountB
      .get("/api/bets/public")
      .expect(200);

    assert.ok(Array.isArray(response.body.bets));

    assert.ok(
      response.body.bets.some(
        (bet) => bet.id === publicBet.id,
      ),
      "Public bets should appear in public listings.",
    );

    assert.ok(
      !response.body.bets.some(
        (bet) => bet.id === privateBet.id,
      ),
      "Private bets must not appear in public listings.",
    );

    assert.ok(
      response.body.bets.every(
        (bet) => bet.visibility === "public",
      ),
    );
  } finally {
    context.database.close();
  }
});

// B-R01-T04: Public listing must not expose join codes.
test("B-R01-T04: Public listing does not expose join codes", async () => {
  const context = createTestContext();

  try {
    const accountA = await createAuthenticatedAgent(
      context,
      "AccountA",
      "accounta@example.com",
    );

    const accountB = await createAuthenticatedAgent(
      context,
      "AccountB",
      "accountb@example.com",
    );

    const publicBet = await createTestBet(
      accountA,
      "Account A Public Bet",
      "public",
    );

    const privateBet = await createTestBet(
      accountA,
      "Account A Private Bet",
      "private",
    );

    const response = await accountB
      .get("/api/bets/public")
      .expect(200);

    assert.ok(response.body.bets.length > 0);

    // No publicly returned bet may contain a join code.
    for (const bet of response.body.bets) {
      assert.equal(
        Object.hasOwn(bet, "join_code"),
        false,
        "Public listing must not expose join codes.",
      );
    }

    // Neither generated code should appear anywhere in the response.
    const responseText = JSON.stringify(response.body);

    assert.equal(
      responseText.includes(publicBet.join_code),
      false,
    );

    assert.equal(
      responseText.includes(privateBet.join_code),
      false,
    );
  } finally {
    context.database.close();
  }
});