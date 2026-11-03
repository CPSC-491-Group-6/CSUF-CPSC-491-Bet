
-- Replace legacy winning-user storage with a winning-option model.
-- The migration runner must disable foreign keys before its transaction.

-- Do not silently discard historical resolved outcomes.
CREATE TEMP TABLE outcome_migration_guard (
  unresolved_count INTEGER NOT NULL
    CHECK (unresolved_count = 0)
);

INSERT INTO outcome_migration_guard (unresolved_count)
SELECT COUNT(*)
FROM bets
WHERE status = 'resolved'
  AND winning_option_id IS NULL;

DROP TABLE outcome_migration_guard;

-- The old trigger belongs to the table being replaced.
DROP TRIGGER IF EXISTS check_winning_option_update;

CREATE TABLE bets_replacement (
  id TEXT PRIMARY KEY,
  creator_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',

  join_code TEXT NOT NULL COLLATE NOCASE UNIQUE,

  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'locked', 'resolved')),

  max_participants INTEGER NOT NULL DEFAULT 2
    CHECK (max_participants BETWEEN 2 AND 100),

  created_at TEXT NOT NULL DEFAULT (
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  ),

  locked_at TEXT,
  resolved_at TEXT,

  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('public', 'private')),

  winning_option_id TEXT,

  FOREIGN KEY (creator_id)
    REFERENCES users(userID)
    ON DELETE RESTRICT,

  -- Ensure the winning answer belongs to this exact bet.
  FOREIGN KEY (id, winning_option_id)
    REFERENCES bet_options(bet_id, id),

  -- Enforce valid lifecycle transitions and stored outcome.
  CHECK (
    (
      status = 'open'
      AND locked_at IS NULL
      AND resolved_at IS NULL
      AND winning_option_id IS NULL
    )
    OR (
      status = 'locked'
      AND locked_at IS NOT NULL
      AND resolved_at IS NULL
      AND winning_option_id IS NULL
    )
    OR (
      status = 'resolved'
      AND locked_at IS NOT NULL
      AND resolved_at IS NOT NULL
      AND winning_option_id IS NOT NULL
    )
  )
);

-- Preserve existing bets, including visibility and timestamps.
INSERT INTO bets_replacement (
  id, creator_id, title, description, join_code,
  status, max_participants, created_at, locked_at,
  resolved_at, visibility, winning_option_id
)
SELECT
  id, creator_id, title, description, join_code,
  status, max_participants, created_at, locked_at,
  resolved_at, visibility, winning_option_id
FROM bets;

DROP TABLE bets;
ALTER TABLE bets_replacement RENAME TO bets;

-- Restore indexes from previous migrations.
CREATE INDEX idx_bets_creator_id
  ON bets (creator_id);

CREATE INDEX idx_bets_status
  ON bets (status);

CREATE INDEX idx_bets_visibility_created_at
  ON bets (visibility, created_at, id);

-- Validate updated outcomes against the bet's choices.
CREATE TRIGGER check_winning_option_update
BEFORE UPDATE OF id, winning_option_id ON bets
WHEN NEW.winning_option_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM bet_options o
    WHERE o.id = NEW.winning_option_id
      AND o.bet_id = NEW.id
  )
BEGIN
  SELECT RAISE(
    ABORT,
    'winning option does not belong to bet'
  );
END;
