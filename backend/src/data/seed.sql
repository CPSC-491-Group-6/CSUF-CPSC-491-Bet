-- backend/src/data/seed.sql

-- ---------------------------------------------------------------------------
-- Demo bet
-- ---------------------------------------------------------------------------
--
-- Demo users are created by scripts/seedDatabase.js using the application's
-- normal password hashing service and user repository.
--
-- Looking the creator up by email avoids depending on a hard-coded SQLite
-- userID. SQLite is free to generate the user primary keys normally.
INSERT INTO bets (
    id,
    creator_id,
    title,
    description,
    join_code,
    status,
    max_participants
)
VALUES (
    '00000000-0000-4000-8000-000000000101',

    (
        SELECT userID
        FROM users
        WHERE email = 'creator@example.com' COLLATE NOCASE
    ),

    'Example friendly bet',

    'Replace this data with application-created bets.',

    'DEMO01',

    'open',

    2
)
ON CONFLICT(id) DO UPDATE SET
    creator_id = excluded.creator_id,
    title = excluded.title,
    description = excluded.description,
    join_code = excluded.join_code,
    status = excluded.status,
    max_participants = excluded.max_participants;


-- ---------------------------------------------------------------------------
-- Demo creator participation
-- ---------------------------------------------------------------------------
--
-- ON CONFLICT makes the seed operation repeatable without creating duplicate
-- participant relationships.
INSERT INTO bet_participants (
    bet_id,
    user_id
)
VALUES (
    '00000000-0000-4000-8000-000000000101',

    (
        SELECT userID
        FROM users
        WHERE email = 'creator@example.com' COLLATE NOCASE
    )
)
ON CONFLICT(bet_id, user_id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- Demo participant
-- ---------------------------------------------------------------------------
INSERT INTO bet_participants (
    bet_id,
    user_id
)
VALUES (
    '00000000-0000-4000-8000-000000000101',

    (
        SELECT userID
        FROM users
        WHERE email = 'participant@example.com' COLLATE NOCASE
    )
)
ON CONFLICT(bet_id, user_id) DO NOTHING;
