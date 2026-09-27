// backend/tests/auth/register.test.js

import assert from "node:assert/strict";
import test from "node:test";

import request from "supertest";

import { createApp } from "../../src/createApp.js";
import { createUserRepository } from "../../src/repositories/createUserRepository.js";
import { createAuthService } from "../../src/services/createAuthService.js";
import { createTestDatabase } from "../helpers/testDatabase.js";

/**
 * Create an isolated Express application for registration endpoint tests.
 *
 * Each invocation gets:
 * - a new in-memory SQLite database,
 * - a real user repository,
 * - the real authentication business service,
 * - a predictable fake password service,
 * - the real Express routing/error-handling stack.
 *
 * This allows the tests to exercise nearly the entire registration request
 * path without reading or writing the project's development database.
 */
function createTestContext() {
  const database = createTestDatabase();

  const userRepository = createUserRepository(database);

  /**
   * Password hashing itself is already tested independently using Argon2id.
   *
   * Endpoint tests use a deterministic fake implementation so they remain
   * fast and can easily verify what value was persisted.
   */
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

  const app = createApp({
    authService,
  });

  return {
    app,
    database,
    userRepository,
  };
}

test("POST /api/auth/register creates a user", async () => {
  const context = createTestContext();

  try {
    const response = await request(context.app)
      .post("/api/auth/register")
      .send({
        username: "TestUser",
        email: "Test@Example.com",
        password: "ExamplePassword123!",
      })
      .expect(201);

    /*
     * Verify that the API returns the expected safe user representation.
     */
    assert.equal(response.body.user.userID, 1);
    assert.equal(response.body.user.username, "TestUser");
    assert.equal(response.body.user.email, "test@example.com");
    assert.equal(response.body.user.verificationStatus, 0);

    /*
     * Sensitive password information must never appear in the HTTP response.
     */
    assert.equal("password" in response.body.user, false);
    assert.equal("passwordHash" in response.body.user, false);

    /*
     * Confirm that registration actually persisted the account and that the
     * repository received a hash rather than the plaintext password.
     */
    const storedUser = context.userRepository.findByEmail("test@example.com");

    assert.ok(storedUser);

    assert.equal(storedUser.passwordHash, "hashed:ExamplePassword123!");

    assert.notEqual(storedUser.passwordHash, "ExamplePassword123!");
  } finally {
    context.database.close();
  }
});

test("POST /api/auth/register rejects invalid registration input", async () => {
  const context = createTestContext();

  try {
    const response = await request(context.app)
      .post("/api/auth/register")
      .send({
        username: "ab",
        email: "not-an-email",
        password: "short",
      })
      .expect(400);

    assert.equal(response.body.error.code, "VALIDATION_ERROR");

    assert.equal(
      response.body.error.message,
      "The authentication request contains invalid input.",
    );

    /*
     * Validation errors should include field-level information that the
     * frontend can eventually use to display useful form messages.
     */
    assert.ok(Array.isArray(response.body.error.details));
    assert.ok(response.body.error.details.length > 0);
  } finally {
    context.database.close();
  }
});

test("POST /api/auth/register rejects a duplicate email", async () => {
  const context = createTestContext();

  try {
    await request(context.app)
      .post("/api/auth/register")
      .send({
        username: "FirstUser",
        email: "test@example.com",
        password: "ExamplePassword123!",
      })
      .expect(201);

    /*
     * The capitalization is intentionally different to verify that duplicate
     * email detection remains case-insensitive.
     */
    const response = await request(context.app)
      .post("/api/auth/register")
      .send({
        username: "SecondUser",
        email: "TEST@EXAMPLE.COM",
        password: "AnotherPassword123!",
      })
      .expect(409);

    assert.deepEqual(response.body, {
      error: {
        code: "EMAIL_ALREADY_EXISTS",
        message: "An account with that email already exists.",
      },
    });
  } finally {
    context.database.close();
  }
});

test("POST /api/auth/register rejects a duplicate username", async () => {
  const context = createTestContext();

  try {
    await request(context.app)
      .post("/api/auth/register")
      .send({
        username: "TestUser",
        email: "first@example.com",
        password: "ExamplePassword123!",
      })
      .expect(201);

    /*
     * Username identity is also case-insensitive even though the original
     * capitalization is retained for display.
     */
    const response = await request(context.app)
      .post("/api/auth/register")
      .send({
        username: "testuser",
        email: "second@example.com",
        password: "AnotherPassword123!",
      })
      .expect(409);

    assert.deepEqual(response.body, {
      error: {
        code: "USERNAME_ALREADY_EXISTS",
        message: "That username is already in use.",
      },
    });
  } finally {
    context.database.close();
  }
});

test("unexpected registration errors return a safe internal error", async () => {
  /**
   * This service intentionally throws a generic Error to simulate an
   * unexpected programming/database/runtime failure.
   */
  const failingAuthService = {
    async register() {
      throw new Error("Sensitive internal database information");
    },
  };

  const app = createApp({
    authService: failingAuthService,
  });

  const response = await request(app)
    .post("/api/auth/register")
    .send({
      username: "TestUser",
      email: "test@example.com",
      password: "ExamplePassword123!",
    })
    .expect(500);

  assert.deepEqual(response.body, {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected server error occurred.",
    },
  });

  /*
   * Internal exception messages must never be exposed to API consumers.
   */
  assert.equal(
    JSON.stringify(response.body).includes(
      "Sensitive internal database information",
    ),
    false,
  );
});
