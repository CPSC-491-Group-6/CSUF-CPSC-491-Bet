// backend/src/config/session.js

import db from "../db/database.js";
import { SqliteSessionStore } from "../stores/sqliteSessionStore.js";
import { env } from "./env.js";

import {
  createSessionMiddleware,
  DEFAULT_SESSION_MAX_AGE_MS,
} from "./createSessionMiddleware.js";

/**
 * Production SQLite session store.
 *
 * Authentication sessions are kept in the same SQLite database as the rest
 * of the backend data, which keeps the development/deployment architecture
 * simple for this project.
 */
export const sessionStore = new SqliteSessionStore({
  database: db,
  ttlMs: DEFAULT_SESSION_MAX_AGE_MS,
});

/**
 * Production Express session middleware.
 *
 * Secure cookies are enabled only in production because local development
 * currently uses plain HTTP.
 */
const sessionMiddleware = createSessionMiddleware({
  store: sessionStore,
  secret: env.sessionSecret,
  secure: env.nodeEnv === "production",
  maxAgeMs: DEFAULT_SESSION_MAX_AGE_MS,
});

export default sessionMiddleware;
