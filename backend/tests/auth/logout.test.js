// backend/tests/auth/logout.test.js

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
// Build an isolated backend instance for every logout test.
//
// The real authentication service, repository, routes, middleware, and
// session behavior are used. Password hashing is replaced with a predictable
// fake because password hashing has its own dedicated tests.
//
// Future improvement:
// Move this repeated setup into a shared authentication test helper.
// -----------------------------------------------------------------------------

function createTestContext() {
  const database = createTestDatabase();
  const userRepository = createUserRepository(database);

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

function createExistingUser(userRepository) {
  return userRepository.createUser({
    username: "TestUser",
    email: "test@example.com",
    passwordHash: "hashed:ExamplePassword123!",
  });
}

// -----------------------------------------------------------------------------
// TEST 1: LOGOUT REQUIRES AN AUTHENTICATED SESSION
// -----------------------------------------------------------------------------

test("POST /api/auth/logout rejects an unauthenticated request", async () => {
  const context = createTestContext();

  try {
    const response = await request(context.app)
      .post("/api/auth/logout")
      .expect(401);

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
// TEST 2: LOGOUT DESTROYS THE SERVER-SIDE SESSION
// -----------------------------------------------------------------------------
// Successful logout should:
// 1. return 204,
// 2. remove the stored session,
// 3. instruct the browser to clear the session cookie.
// -----------------------------------------------------------------------------

test("POST /api/auth/logout destroys the authenticated session", async () => {
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

    // Confirm login actually created a server-side session.
    const beforeLogout = context.database
      .prepare("SELECT COUNT(*) AS count FROM sessions")
      .get();

    assert.equal(beforeLogout.count, 1);

    const response = await agent
      .post("/api/auth/logout")
      .expect(204);

    // The server-side session should no longer exist.
    const afterLogout = context.database
      .prepare("SELECT COUNT(*) AS count FROM sessions")
      .get();

    assert.equal(afterLogout.count, 0);

    // Logout should also send a Set-Cookie header that clears "sid".
    const cookies = response.headers["set-cookie"];

    assert.ok(Array.isArray(cookies));
    assert.ok(cookies.some((cookie) => cookie.startsWith("sid=")));
  } finally {
    context.database.close();
  }
});

// -----------------------------------------------------------------------------
// TEST 3: COMPLETE AUTHENTICATION LIFECYCLE
// -----------------------------------------------------------------------------
// This is an integration test across several authentication components:
//
// login -> authenticated /me -> logout -> rejected /me
//
// This is especially useful in CI because it proves that authentication
// state works across several requests rather than testing only one endpoint.
//
// Future improvement:
// Extend this lifecycle when roles, email verification, session expiration,
// token refresh, or account locking are introduced.
// -----------------------------------------------------------------------------

test("logged-out users can no longer access protected authentication routes", async () => {
  const context = createTestContext();

  try {
    createExistingUser(context.userRepository);

    const agent = request.agent(context.app);

    // Step 1: Log in and establish authenticated state.
    await agent
      .post("/api/auth/login")
      .send({
        email: "test@example.com",
        password: "ExamplePassword123!",
      })
      .expect(200);

    // Step 2: Verify the session works before logout.
    await agent
      .get("/api/auth/me")
      .expect(200);

    // Step 3: Destroy authentication state.
    await agent
      .post("/api/auth/logout")
      .expect(204);

    // Step 4: The same client should now be rejected.
    const response = await agent
      .get("/api/auth/me")
      .expect(401);

    assert.equal(response.body.error.code, "AUTH_REQUIRED");
  } finally {
    context.database.close();
  }
});