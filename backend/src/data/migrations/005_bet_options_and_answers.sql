-- Add answer choices without altering existing bets or deleting historical rows.
-- Member E should review this migration and own its integration.
CREATE TABLE IF NOT EXISTS bet_options (
  id TEXT PRIMARY KEY,
  bet_id TEXT NOT NULL,
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 150),
  position INTEGER NOT NULL CHECK (position >= 0),
  UNIQUE (bet_id, id),
  UNIQUE (bet_id, position),
  FOREIGN KEY (bet_id) REFERENCES bets(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bet_options_unique_label
  ON bet_options (bet_id, label COLLATE NOCASE);

-- Nullable for existing participants and the creator, who occupies a slot.
ALTER TABLE bet_participants
  ADD COLUMN selected_option_id TEXT REFERENCES bet_options(id);

-- Additively stage the outcome; the legacy outcome_user_id CHECK still
-- prevents resolution with this field alone until a separate table rebuild.
ALTER TABLE bets
  ADD COLUMN winning_option_id TEXT REFERENCES bet_options(id);

-- A valid option must belong to the participant's own bet.
CREATE TRIGGER IF NOT EXISTS check_participant_option_insert
BEFORE INSERT ON bet_participants
WHEN NEW.selected_option_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM bet_options o
  WHERE o.id = NEW.selected_option_id AND o.bet_id = NEW.bet_id
)
BEGIN
  SELECT RAISE(ABORT, 'selected option does not belong to bet');
END;

CREATE TRIGGER IF NOT EXISTS check_participant_option_update
BEFORE UPDATE OF bet_id, selected_option_id ON bet_participants
WHEN NEW.selected_option_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM bet_options o
  WHERE o.id = NEW.selected_option_id AND o.bet_id = NEW.bet_id
)
BEGIN
  SELECT RAISE(ABORT, 'selected option does not belong to bet');
END;

-- Outcome options must refer to the same bet as their result.
CREATE TRIGGER IF NOT EXISTS check_winning_option_update
BEFORE UPDATE OF id, winning_option_id ON bets
WHEN NEW.winning_option_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM bet_options o
  WHERE o.id = NEW.winning_option_id AND o.bet_id = NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'winning option does not belong to bet');
END;
