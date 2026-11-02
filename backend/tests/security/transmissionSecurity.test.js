import assert from "node:assert/strict";
import test from "node:test";

import express from "express";
import request from "supertest";

import {
  createSessionMiddleware,
  DEFAULT_SESSION_MAX_AGE_MS,
} from "../../src/config/createSessionMiddleware.js";

import { SqliteSessionStore } from "../../src/stores/sqliteSessionStore.js";
import { createTestDatabase } from "../helpers/testDatabase.js";

/**
 * Create an isolated session endpoint for testing cookie transmission.
 *
 * This does not access the normal development database or real accounts.
 * A trusted loopback proxy may be simulated for HTTPS-related unit tests.
 */
function createCookieTestContext({ secure, trustProxy = false }) {
  const database = createTestDatabase();

  const store = new SqliteSessionStore({
    database,
    ttlMs: DEFAULT_SESSION_MAX_AGE_MS,
  });

  const app = express();

  if (trustProxy) {
    // Trust only a loopback proxy in this isolated test.
    app.set("trust proxy", "loopback");
  }

  app.use(
    createSessionMiddleware({
      store,
      secret: "test-only-secret-for-isolated-cc67-security-validation",
      secure,
      maxAgeMs: DEFAULT_SESSION_MAX_AGE_MS,
    }),
  );

  // Issue a test-only session without invoking authentication.
  app.get("/security/session-probe", (req, res) => {
    req.session.userID = 1;
    res.status(200).json({ ok: true });
  });

  return { app, database };
}

/**
 * CC67-TC03:
 * A trusted HTTPS proxy must allow issuance of a Secure session cookie.
 */
test("CC67-TC03: HTTPS sessions use protected cookies", async () => {
  const context = createCookieTestContext({
    secure: true,
    trustProxy: true,
  });

  try {
    const response = await request(context.app)
      .get("/security/session-probe")
      .set("X-Forwarded-Proto", "https")
      .expect(200);

    const cookies = response.headers["set-cookie"] ?? [];
    const cookie = cookies.find((value) => value.startsWith("sid="));

    assert.ok(cookie, "Expected a session cookie");
    assert.match(cookie, /;\s*Secure(?:;|$)/);
    assert.match(cookie, /;\s*HttpOnly(?:;|$)/);
    assert.match(cookie, /;\s*SameSite=Lax(?:;|$)/);

    // Session identifiers must not appear in the JSON response.
    assert.deepEqual(response.body, { ok: true });
  } finally {
    context.database.close();
  }
});

/**
 * CC67-TC04:
 * Secure cookies must not be transmitted over ordinary HTTP.
 */
test("CC67-TC04: HTTP does not issue Secure cookies", async () => {
  const context = createCookieTestContext({
    secure: true,
    trustProxy: false,
  });

  try {
    const response = await request(context.app)
      .get("/security/session-probe")
      .expect(200);

    assert.equal(response.headers["set-cookie"], undefined);
  } finally {
    context.database.close();
  }
});

/**
 * CC67-TC04:
 * An untrusted forwarding header must not convince Express that a
 * directly received HTTP request is secure.
 */
test("CC67-TC04: untrusted HTTPS header cannot enable secure cookie", async () => {
  const context = createCookieTestContext({
    secure: true,
    trustProxy: false,
  });

  try {
    const response = await request(context.app)
      .get("/security/session-probe")
      .set("X-Forwarded-Proto", "https")
      .expect(200);

    assert.equal(response.headers["set-cookie"], undefined);
  } finally {
    context.database.close();
  }
});
