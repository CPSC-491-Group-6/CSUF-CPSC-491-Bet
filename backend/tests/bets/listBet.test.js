import assert from "node:assert/strict";
import test from "node:test";

import request from "supertest";

import { createApp } from "../../src/createApp.js";
import { createUserRepository } from "../../src/repositories/createUserRepository.js";
import { createAuthService } from "../../src/services/createAuthService.js";
import { createTestDatabase } from "../helpers/testDatabase.js";
import { createTestSessionMiddleware } from "../helpers/testSession.js";

// Sprint 3 - Member B
// Jira Item 2: Automated List Bet API Tests

function createTestContext(bets = []) {
  const database = createTestDatabase();
  const userRepository = createUserRepository(database);

  // Use deterministic password behavior for testing.
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

  const { middleware: sessionMiddleware } =
    createTestSessionMiddleware(database);

  // Controlled service responses for API testing.

  const betService = {
    listMine(userID) {
      return bets.filter((bet) => bet.creator_id === userID);
    },

    listPublic() {
      return bets.filter((bet) => bet.visibility === "public");
    },
  };

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

// B-S3-L01: Authenticated user retrieves their bets
test("B-S3-L01: GET /api/bets returns authenticated user's bets", async () => {
  const context = createTestContext([
    {
      id: "1",
      title: "Will it rain tomorrow?",
      creator_id: 1,
    },
  ]);

  try {
    // Create a test user
    context.userRepository.createUser({
      username: "TestUser",
      email: "test@example.com",
      passwordHash: "hashed:ExamplePassword123!",
    });

    // Create an HTTP agent that remembers session cookies
    const agent = request.agent(context.app);

    // Log in
    await agent
      .post("/api/auth/login")
      .send({
        email: "test@example.com",
        password: "ExamplePassword123!",
      })
      .expect(200);

    // Act: Request the current user's bets
    const response = await agent.get("/api/bets").expect(200);

    // Assert: Verify the API response
    assert.ok(Array.isArray(response.body.bets));
    assert.equal(response.body.bets.length, 1);
    assert.equal(response.body.bets[0].title, "Will it rain tomorrow?");
  } finally {
    context.database.close();
  }
});

// B-S3-L02: Authenticated user retrieves their bets
test("B-S3-L02: GET /api/bets returns an empty list", async () => {
  const context = createTestContext([]);

  try {
    context.userRepository.createUser({
      username: "TestUser",
      email: "test@example.com",
      passwordHash: "hashed:ExamplePassword123!",
    });

    const agent = request.agent(context.app);

    await agent
      .post("/api/auth/login")
      .send({
        email: "test@example.com",
        password: "ExamplePassword123!",
      })
      .expect(200);

    const response = await agent.get("/api/bets").expect(200);

    assert.deepEqual(response.body, {
      bets: [],
    });
  } finally {
    context.database.close();
  }
});

test("B-S3-L03: GET /api/bets returns multiple bets", async () => {
  // Arrange: Create three sample bets for user 1
  const mockBets = [
    { id: "1", title: "Will it rain tomorrow?", creator_id: 1 },
    { id: "2", title: "Will I finish my homework?", creator_id: 1 },
    { id: "3", title: "Will the Lakers win?", creator_id: 1 },
  ];

  const context = createTestContext(mockBets);

  try {
    // Create test user
    context.userRepository.createUser({
      username: "TestUser",
      email: "test@example.com",
      passwordHash: "hashed:ExamplePassword123!",
    });

    // Log in
    const agent = request.agent(context.app);

    await agent
      .post("/api/auth/login")
      .send({
        email: "test@example.com",
        password: "ExamplePassword123!",
      })
      .expect(200);

    // Retrieve the user's bets
    const response = await agent.get("/api/bets").expect(200);

    // Assert: Verify all three bets are returned
    assert.equal(response.body.bets.length, 3);

    assert.deepEqual(
      response.body.bets.map((bet) => bet.title),
      [
        "Will it rain tomorrow?",
        "Will I finish my homework?",
        "Will the Lakers win?",
      ],
    );
  } finally {
    context.database.close();
  }
});

test("B-S3-L04: GET /api/bets rejects unauthenticated requests", async () => {
  // Create an isolated test environment
  const context = createTestContext([]);

  try {
    // Send GET request without logging in
    const response = await request(context.app).get("/api/bets").expect(401);

    // Assert: Verify the authentication error response
    assert.deepEqual(response.body, {
      error: {
        code: "AUTH_REQUIRED",
        message: "Authentication is required.",
      },
    });
  } finally {
    // Clean up test database
    context.database.close();
  }
});

test("B-S3-L05: GET /api/bets/public returns public bets", async () => {
  // Create public and private mock bets
  const mockBets = [
    {
      id: "1",
      title: "Will it rain tomorrow?",
      creator_id: 1,
      visibility: "public",
    },
    {
      id: "2",
      title: "Will I finish my homework?",
      creator_id: 1,
      visibility: "private",
    },
    {
      id: "3",
      title: "Will the Lakers win?",
      creator_id: 2,
      visibility: "public",
    },
  ];

  const context = createTestContext(mockBets);

  try {
    // Create a test user
    context.userRepository.createUser({
      username: "TestUser",
      email: "test@example.com",
      passwordHash: "hashed:ExamplePassword123!",
    });

    // Log in and preserve the session
    const agent = request.agent(context.app);

    await agent
      .post("/api/auth/login")
      .send({
        email: "test@example.com",
        password: "ExamplePassword123!",
      })
      .expect(200);

    // Retrieve public bets
    const response = await agent.get("/api/bets/public").expect(200);

    // Assert: Verify the response contains two public bets
    assert.equal(response.body.bets.length, 2);

    assert.deepEqual(
      response.body.bets.map((bet) => bet.title),
      ["Will it rain tomorrow?", "Will the Lakers win?"],
    );

    // Verify the response contains no private bets
    assert.ok(response.body.bets.every((bet) => bet.visibility === "public"));
  } finally {
    context.database.close();
  }
});

test("B-S3-L06: GET /api/bets returns correct response structure", async () => {
  // Prepare sample bet data
  const mockBets = [
    {
      id: "1",
      title: "Will it rain tomorrow?",
      creator_id: 1,
    },
  ];

  const context = createTestContext(mockBets);

  try {
    // Create test user
    context.userRepository.createUser({
      username: "TestUser",
      email: "test@example.com",
      passwordHash: "hashed:ExamplePassword123!",
    });

    // Log in
    const agent = request.agent(context.app);

    await agent
      .post("/api/auth/login")
      .send({
        email: "test@example.com",
        password: "ExamplePassword123!",
      })
      .expect(200);

    // User gets bets list
    const response = await agent.get("/api/bets").expect(200);

    // Verify JSON response
    assert.match(response.headers["content-type"], /application\/json/);

    // Verify the response contains a bets array
    assert.ok(Array.isArray(response.body.bets));

    // Verify returned bet fields
    const bet = response.body.bets[0];

    assert.equal(typeof bet.id, "string");
    assert.equal(typeof bet.title, "string");
    assert.equal(typeof bet.creator_id, "number");

    // Verify values match expected data
    assert.equal(bet.id, "1");
    assert.equal(bet.title, "Will it rain tomorrow?");
    assert.equal(bet.creator_id, 1);
  } finally {
    context.database.close();
  }
});
