// backend/src/config/createSessionMiddleware.js

import session from "express-session";

/**
 * Default session lifetime: 24 hours.
 *
 * Keeping the value in one exported constant ensures that the cookie and the
 * SQLite store agree about when an authentication session expires.
 */
export const DEFAULT_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Create the application's express-session middleware.
 *
 * The store and secret are injected so production and automated tests can
 * use different persistence/configuration without changing application code.
 */
export function createSessionMiddleware({
  store,
  secret,
  secure = false,
  maxAgeMs = DEFAULT_SESSION_MAX_AGE_MS,
}) {
  return session({
    /*
     * Use a short application-specific cookie name instead of Express's
     * default "connect.sid".
     */
    name: "sid",

    /*
     * The secret signs the session-ID cookie so clients cannot modify a SID
     * without invalidating its signature.
     */
    secret,

    /*
     * Session contents live in our SQLite store rather than MemoryStore.
     */
    store,

    /*
     * Our store implements touch(), so unchanged sessions do not need to be
     * fully rewritten on every request.
     */
    resave: false,

    /*
     * Do not create database rows/cookies for anonymous visitors simply
     * because they visited an endpoint such as /health.
     */
    saveUninitialized: false,

    cookie: {
      /*
       * Prevent frontend JavaScript from reading the authentication cookie.
       */
      httpOnly: true,

      /*
       * Lax provides useful protection against many cross-site request cases
       * while still working well for the same-site frontend/backend model.
       */
      sameSite: "lax",

      /*
       * Secure cookies require HTTPS. Local development runs over HTTP, so
       * this should become true only for the production environment.
       */
      secure,

      /*
       * The browser and the SQLite session store use the same 24-hour
       * lifetime.
       */
      maxAge: maxAgeMs,
    },
  });
}
