// backend/tests/helpers/testSession.js

import {
  createSessionMiddleware,
  DEFAULT_SESSION_MAX_AGE_MS,
} from "../../src/config/createSessionMiddleware.js";
import { SqliteSessionStore } from "../../src/stores/sqliteSessionStore.js";

/**
 * Create session middleware backed by a test's in-memory SQLite database.
 *
 * The secret is intentionally static because this middleware exists only
 * inside isolated automated tests and never signs real user sessions.
 */
export function createTestSessionMiddleware(database) {
  const store = new SqliteSessionStore({
    database,
    ttlMs: DEFAULT_SESSION_MAX_AGE_MS,
  });

  const middleware = createSessionMiddleware({
    store,
    secret: "test-session-secret-that-is-long-enough-for-isolated-tests",
    secure: false,
    maxAgeMs: DEFAULT_SESSION_MAX_AGE_MS,
  });

  return {
    store,
    middleware,
  };
}
