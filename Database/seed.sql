INSERT INTO users (id, email, display_name, password_hash)
VALUES
    ('00000000-0000-4000-8000-000000000001', 'alex@example.com', 'Alex', 'seed-password-hash'),
    ('00000000-0000-4000-8000-000000000002', 'jamie@example.com', 'Jamie', 'seed-password-hash');

INSERT INTO bets (id, creator_id, title, description, join_code, max_participants)
VALUES (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000001',
    'Example friendly bet',
    'Replace this data with application-created bets.',
    'DEMO01',
    2
);

INSERT INTO bet_participants (bet_id, user_id)
VALUES
    ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001'),
    ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000002');
