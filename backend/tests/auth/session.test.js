// backend/tests/auth/session.test.js

import assert from "node:assert/strict";
import test from "node:test";

import request from "supertest";

import { createApp } from "../../src/createApp.js";
import { createUserRepository } from "../../src/repositories/createUserRepository.js";
import { createAuthService } from "../../src/services/createAuthService.js";
import { createTestDatabase } from "../helpers/testDatabase.js";
import { createTestSessionMiddleware } from "../helpers/testSession.js";

/**
 * Build a completely isolated authentication application for session tests.
 *
 * The application uses:
 * - an in-memory SQLite database,
 * - the real user repository,
 * - the real authentication service,
 * - the real SQLite session store,
 * - the real Express routing/middleware stack,
 * - a deterministic fake password service.
 *
 * Only Argon2id itself is replaced because passwordService has its own tests.
 */
function createTestContext() {
  const database = createTestDatabase();

  const userRepository = createUserRepository(database);

  const passwordService = {
    /**
     * Deterministic hashing keeps integration tests fast while preserving the
     * same password-service interface used by production.
     */
    async hashPassword(password) {
      return `hashed:${password}`;
    },

    /**
     * Compare the submitted password against the deterministic test hash.
     */
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

/**
 * Create a known user directly through the repository.
 *
 * Authentication itself is still exercised through POST /api/auth/login;
 * only test setup bypasses the registration endpoint.
 */
function createExistingUser(userRepository) {
  return userRepository.createUser({
    username: "TestUser",
    email: "test@example.com",
    passwordHash: "hashed:ExamplePassword123!",
  });
}

/**
 * Authenticate the Supertest agent and preserve the returned session cookie
 * for future requests.
 */
async function loginAgent(agent) {
  await agent
    .post("/api/auth/login")
    .send({
      email: "test@example.com",
      password: "ExamplePassword123!",
    })
    .expect(200);
}

test("GET /api/auth/me rejects requests without authentication", async () => {
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

test("GET /api/auth/me returns the authenticated user's profile", async () => {
  const context = createTestContext();

  try {
    createExistingUser(context.userRepository);

    /*
     * request.agent() keeps cookies between requests, allowing this test to
     * behave like a browser that logs in and then accesses a protected route.
     */
    const agent = request.agent(context.app);

    await loginAgent(agent);

    const response = await agent.get("/api/auth/me").expect(200);

    assert.equal(response.body.user.userID, 1);

    assert.equal(response.body.user.username, "TestUser");

    assert.equal(response.body.user.email, "test@example.com");

    /*
     * Sensitive password material must never leave the authentication service.
     */
    assert.equal("password" in response.body.user, false);

    assert.equal("passwordHash" in response.body.user, false);
  } finally {
    context.database.close();
  }
});

test("POST /api/auth/logout destroys the server-side session", async () => {
  const context = createTestContext();

  try {
    createExistingUser(context.userRepository);

    const agent = request.agent(context.app);

    await loginAgent(agent);

    /*
     * Verify that login actually persisted a server-side session before we
     * exercise logout.
     */
    const sessionsBeforeLogout = context.database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM sessions
        `,
      )
      .get();

    assert.equal(sessionsBeforeLogout.count, 1);

    const logoutResponse = await agent.post("/api/auth/logout").expect(204);

    /*
     * Logout should send an expired replacement cookie so the browser removes
     * its reference to the destroyed session.
     */
    const cookies = logoutResponse.headers["set-cookie"];

    assert.ok(Array.isArray(cookies));

    assert.ok(cookies.some((cookie) => cookie.startsWith("sid=")));

    /*
     * The actual authentication state must also be gone from SQLite.
     */
    const sessionsAfterLogout = context.database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM sessions
        `,
      )
      .get();

    assert.equal(sessionsAfterLogout.count, 0);
  } finally {
    context.database.close();
  }
});

test("logged-out users can no longer access protected content", async () => {
  const context = createTestContext();

  try {
    createExistingUser(context.userRepository);

    const agent = request.agent(context.app);

    await loginAgent(agent);

    /*
     * Confirm authentication works before logout.
     */
    await agent.get("/api/auth/me").expect(200);

    /*
     * Destroy the authenticated session.
     */
    await agent.post("/api/auth/logout").expect(204);

    /*
     * The same client should now be rejected because its authenticated
     * server-side session no longer exists.
     */
    const response = await agent.get("/api/auth/me").expect(401);

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

test("POST /api/auth/logout requires an authenticated session", async () => {
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

test("GET /api/auth/me invalidates a session whose user no longer exists", async () => {
  const context = createTestContext();

  try {
    createExistingUser(context.userRepository);

    const agent = request.agent(context.app);

    await loginAgent(agent);

    /*
     * Simulate an account being removed after the user authenticated.
     */
    context.database
      .prepare(
        `
        DELETE FROM users
        WHERE userID = ?
      `,
      )
      .run(1);

    const response = await agent.get("/api/auth/me").expect(401);

    assert.deepEqual(response.body, {
      error: {
        code: "AUTH_REQUIRED",
        message: "Authentication is required.",
      },
    });

    /*
     * The stale authenticated session should also be removed from SQLite.
     */
    const result = context.database
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM sessions
      `,
      )
      .get();

    assert.equal(result.count, 0);
  } finally {
    context.database.close();
  }
});
