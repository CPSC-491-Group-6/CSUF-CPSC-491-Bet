PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS bets (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    join_code TEXT NOT NULL COLLATE NOCASE UNIQUE,
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'locked', 'resolved')),
    max_participants INTEGER NOT NULL DEFAULT 2
        CHECK (max_participants BETWEEN 2 AND 100),
    outcome_user_id TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    locked_at TEXT,
    resolved_at TEXT,
    FOREIGN KEY (creator_id) REFERENCES users (id) ON DELETE RESTRICT,
    FOREIGN KEY (outcome_user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CHECK (
        (status = 'open' AND locked_at IS NULL AND resolved_at IS NULL AND outcome_user_id IS NULL)
        OR (status = 'locked' AND locked_at IS NOT NULL AND resolved_at IS NULL AND outcome_user_id IS NULL)
        OR (status = 'resolved' AND locked_at IS NOT NULL AND resolved_at IS NOT NULL AND outcome_user_id IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS bet_participants (
    bet_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (bet_id, user_id),
    FOREIGN KEY (bet_id) REFERENCES bets (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bets_creator_id ON bets (creator_id);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets (status);
CREATE INDEX IF NOT EXISTS idx_bet_participants_user_id ON bet_participants (user_id);
