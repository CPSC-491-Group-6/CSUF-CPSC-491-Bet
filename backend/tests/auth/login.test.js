// backend/tests/auth/login.test.js

import assert from "node:assert/strict";
import test from "node:test";

import request from "supertest";

import { createTestSessionMiddleware } from "../helpers/testSession.js";

import { createApp } from "../../src/createApp.js";
import { createUserRepository } from "../../src/repositories/createUserRepository.js";
import { createAuthService } from "../../src/services/createAuthService.js";
import { createTestDatabase } from "../helpers/testDatabase.js";

/**
 * Build an isolated application environment for login endpoint tests.
 *
 * The real repository, authentication service, Express routing, validation,
 * and error middleware are used. Only password hashing is replaced with a
 * deterministic fake because Argon2id itself is tested separately.
 */
function createTestContext() {
  const database = createTestDatabase();

  const userRepository = createUserRepository(database);

  const passwordService = {
    /**
     * Produce a deterministic fake hash for fast integration tests.
     */
    async hashPassword(password) {
      return `hashed:${password}`;
    },

    /**
     * Reproduce the expected hash and compare it with the stored value.
     */
    async verifyPassword(passwordHash, password) {
      return passwordHash === `hashed:${password}`;
    },
  };

  const authService = createAuthService({
    userRepository,
    passwordService,
  });

  /*
   * Use the same in-memory database for users and sessions so the entire
   * authentication request remains isolated from development data.
   */
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
 * Insert a known account into the isolated database.
 *
 * Using the repository keeps setup consistent with the production schema
 * while avoiding unnecessary registration HTTP requests in every login test.
 */
function createExistingUser(userRepository) {
  return userRepository.createUser({
    username: "TestUser",
    email: "test@example.com",
    passwordHash: "hashed:ExamplePassword123!",
  });
}

test("POST /api/auth/login authenticates valid credentials", async () => {
  const context = createTestContext();

  try {
    createExistingUser(context.userRepository);

    const response = await request(context.app)
      .post("/api/auth/login")
      .send({
        email: "TEST@EXAMPLE.COM",
        password: "ExamplePassword123!",
      })
      .expect(200);

    assert.equal(response.body.user.userID, 1);
    assert.equal(response.body.user.username, "TestUser");
    assert.equal(response.body.user.email, "test@example.com");

    /*
     * Password material must never be returned after successful login.
     */
    assert.equal("password" in response.body.user, false);

    assert.equal("passwordHash" in response.body.user, false);
  } finally {
    context.database.close();
  }
});

test("POST /api/auth/login rejects an incorrect password", async () => {
  const context = createTestContext();

  try {
    createExistingUser(context.userRepository);

    const response = await request(context.app)
      .post("/api/auth/login")
      .send({
        email: "test@example.com",
        password: "WrongPassword123!",
      })
      .expect(401);

    assert.deepEqual(response.body, {
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      },
    });
  } finally {
    context.database.close();
  }
});

test("POST /api/auth/login rejects an unknown account", async () => {
  const context = createTestContext();

  try {
    const response = await request(context.app)
      .post("/api/auth/login")
      .send({
        email: "missing@example.com",
        password: "ExamplePassword123!",
      })
      .expect(401);

    /*
     * Unknown accounts must produce the same response as incorrect passwords
     * so the endpoint does not disclose whether an email is registered.
     */
    assert.deepEqual(response.body, {
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      },
    });
  } finally {
    context.database.close();
  }
});

test("POST /api/auth/login rejects malformed login input", async () => {
  const context = createTestContext();

  try {
    const response = await request(context.app)
      .post("/api/auth/login")
      .send({
        email: "not-an-email",
        password: "",
      })
      .expect(400);

    assert.equal(response.body.error.code, "VALIDATION_ERROR");

    assert.ok(Array.isArray(response.body.error.details));

    assert.ok(response.body.error.details.length > 0);
  } finally {
    context.database.close();
  }
});

/*
 * Test that a newly registered user can immediately log in.
 */
test("a newly registered user can immediately log in", async () => {
  const context = createTestContext();

  try {
    /**
     * First create the account through the public registration endpoint.
     */
    await request(context.app)
      .post("/api/auth/register")
      .send({
        username: "NewUser",
        email: "newuser@example.com",
        password: "ExamplePassword123!",
      })
      .expect(201);

    /**
     * Then authenticate using the same credentials through the public login
     * endpoint. This confirms registration and login use compatible storage
     * and credential-verification behavior.
     */
    const response = await request(context.app)
      .post("/api/auth/login")
      .send({
        email: "newuser@example.com",
        password: "ExamplePassword123!",
      })
      .expect(200);

    assert.equal(response.body.user.username, "NewUser");

    assert.equal(response.body.user.email, "newuser@example.com");

    assert.equal("passwordHash" in response.body.user, false);
  } finally {
    context.database.close();
  }
});

test("POST /api/auth/login creates a server-side session", async () => {
  const context = createTestContext();

  try {
    createExistingUser(context.userRepository);

    /*
     * Supertest's agent preserves cookies between requests, which will become
     * important when /me and logout are added next.
     */
    const agent = request.agent(context.app);

    const response = await agent
      .post("/api/auth/login")
      .send({
        email: "test@example.com",
        password: "ExamplePassword123!",
      })
      .expect(200);

    /*
     * Successful login should issue the signed HttpOnly session-ID cookie.
     */
    const cookies = response.headers["set-cookie"];

    assert.ok(Array.isArray(cookies));
    assert.ok(cookies.some((cookie) => cookie.startsWith("sid=")));
    assert.ok(cookies.some((cookie) => cookie.includes("HttpOnly")));
    assert.ok(cookies.some((cookie) => cookie.includes("SameSite=Lax")));

    /*
     * Confirm that the authenticated state was persisted on the server.
     */
    const storedSessions = context.database
      .prepare(
        `
        SELECT
          sid,
          session,
          expiresAt
        FROM sessions
      `,
      )
      .all();

    assert.equal(storedSessions.length, 1);

    const storedSession = JSON.parse(storedSessions[0].session);

    assert.equal(storedSession.userID, 1);
    assert.ok(storedSessions[0].expiresAt > Date.now());
  } finally {
    context.database.close();
  }
});

test("failed login does not create a server-side session", async () => {
  const context = createTestContext();

  try {
    createExistingUser(context.userRepository);

    const response = await request(context.app)
      .post("/api/auth/login")
      .send({
        email: "test@example.com",
        password: "WrongPassword123!",
      })
      .expect(401);

    /*
     * Because saveUninitialized is false, failed authentication should not
     * produce a session cookie.
     */
    assert.equal(response.headers["set-cookie"], undefined);

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
