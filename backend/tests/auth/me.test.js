// backend/tests/auth/me.test.js

import assert from "node:assert/strict";
import test from "node:test";

import request from "supertest";

import { createApp } from "../../src/createApp.js";
import { createUserRepository } from "../../src/repositories/createUserRepository.js";
import { createAuthService } from "../../src/services/createAuthService.js";
import { createTestDatabase } from "../helpers/testDatabase.js";
import { createTestSessionMiddleware } from "../helpers/testSession.js";

// -----------------------------------------------------------------------------
// TEST SETUP
// -----------------------------------------------------------------------------
// Each test gets its own isolated application and database.
//
// This prevents automated tests from:
// - changing development data,
// - depending on previous tests,
// - sharing authentication sessions with one another.
//
// Future improvement:
// This setup could eventually be moved into a shared auth-test helper so
// register, login, /me, and logout tests do not repeat the same setup code.
// -----------------------------------------------------------------------------

function createTestContext() {
  const database = createTestDatabase();
  const userRepository = createUserRepository(database);

  // Password hashing itself is tested elsewhere.
  // A deterministic fake keeps these API tests fast and predictable.
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

  const app = createApp({
    authService,
    sessionMiddleware,
  });

  return {
    app,
    database,
    userRepository,
  };
}

// -----------------------------------------------------------------------------
// TEST USER
// -----------------------------------------------------------------------------
// Creates a predictable account for authentication tests.
//
// Future improvement:
// A shared test-user factory could generate different users for larger
// integration and authorization test suites.
// -----------------------------------------------------------------------------

function createExistingUser(userRepository) {
  return userRepository.createUser({
    username: "TestUser",
    email: "test@example.com",
    passwordHash: "hashed:ExamplePassword123!",
  });
}

// -----------------------------------------------------------------------------
// TEST 1: /me REQUIRES AUTHENTICATION
// -----------------------------------------------------------------------------
// A user who has not logged in should not be allowed to retrieve an account.
// -----------------------------------------------------------------------------

test("GET /api/auth/me rejects an unauthenticated request", async () => {
  const context = createTestContext();

  try {
    const response = await request(context.app).get("/api/auth/me").expect(401);

    assert.deepEqual(response.body, {
      error: {
        code: "AUTH_REQUIRED",
        message: "Authentication is required.",
      },
    });
  } finally {
    context.database.close();
  }
});

// -----------------------------------------------------------------------------
// TEST 2: AUTHENTICATED USER CAN RETRIEVE THEIR PROFILE
// -----------------------------------------------------------------------------
// Supertest's agent keeps the session cookie returned by login and sends it
// automatically with the following /me request.
// -----------------------------------------------------------------------------

test("GET /api/auth/me returns the authenticated user", async () => {
  const context = createTestContext();

  try {
    createExistingUser(context.userRepository);

    const agent = request.agent(context.app);

    await agent
      .post("/api/auth/login")
      .send({
        email: "test@example.com",
        password: "ExamplePassword123!",
      })
      .expect(200);

    const response = await agent.get("/api/auth/me").expect(200);

    assert.equal(response.body.user.userID, 1);
    assert.equal(response.body.user.username, "TestUser");
    assert.equal(response.body.user.email, "test@example.com");

    // Sensitive authentication information must never leave the backend.
    assert.equal("password" in response.body.user, false);
    assert.equal("passwordHash" in response.body.user, false);
  } finally {
    context.database.close();
  }
});

// -----------------------------------------------------------------------------
// TEST 3: STALE SESSION IS INVALIDATED
// -----------------------------------------------------------------------------
// A session may theoretically remain after its user account has been removed.
// The backend should treat that session as unauthenticated and destroy it.
//
// Future improvement:
// Similar tests can be added later for disabled, suspended, or unverified
// accounts if those account states are introduced.
// -----------------------------------------------------------------------------

test("GET /api/auth/me destroys a stale session when the user no longer exists", async () => {
  const context = createTestContext();

  try {
    createExistingUser(context.userRepository);

    const agent = request.agent(context.app);

    await agent
      .post("/api/auth/login")
      .send({
        email: "test@example.com",
        password: "ExamplePassword123!",
      })
      .expect(200);

    // Simulate an account being removed after a session was created.
    context.database.prepare("DELETE FROM users WHERE userID = ?").run(1);

    const response = await agent.get("/api/auth/me").expect(401);

    assert.equal(response.body.error.code, "AUTH_REQUIRED");

    // The stale server-side session should also be removed.
    const sessionCount = context.database
      .prepare("SELECT COUNT(*) AS count FROM sessions")
      .get();

    assert.equal(sessionCount.count, 0);
  } finally {
    context.database.close();
  }
});
