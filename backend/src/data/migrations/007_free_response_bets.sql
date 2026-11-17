
-- SCRUM-826: Extend bets to support free-response predictions and outcomes.
--
-- This is a forward-only migration. Do not modify previously applied
-- migrations or delete existing bet and participant records.
--
-- The migration runner disables foreign keys around the table rebuild,
-- executes the SQL transactionally, checks integrity, then restores them.

-- Preserve historical option-less bets as legacy records.
-- Existing bets with answer choices become multiple_choice records.

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

  answer_type TEXT NOT NULL DEFAULT 'legacy'
    CHECK (
      answer_type IN (
        'legacy',
        'multiple_choice',
        'free_response'
      )
    ),

  winning_option_id TEXT,

  resolution_text TEXT
    CHECK (
      resolution_text IS NULL
      OR (
        length(trim(resolution_text)) BETWEEN 1 AND 2000
      )
    ),

  FOREIGN KEY (creator_id)
    REFERENCES users(userID)
    ON DELETE RESTRICT,

  FOREIGN KEY (id, winning_option_id)
    REFERENCES bet_options(bet_id, id),

  CHECK (
    (
      status = 'open'
      AND locked_at IS NULL
      AND resolved_at IS NULL
      AND winning_option_id IS NULL
      AND resolution_text IS NULL
    )
    OR
    (
      status = 'locked'
      AND locked_at IS NOT NULL
      AND resolved_at IS NULL
      AND winning_option_id IS NULL
      AND resolution_text IS NULL
    )
    OR
    (
      status = 'resolved'
      AND locked_at IS NOT NULL
      AND resolved_at IS NOT NULL
      AND (
        (
          answer_type = 'multiple_choice'
          AND winning_option_id IS NOT NULL
          AND resolution_text IS NULL
        )
        OR
        (
          answer_type = 'free_response'
          AND winning_option_id IS NULL
          AND resolution_text IS NOT NULL
        )
      )
    )
  )
);

-- Copy existing records without changing IDs, dates, status,
-- visibility, capacity, creator ownership, or outcome values.

INSERT INTO bets_replacement (
  id,
  creator_id,
  title,
  description,
  join_code,
  status,
  max_participants,
  created_at,
  locked_at,
  resolved_at,
  visibility,
  answer_type,
  winning_option_id,
  resolution_text
)
SELECT
  b.id,
  b.creator_id,
  b.title,
  b.description,
  b.join_code,
  b.status,
  b.max_participants,
  b.created_at,
  b.locked_at,
  b.resolved_at,
  b.visibility,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM bet_options AS o
      WHERE o.bet_id = b.id
    )
    THEN 'multiple_choice'
    ELSE 'legacy'
  END,
  b.winning_option_id,
  NULL
FROM bets AS b;

-- Replace the old bets table after the copy succeeds.
-- The surrounding transaction rolls back all changes if it fails.

DROP TABLE bets;

ALTER TABLE bets_replacement RENAME TO bets;

-- Restore the indexes established by earlier migrations.

CREATE INDEX idx_bets_creator_id
  ON bets (creator_id);

CREATE INDEX idx_bets_status
  ON bets (status);

CREATE INDEX idx_bets_visibility_created_at
  ON bets (visibility, created_at, id);

-- Retain the same-bet outcome validation.

CREATE TRIGGER check_winning_option_update
BEFORE UPDATE OF id, winning_option_id ON bets
WHEN NEW.winning_option_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM bet_options AS o
    WHERE o.id = NEW.winning_option_id
      AND o.bet_id = NEW.id
  )
BEGIN
  SELECT RAISE(
    ABORT,
    'winning option does not belong to bet'
  );
END;

-- Store each participant's free-response prediction.
-- NULL remains valid for existing historical participants and
-- legacy creator memberships with no answer.

ALTER TABLE bet_participants
ADD COLUMN prediction_text TEXT
  CHECK (
    prediction_text IS NULL
    OR (
      length(trim(prediction_text)) BETWEEN 1 AND 2000
    )
  );

-- Free-response winners are explicitly selected by the creator.
--
-- Composite foreign keys ensure winners belong to the specified bet.
-- A bet may have zero winners: in that case, no rows are inserted.

CREATE TABLE bet_winners (
  bet_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,

  PRIMARY KEY (bet_id, user_id),

  FOREIGN KEY (bet_id)
    REFERENCES bets(id)
    ON DELETE CASCADE,

  FOREIGN KEY (bet_id, user_id)
    REFERENCES bet_participants(bet_id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_bet_winners_user_id
  ON bet_winners (user_id);
