import assert from "node:assert/strict";
import test from "node:test";

import request from "supertest";

import { createApp } from "../../src/createApp.js";

/**
 * CC67-TC06:
 * Verify unexpected application errors do not expose sensitive
 * information through HTTP responses or server error logs.
 *
 * This test uses a synthetic marker, never real credentials.
 */
test("CC67-TC06: unexpected errors do not disclose sensitive values", async (t) => {
  const secretMarker = "CC67_TEST_ONLY_SECRET_DO_NOT_LOG";
  const loggedMessages = [];

  // Capture error output for this isolated test.
  t.mock.method(console, "error", (...values) => {
    loggedMessages.push(values.map(String).join(" "));
  });

  // Simulate a backend exception containing sensitive information.
  const failingAuthService = {
    async register() {
      throw new Error(`Unexpected database error: ${secretMarker}`);
    },
  };

  const app = createApp({
    authService: failingAuthService,
  });

  const response = await request(app)
    .post("/api/auth/register")
    .send({
      username: "SecurityTestUser",
      email: "security@test.local",
      password: "TestOnlyPassword123!",
    })
    .expect(500);

  // The client must receive the standard generic error.
  assert.deepEqual(response.body, {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected server error occurred.",
    },
  });

  // Ensure the simulated secret is absent from the response.
  assert.equal(JSON.stringify(response.body).includes(secretMarker), false);

  // Ensure the simulated secret is not written to server logs.
  assert.equal(
    loggedMessages.some((message) => message.includes(secretMarker)),
    false,
    "Sensitive information appeared in server error logs",
  );
});
