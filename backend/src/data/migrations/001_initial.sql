-- backend/src/data/migrations/001_initial.sql

-- Enforce foreign-key relationships for this SQLite connection.
PRAGMA foreign_keys = ON;


-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
--
-- This schema intentionally matches createUserRepository.js.
--
-- userID is an INTEGER primary key because the repository creates users
-- without supplying an ID and then retrieves the generated ID through
-- result.lastInsertRowid.
--
-- username and email use NOCASE uniqueness so authentication identity remains
-- case-insensitive while preserving the capitalization originally entered by
-- the user.
CREATE TABLE IF NOT EXISTS users (
    userID INTEGER PRIMARY KEY AUTOINCREMENT,

    username TEXT NOT NULL COLLATE NOCASE UNIQUE,

    email TEXT NOT NULL COLLATE NOCASE UNIQUE,

    passwordHash TEXT NOT NULL,

    verificationStatus INTEGER NOT NULL DEFAULT 0
        CHECK (verificationStatus IN (0, 1)),

    timeStamp TEXT NOT NULL DEFAULT (
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    )
);


-- ---------------------------------------------------------------------------
-- Bets
-- ---------------------------------------------------------------------------
--
-- The existing bet model from the older Database/ implementation is retained,
-- but creator_id and outcome_user_id now reference the authoritative users
-- table's INTEGER userID instead of the older UUID-style users.id column.
--
-- Bet IDs remain text values so the application can continue using UUIDs for
-- bets without requiring the authentication/user model to use UUIDs as well.
CREATE TABLE IF NOT EXISTS bets (
    id TEXT PRIMARY KEY,

    creator_id INTEGER NOT NULL,

    title TEXT NOT NULL,

    description TEXT NOT NULL DEFAULT '',

    join_code TEXT NOT NULL COLLATE NOCASE UNIQUE,

    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'locked', 'resolved')),

    max_participants INTEGER NOT NULL DEFAULT 2
        CHECK (max_participants BETWEEN 2 AND 100),

    outcome_user_id INTEGER,

    created_at TEXT NOT NULL DEFAULT (
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    ),

    locked_at TEXT,

    resolved_at TEXT,

    FOREIGN KEY (creator_id)
        REFERENCES users (userID)
        ON DELETE RESTRICT,

    FOREIGN KEY (outcome_user_id)
        REFERENCES users (userID)
        ON DELETE RESTRICT,

    -- Keep lifecycle timestamps and the recorded outcome consistent with the
    -- current bet status.
    CHECK (
        (
            status = 'open'
            AND locked_at IS NULL
            AND resolved_at IS NULL
            AND outcome_user_id IS NULL
        )
        OR
        (
            status = 'locked'
            AND locked_at IS NOT NULL
            AND resolved_at IS NULL
            AND outcome_user_id IS NULL
        )
        OR
        (
            status = 'resolved'
            AND locked_at IS NOT NULL
            AND resolved_at IS NOT NULL
            AND outcome_user_id IS NOT NULL
        )
    )
);


-- ---------------------------------------------------------------------------
-- Bet participants
-- ---------------------------------------------------------------------------
--
-- Each user can participate in a particular bet only once. The composite
-- primary key enforces that rule directly in SQLite.
CREATE TABLE IF NOT EXISTS bet_participants (
    bet_id TEXT NOT NULL,

    user_id INTEGER NOT NULL,

    joined_at TEXT NOT NULL DEFAULT (
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    ),

    PRIMARY KEY (bet_id, user_id),

    FOREIGN KEY (bet_id)
        REFERENCES bets (id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id)
        REFERENCES users (userID)
        ON DELETE CASCADE
);


-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
--
-- UNIQUE constraints already create indexes for username, email, and
-- join_code. These indexes cover additional relationship/status lookups that
-- will commonly occur while displaying bets and participant lists.
CREATE INDEX IF NOT EXISTS idx_bets_creator_id
    ON bets (creator_id);

CREATE INDEX IF NOT EXISTS idx_bets_status
    ON bets (status);

CREATE INDEX IF NOT EXISTS idx_bet_participants_user_id
    ON bet_participants (user_id);
