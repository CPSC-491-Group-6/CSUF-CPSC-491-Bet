-- Keep previously created bets private unless the owner explicitly publishes them.
-- A new migration preserves existing databases and the original 001 migration.
ALTER TABLE bets
ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('public', 'private'));

-- Support public-bet discovery while keeping owner/participant indexes intact.
CREATE INDEX IF NOT EXISTS idx_bets_visibility_created_at
    ON bets (visibility, created_at, id);
