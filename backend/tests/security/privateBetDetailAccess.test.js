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
// SOC 2 CC6.3 - Authorization and Access Control
// Risk 2 - Unauthorized Private Bet Detail Access

function createTestContext() {
  const database = createSecurityTestDatabase();

  const userRepository = createUserRepository(database);
  const betRepository = createBetRepository(database);

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

  return { app, database, userRepository };
}

async function createAuthenticatedAgent(context, username, email) {
  const password = "ExamplePassword123!";

  context.userRepository.createUser({
    username,
    email,
    passwordHash: `hashed:${password}`,
  });

  const agent = request.agent(context.app);

  await agent.post("/api/auth/login").send({ email, password }).expect(200);

  return agent;
}

async function createPrivateBet(agent, title) {
  const response = await agent
    .post("/api/bets")
    .send({
      title,
      description: "Private bet authorization test.",
      visibility: "private",
      max_participants: 5,
    })
    .expect(201);

  assert.ok(response.body.bet?.join_code);

  return response.body.bet;
}

// B-R02-T01: Valid private join code permits detail lookup.
test("B-R02-T01: Valid private join code returns bet details", async () => {
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

    const privateBet = await createPrivateBet(
      accountA,
      "Account A Private Bet",
    );

    const response = await accountB
      .get(`/api/bets/code/${privateBet.join_code}`)
      .expect(200);

    assert.equal(response.body.bet.id, privateBet.id);
    assert.equal(response.body.bet.title, privateBet.title);
    assert.equal(response.body.bet.visibility, "private");
  } finally {
    context.database.close();
  }
});

// B-R02-T02: Nonexistent join code must not reveal bet details.
test("B-R02-T02: Nonexistent join code is rejected", async () => {
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

    const privateBet = await createPrivateBet(
      accountA,
      "Account A Private Bet",
    );

    // Valid format, but different from the actual code.
    const invalidCode =
      privateBet.join_code === "ABCDEF123456" ? "123456ABCDEF" : "ABCDEF123456";

    const response = await accountB
      .get(`/api/bets/code/${invalidCode}`)
      .expect(404);

    assert.equal(response.body.error.code, "BET_NOT_FOUND");
    assert.equal(response.body.bet, undefined);
  } finally {
    context.database.close();
  }
});

// B-R02-T03: Malformed join codes must be rejected.
test("B-R02-T03: Malformed join code is rejected", async () => {
  const context = createTestContext();

  try {
    const accountB = await createAuthenticatedAgent(
      context,
      "AccountB",
      "accountb@example.com",
    );

    const response = await accountB
      .get("/api/bets/code/INVALID%24CODE")
      .expect(400);

    assert.equal(response.body.error.code, "VALIDATION_ERROR");
    assert.equal(response.body.bet, undefined);
  } finally {
    context.database.close();
  }
});

// B-R02-T04: A valid code must return only its associated bet.
test("B-R02-T04: Join code retrieves only its matching bet", async () => {
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

    const privateBetA = await createPrivateBet(accountA, "Private Bet A");

    const privateBetB = await createPrivateBet(accountA, "Private Bet B");

    const response = await accountB
      .get(`/api/bets/code/${privateBetA.join_code}`)
      .expect(200);

    assert.equal(response.body.bet.id, privateBetA.id);
    assert.notEqual(response.body.bet.id, privateBetB.id);
    assert.equal(response.body.bet.title, "Private Bet A");
  } finally {
    context.database.close();
  }
});
