-- backend/src/data/migrations/002_sessions.sql

-- ---------------------------------------------------------------------------
-- Authentication sessions
-- ---------------------------------------------------------------------------
--
-- The authentication middleware uses a SQLite-backed session store so login
-- sessions survive individual HTTP requests and can be explicitly invalidated
-- during logout.
--
-- IMPORTANT:
-- The column names in this table must match the prepared statements in
-- src/stores/sqliteSessionStore.js exactly.

CREATE TABLE IF NOT EXISTS sessions (
    -- Replace these example column names/types with the exact contract used
    -- by sqliteSessionStore.js.
    sessionID TEXT PRIMARY KEY,
    sessionData TEXT NOT NULL,
    expiresAt INTEGER NOT NULL
);

-- Support efficient cleanup/lookups of expired sessions.
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
    ON sessions (expiresAt);