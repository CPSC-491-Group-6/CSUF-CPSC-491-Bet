// backend/src/stores/sqliteSessionStore.js

import session from "express-session";

/**
 * Create an express-session compatible store backed by better-sqlite3.
 *
 * The store receives its database connection through dependency injection.
 * Production can therefore use the application's persistent SQLite database,
 * while tests can use an isolated in-memory database.
 *
 * express-session requires stores to implement get(), set(), and destroy().
 * touch() is strongly recommended because it allows resave:false while still
 * refreshing session expiration for active sessions.
 */
export class SqliteSessionStore extends session.Store {
  /**
   * @param {object} options
   * @param {import("better-sqlite3").Database} options.database
   * @param {number} options.ttlMs Default session lifetime in milliseconds.
   */
  constructor({ database, ttlMs }) {
    super();

    this.database = database;
    this.ttlMs = ttlMs;

    /*
     * Prepare SQL statements once when the store is created instead of
     * recompiling SQL for every HTTP request.
     */
    this.getStatement = database.prepare(`
      SELECT
        session,
        expiresAt
      FROM sessions
      WHERE sid = ?
    `);

    /*
     * SQLite's ON CONFLICT clause allows the same method to create a new
     * session or replace an existing one.
     */
    this.setStatement = database.prepare(`
      INSERT INTO sessions (
        sid,
        session,
        expiresAt
      )
      VALUES (?, ?, ?)
      ON CONFLICT(sid)
      DO UPDATE SET
        session = excluded.session,
        expiresAt = excluded.expiresAt
    `);

    this.destroyStatement = database.prepare(`
      DELETE FROM sessions
      WHERE sid = ?
    `);

    this.touchStatement = database.prepare(`
      UPDATE sessions
      SET
        session = ?,
        expiresAt = ?
      WHERE sid = ?
    `);

    this.clearExpiredStatement = database.prepare(`
      DELETE FROM sessions
      WHERE expiresAt <= ?
    `);
  }

  /**
   * Calculate when a session should expire.
   *
   * express-session normally supplies cookie.expires based on maxAge. If an
   * expiration date is unavailable for any reason, the configured store TTL
   * is used as a safe fallback.
   */
  calculateExpiresAt(sessionData) {
    if (sessionData.cookie?.expires) {
      const expiresAt = new Date(sessionData.cookie.expires).getTime();

      if (Number.isFinite(expiresAt)) {
        return expiresAt;
      }
    }

    return Date.now() + this.ttlMs;
  }

  /**
   * Remove sessions whose expiration time has passed.
   *
   * This lightweight cleanup is run during normal session writes so expired
   * rows do not accumulate indefinitely in the SQLite database.
   */
  clearExpiredSessions() {
    this.clearExpiredStatement.run(Date.now());
  }

  /**
   * Load a session by its opaque session ID.
   *
   * callback receives:
   *   callback(null, session) when found,
   *   callback(null, null) when missing/expired,
   *   callback(error) when the database or JSON parsing fails.
   */
  get(sid, callback) {
    try {
      const row = this.getStatement.get(sid);

      if (!row) {
        return callback(null, null);
      }

      /*
       * Treat expired data as nonexistent and remove it immediately.
       */
      if (row.expiresAt <= Date.now()) {
        this.destroyStatement.run(sid);

        return callback(null, null);
      }

      const sessionData = JSON.parse(row.session);

      return callback(null, sessionData);
    } catch (error) {
      return callback(error);
    }
  }

  /**
   * Create or replace a session.
   *
   * Session data is serialized as JSON. The stored JSON may contain userID
   * and cookie metadata, but never contains the user's plaintext password.
   */
  set(sid, sessionData, callback = () => {}) {
    try {
      const expiresAt = this.calculateExpiresAt(sessionData);

      this.setStatement.run(sid, JSON.stringify(sessionData), expiresAt);

      this.clearExpiredSessions();

      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }

  /**
   * Delete a session completely.
   *
   * Logout will eventually call req.session.destroy(), which delegates to
   * this method and removes the server-side authenticated state.
   */
  destroy(sid, callback = () => {}) {
    try {
      this.destroyStatement.run(sid);

      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }

  /**
   * Refresh an active session's expiration without creating a new session ID.
   *
   * Implementing touch() allows express-session to safely use resave:false.
   */
  touch(sid, sessionData, callback = () => {}) {
    try {
      const expiresAt = this.calculateExpiresAt(sessionData);

      this.touchStatement.run(JSON.stringify(sessionData), expiresAt, sid);

      this.clearExpiredSessions();

      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }
}
