// backend/tests/stores/sqliteSessionStore.test.js

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteSessionStore } from "../../src/stores/sqliteSessionStore.js";
import { createTestDatabase } from "../helpers/testDatabase.js";

/**
 * Promise wrapper around the callback-based store.set() method.
 */
function setSession(store, sid, sessionData) {
  return new Promise((resolve, reject) => {
    store.set(sid, sessionData, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

/**
 * Promise wrapper around store.get().
 */
function getSession(store, sid) {
  return new Promise((resolve, reject) => {
    store.get(sid, (error, sessionData) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(sessionData);
    });
  });
}

/**
 * Promise wrapper around store.destroy().
 */
function destroySession(store, sid) {
  return new Promise((resolve, reject) => {
    store.destroy(sid, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

test("SQLite session store saves and loads a session", async () => {
  const database = createTestDatabase();

  try {
    const store = new SqliteSessionStore({
      database,
      ttlMs: 60_000,
    });

    await setSession(store, "test-session", {
      userID: 42,
      cookie: {
        expires: new Date(Date.now() + 60_000).toISOString(),
      },
    });

    const sessionData = await getSession(store, "test-session");

    assert.equal(sessionData.userID, 42);
  } finally {
    database.close();
  }
});

test("SQLite session store destroys a session", async () => {
  const database = createTestDatabase();

  try {
    const store = new SqliteSessionStore({
      database,
      ttlMs: 60_000,
    });

    await setSession(store, "test-session", {
      userID: 42,
      cookie: {},
    });

    await destroySession(store, "test-session");

    const sessionData = await getSession(store, "test-session");

    assert.equal(sessionData, null);
  } finally {
    database.close();
  }
});

test("SQLite session store treats expired sessions as missing", async () => {
  const database = createTestDatabase();

  try {
    const store = new SqliteSessionStore({
      database,
      ttlMs: 60_000,
    });

    /*
     * Insert an already-expired session directly so the test can verify that
     * get() removes and rejects expired server-side authentication state.
     */
    database
      .prepare(
        `
        INSERT INTO sessions (
          sid,
          session,
          expiresAt
        )
        VALUES (?, ?, ?)
      `,
      )
      .run(
        "expired-session",
        JSON.stringify({
          userID: 42,
          cookie: {},
        }),
        Date.now() - 1,
      );

    const sessionData = await getSession(store, "expired-session");

    assert.equal(sessionData, null);

    const row = database
      .prepare(
        `
        SELECT sid
        FROM sessions
        WHERE sid = ?
      `,
      )
      .get("expired-session");

    assert.equal(row, undefined);
  } finally {
    database.close();
  }
});
