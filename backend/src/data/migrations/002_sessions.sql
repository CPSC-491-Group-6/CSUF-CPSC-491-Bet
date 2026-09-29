-- backend/src/data/migrations/002_sessions.sql

-- ---------------------------------------------------------------------------
-- Authentication sessions
-- ---------------------------------------------------------------------------
--
-- express-session stores authenticated session state here.
-- sid is the opaque session identifier stored in the browser cookie.
-- session contains the serialized express-session JSON.
-- expiresAt stores the session expiration time as a Unix timestamp in
-- milliseconds.

CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    session TEXT NOT NULL,
    expiresAt INTEGER NOT NULL
);

-- Used when expired sessions are periodically removed.
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
    ON sessions (expiresAt);