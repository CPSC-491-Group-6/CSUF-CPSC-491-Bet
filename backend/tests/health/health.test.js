// backend/tests/health/health.test.js

import assert from "node:assert/strict";
import test from "node:test";

import request from "supertest";

import { createApp } from "../../src/createApp.js";

/**
 * Health checks do not use authentication, so a minimal unused auth service
 * is sufficient for constructing the application under test.
 */
const unusedAuthService = {
  async register() {
    throw new Error("Authentication service should not be called by /health.");
  },
};

test("GET /health reports that the backend is running", async () => {
  const app = createApp({
    authService: unusedAuthService,
  });

  const response = await request(app).get("/health").expect(200);

  assert.deepEqual(response.body, {
    status: "ok",
  });
});
