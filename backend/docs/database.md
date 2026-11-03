# Backend Database

This document describes the current SQLite design used by the Bet backend.

Sprint completion status belongs in [`../backend.md`](../backend.md). This file is the technical database reference.

The current schema includes the SCRUM-489 Join/Lock API persistence requirements and the answer-option model requested during team integration.

## Database engine

The backend uses SQLite through:

```text
better-sqlite3
```

The shared connection is managed by:

```text
src/data/database.js
```

The database path is loaded from:

```text
DB_PATH
```

Default development path:

```text
./data/bet.db
```

Application code should use the configured database path rather than hardcoding another location.

## SQLite configuration

The shared connection enables:

```text
foreign_keys = ON
journal_mode = WAL
```

Foreign-key enforcement protects defined relationships.

WAL mode improves normal read/write behavior for the local application.

SQLite supports transactional writes, which the Join/Lock repositories use to enforce participant capacity, uniqueness, and lifecycle rules.

### Transaction behavior

Join and Lock operations use immediate transactions through `better-sqlite3`.

This prevents competing write operations from bypassing checks that depend on existing database state.

The intended behavior is:

```text
BEGIN IMMEDIATE
    |
    v
Read current bet and membership state
    |
    v
Validate permissions and constraints
    |
    v
Write only when valid
    |
    v
COMMIT
```

Rejected operations must leave the relevant database records unchanged.

## Initialization

Schema initialization is handled by:

```text
src/data/init.js
```

Run from `backend/`:

```bash
npm run db:init
```

The initializer discovers SQL migration files, applies outstanding migrations in filename order, and records successful migration names in `schema_migrations`.

Already applied migrations are skipped on subsequent runs.

The initialization process does not ordinarily delete existing application data.

### Current migrations

The current migration sequence verified during SCRUM-489 is:

```text
001_initial.sql
002_add_bet_visibility.sql
002_sessions.sql
003_normalize_migrations.sql
005_bet_options_and_answers.sql
006_replace_outcome_user_id.sql
```

The files are located in:

```text
src/data/migrations/
```

### Answer-option migration

`005_bet_options_and_answers.sql` introduces:

- The `bet_options` table.
- `bet_participants.selected_option_id`.
- `bets.winning_option_id`.
- Answer-option validation triggers.
- Relationships used by the new answer-selection model.

The migration is additive and preserves existing participant records.

### Outcome-model migration

`006_replace_outcome_user_id.sql` removes the obsolete winning-participant reference.

The former schema stored:

```text
bets.outcome_user_id
```

That representation assumed a winning outcome could be identified using one participant.

The new schema stores:

```text
bets.winning_option_id
```

This allows several participants to select the same winning option.

The outcome migration rebuilds the `bets` table so its lifecycle constraint no longer depends on `outcome_user_id`.

### Foreign-key handling during table rebuild

SQLite cannot disable foreign-key enforcement inside an active transaction.

The migration runner therefore requires special handling for the `bets` table rebuild:

1. Confirm the database is not already inside a transaction.
2. Temporarily disable foreign-key enforcement.
3. Run the table-rebuild migration transactionally.
4. Execute `PRAGMA foreign_key_check`.
5. Roll back if foreign-key violations are detected.
6. Restore foreign-key enforcement after the migration.

The initializer identifies the table-rebuild migration by its exact filename:

```text
006_replace_outcome_user_id.sql
```

Historical migration filenames must not be renamed casually because `schema_migrations` records them as applied migration identifiers.

### Existing resolved bets

An existing resolved bet cannot automatically be converted from a winning participant to a winning answer.

A historical resolved bet without a valid `winning_option_id` requires an explicit mapping before the obsolete participant-based outcome can be removed safely.

The outcome migration is designed to reject unresolved mappings rather than silently inventing an answer.

The verified fresh-database migration test does not establish that all historical production data can be migrated without additional mapping.

### Verified migration results

An isolated database initialization completed successfully with all six current migrations.

Schema inspection confirmed:

```text
outcome_user_id removed:       true
winning_option_id added:      true
selected_option_id added:     true
bet_options table exists:     true
```

SQLite verification returned:

```text
integrity_check:    ok
foreign_key_check:  []
```

The repository's local backend CI also successfully initialized, seeded, reset, and reinitialized the database.

These results demonstrate fresh-database compatibility and the exercised test scenarios, not a completed production migration.

## Current tables

The current backend schema includes:

```text
users
sessions
bets
bet_participants
bet_options
schema_migrations
```

The `schema_migrations` table records applied schema changes rather than application data.

## `users`

Purpose: account persistence and authentication identity.

```text
users
-----
userID
username
email
passwordHash
verificationStatus
timeStamp
```

### Constraints

`userID`

```text
INTEGER PRIMARY KEY AUTOINCREMENT
```

`username`

```text
TEXT NOT NULL
```

Username uniqueness is additionally enforced case-insensitively through a unique `COLLATE NOCASE` index.

`email`

```text
TEXT NOT NULL
```

Email uniqueness is additionally enforced case-insensitively through a unique `COLLATE NOCASE` index.

Application code normalizes email addresses to lowercase before persistence and lookup.

`passwordHash`

```text
TEXT NOT NULL
```

The column stores the encoded Argon2id hash only.

`verificationStatus`

```text
INTEGER NOT NULL DEFAULT 0
```

`timeStamp`

```text
TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
```

## `sessions`

Purpose: persistent server-side authentication sessions.

```text
sessions
--------
sid
session
expiresAt
```

`sid`

```text
TEXT PRIMARY KEY
```

This is the opaque session identifier used by `express-session`.

`session`

```text
TEXT NOT NULL
```

This stores JSON-serialized server-side session data.

Authenticated sessions currently contain the user's `userID` plus cookie metadata.

`expiresAt`

```text
INTEGER NOT NULL
```

Expiration is stored as a millisecond timestamp.

An index on `expiresAt` supports expired-session cleanup.

The browser does not receive this session JSON. It receives only the signed `sid` cookie.

## `bets`

Purpose: store bet creation details, lifecycle state, ownership, visibility, capacity, and final outcome.

Current structure:

```text
bets
----
id
creator_id
title
description
join_code
status
max_participants
created_at
locked_at
resolved_at
visibility
winning_option_id
```

### `id`

```text
TEXT PRIMARY KEY
```

The Create Bet service generates the bet's unique identifier.

### `creator_id`

```text
INTEGER NOT NULL
FOREIGN KEY → users.userID
```

The creator is derived from the authenticated session.

The API must not trust a client-supplied creator ID.

### `title`

```text
TEXT NOT NULL
```

The title is validated by the Create Bet service.

### `description`

```text
TEXT NOT NULL DEFAULT ''
```

The description stores the optional explanatory text for the bet.

### `join_code`

```text
TEXT NOT NULL UNIQUE
COLLATE NOCASE
```

The join code is generated by the server.

Case-insensitive matching allows participants to use either uppercase or lowercase versions of a valid code.

### `status`

```text
TEXT NOT NULL DEFAULT 'open'
```

Allowed persistent values:

```text
open
locked
resolved
```

The intended lifecycle is:

```text
open → locked → resolved
```

SCRUM-489 implements and tests the `open → locked` transition.

Final resolution requires a separate API implementation.

### `max_participants`

```text
INTEGER NOT NULL DEFAULT 2
```

The database constrains capacity to:

```text
2–100
```

The creator is counted as the first participant.

The number of participants is not stored as a separate counter in `bets`.

Instead, the API calculates:

```sql
SELECT COUNT(*) AS current_participants
FROM bet_participants
WHERE bet_id = ?;
```

This avoids maintaining two separate values that could disagree.

### `created_at`

```text
TEXT NOT NULL
```

Stores the creation timestamp.

### `locked_at`

```text
TEXT
```

Remains `NULL` while the bet is open.

When the creator successfully locks the bet, SQLite records the lock timestamp.

A repeated lock attempt must not overwrite the original value.

### `resolved_at`

```text
TEXT
```

Reserved for the final resolution timestamp.

Resolution endpoint behavior is outside SCRUM-489.

### `visibility`

```text
TEXT NOT NULL DEFAULT 'private'
```

Allowed values:

```text
public
private
```

Public bets may appear in discovery responses.

Private bets must not appear in public discovery results.

The join code must not be exposed through public discovery.

### `winning_option_id`

```text
TEXT
```

Stores the final winning option.

The value remains `NULL` while a bet is open or locked.

When a bet is resolved, the winning option should correspond to an option belonging to that same bet.

The database schema supports this relationship, but the endpoint for selecting and persisting the final winning outcome is separate planned work.

### Lifecycle constraints

The table enforces compatible lifecycle fields.

Expected relationships:

```text
OPEN
status            = open
locked_at         = NULL
resolved_at       = NULL
winning_option_id = NULL
```

```text
LOCKED
status            = locked
locked_at         = non-NULL
resolved_at       = NULL
winning_option_id = NULL
```

```text
RESOLVED
status            = resolved
locked_at         = non-NULL
resolved_at       = non-NULL
winning_option_id = non-NULL
```

The last state is supported structurally; SCRUM-489 does not implement the Resolve Bet endpoint.

## `bet_options`

Purpose: store the answers the bet creator makes available for participants to choose.

Current structure:

```text
bet_options
-----------
id
bet_id
label
position
```

### `id`

```text
TEXT PRIMARY KEY
```

Uniquely identifies an available answer option.

### `bet_id`

```text
TEXT NOT NULL
FOREIGN KEY → bets.id
```

Associates an option with its bet.

Deleting a bet cascades to its answer options under the option table's foreign-key rule.

### `label`

```text
TEXT NOT NULL
```

Contains the human-readable answer.

The database validates the trimmed label length.

The migration also creates uniqueness rules for labels within a bet.

### `position`

```text
INTEGER NOT NULL
```

Controls the order in which choices may be presented.

The position must be nonnegative.

The pair `(bet_id, position)` must be unique.

### Example

A bet might define:

```text
Bet: Who will win the matchup?

Option 1: Lakers
Option 2: Celtics
```

The options are stored separately from the bet record.

This permits multiple participants to select either answer.

### Integration boundary

The database supports creator-defined options.

The current Join/Lock API validates and stores selections from existing options.

Persisting the options themselves through the Create Bet HTTP endpoint must still be coordinated with the Create Bet owner and Member E.

## `bet_participants`

Purpose: store participant membership and each participant's selected answer.

Current structure:

```text
bet_participants
----------------
bet_id
user_id
selected_option_id
joined_at
```

### `bet_id`

```text
TEXT
FOREIGN KEY → bets.id
```

Identifies the joined bet.

### `user_id`

```text
INTEGER
FOREIGN KEY → users.userID
```

Identifies the authenticated participant.

### Composite primary key

```text
PRIMARY KEY (bet_id, user_id)
```

This prevents a user from being inserted more than once for the same bet.

The Join/Lock API also performs an explicit duplicate-membership check to return a controlled HTTP error.

### `selected_option_id`

```text
TEXT
```

Stores the participant's answer selection.

When the bet has configured options, the Join API requires a valid selection.

The selected option must belong to the joined bet.

For optionless legacy bets, the current API allows this field to remain `NULL`.

The creator is also inserted as a participant when the bet is created, and the creator's selected answer may remain `NULL`.

### `joined_at`

Stores the participant's membership timestamp.

### Capacity enforcement

The current participant count is calculated from this table.

Before inserting a new participant, the Join repository checks:

1. The bet exists.
2. The bet is open.
3. The authenticated user is not already participating.
4. The selected answer is valid when required.
5. Current membership is below `max_participants`.

These checks and the participant insertion occur within an immediate SQLite transaction.

### Duplicate-participant behavior

An existing participant cannot join the same bet again.

The API returns:

```text
HTTP 409
ALREADY_JOINED
```

The database's composite primary key provides an additional uniqueness guarantee.

### Answer validation

The migration introduces validation ensuring an answer belongs to the same bet as its participant.

An answer from a different bet must not be saved as that participant's selection.

The Join/Lock integration tests verified rejection of cross-bet answer selection without inserting a participant.

## Current relationships

```text
users.userID
    ↑
    |
bets.creator_id

users.userID
    ↑
    |
bet_participants.user_id

bets.id
    ↑
    |
bet_participants.bet_id

bets.id
    ↑
    |
bet_options.bet_id

bet_options.id
    ↑
    |
bet_participants.selected_option_id

bet_options.id
    ↑
    |
bets.winning_option_id
```

The answer-option relationships must also respect the owning bet ID, rather than merely matching an option identifier.

Sessions reference `userID` inside serialized session state rather than through a SQLite foreign-key column.

### Multiple correct participants

The final outcome is represented by one winning answer, not one winning participant.

Example:

```text
Bet: Who will win?

Winning option: option-yes

Participant A → option-yes
Participant B → option-no
Participant C → option-yes
```

Participants A and C both selected the winning option.

A future resolution/history query can determine matching participants using:

```sql
SELECT
  bp.bet_id,
  bp.user_id,
  bp.selected_option_id
FROM bet_participants AS bp
JOIN bets AS b
  ON b.id = bp.bet_id
WHERE b.status = 'resolved'
  AND bp.selected_option_id = b.winning_option_id;
```

This query identifies participants whose selections match the stored final answer.

It does not establish payout, wager, or reward distribution behavior.

Those rules remain separate product decisions.

## Repository boundary

Raw SQL should remain outside HTTP controllers.

The implemented layering is:

```text
Controller
   ↓
Service
   ↓
Repository
   ↓
SQLite
```

Current user repository operations include:

```text
createUser()
findById()
findByEmail()
findByUsername()
```

Create/List Bet functionality uses the existing bet repository and service factories.

SCRUM-489 introduces:

```text
createBetParticipationRepository(database)
createBetParticipationService({
  participationRepository
})
```

The participation repository exposes:

```text
joinByCode(params)
lockById(params)
```

### Join operation

The join transaction:

1. Looks up the bet by code.
2. Checks that the bet is open.
3. Checks duplicate membership.
4. Validates answer-option requirements.
5. Verifies remaining capacity.
6. Inserts the participant.
7. Returns the saved membership information.

### Lock operation

The lock transaction:

1. Finds the bet.
2. Checks the session user's identity against `creator_id`.
3. Checks that the bet is open.
4. Changes `status` to `locked`.
5. Stores `locked_at`.
6. Returns the updated bet.

The service translates expected repository failures into standardized API errors.

## User uniqueness

The application checks email/username availability before inserting so clients receive useful standardized errors.

The database also enforces uniqueness.

This two-layer approach provides:

```text
service checks
→ friendly errors

database constraints
→ final data-integrity guarantee
```

The database constraint remains important because simultaneous requests can race between an application-level lookup and insertion.

The same principle applies to participant membership:

```text
application checks
→ ALREADY_JOINED response

database composite key
→ final uniqueness guarantee
```

## Testing database behavior

Automated tests create isolated SQLite databases using:

```text
:memory:
```

The test database reproduces the user, bet, and session constraints needed by the applicable test suites.

Tests do not write to:

```text
data/bet.db
```

See [`testing.md`](testing.md).

### SCRUM-489 Join/Lock integration tests

The dedicated test file is:

```text
tests/bets/betParticipation.test.js
```

Run from `backend/`:

```bash
node --test tests/bets/betParticipation.test.js
```

The suite covers:

- successful joining,
- unknown join codes,
- duplicate participation,
- full bets,
- locked bets,
- unauthorized locking,
- valid creator locking,
- repeated-lock rejection,
- missing authentication,
- selected-answer persistence,
- missing required answers,
- cross-bet option rejection,
- case-insensitive join codes,
- unknown bet locking,
- database integrity.

### Verified results

The SCRUM-489 integration run reported:

```text
15 passed
0 failed
0 skipped
```

The full backend run reported:

```text
102 total
92 passed
0 failed
10 skipped
```

Local backend CI completed with:

```text
[Backend] Checks passed.
```

These are local test results. They do not establish GitHub-hosted CI completion or peer review approval.

### Database integrity commands

The test suite verifies:

```sql
PRAGMA integrity_check;
PRAGMA foreign_key_check;
```

Expected results:

```text
integrity_check = ok
foreign_key_check = no violations
```

A separate isolated migration verification also confirmed the removal of `outcome_user_id` and creation of the new answer fields.

### Remaining validation

Before production deployment, verify:

- Migration of populated legacy databases.
- Preservation of historical bet and participant relationships.
- Appropriate mapping for any historical resolved bets.
- Final Create Bet answer-option persistence.
- Final Resolve Bet outcome persistence.
- GitHub-hosted CI.
- Peer review of the database migration.

## Local reset

Use the repository's dedicated database scripts instead of directly deleting database files.

Initialize outstanding migrations:

```bash
npm run db:init
```

Reset the development database:

```bash
npm run db:reset
```

Reset and seed the development database:

```bash
npm run db:reset:seed
```

These reset commands are destructive and must not be run against a database containing information that needs to be retained.

The database reset script includes a production-safety check, which is verified by the existing automated database tests.

### Inspect current tables

For the default development database:

```bash
sqlite3 data/bet.db ".tables"
```

Inspect the bet schema:

```bash
sqlite3 data/bet.db "PRAGMA table_info(bets);"
```

Inspect participant columns:

```bash
sqlite3 data/bet.db "PRAGMA table_info(bet_participants);"
```

Inspect answer options:

```bash
sqlite3 data/bet.db "PRAGMA table_info(bet_options);"
```

### Validate database integrity

```bash
sqlite3 data/bet.db "PRAGMA integrity_check;"
sqlite3 data/bet.db "PRAGMA foreign_key_check;"
```

Expected:

```text
ok
```

The foreign-key check should return no violations.

### Migration history

To inspect applied migrations:

```bash
sqlite3 data/bet.db \
  "SELECT migration_name, applied_at FROM schema_migrations ORDER BY migration_name;"
```

Do not rename previously applied migration files without an explicit migration-history compatibility plan.

### Database backup

Before a destructive reset or populated-database migration, create a consistent SQLite backup.

The backup operation should use the configured `DB_PATH` and should not overwrite or delete the original database.

Do not commit:

```text
*.db
*.db-wal
*.db-shm
```

Generated runtime databases and backups must remain outside version control.

## Open database decisions

The following require additional implementation, review, or later-sprint work:

- Final approval of the creator-defined answer-options API.
- Final Create Bet answer-option persistence.
- Final Resolve Bet endpoint implementation.
- Winning-option selection and outcome persistence.
- Historical resolved-bet migration and outcome mapping.
- Whether optionless legacy bets may continue accepting joins.
- Wager representation and payout calculation.
- Final history/archive persistence behavior.
- Required additional production indexes.
- Populated-database migration and recovery validation.
- Production database-file location.
- Database backup and restore procedures.
- Member E's review of schema changes.
- Final integration validation with frontend and backend owners.

The SCRUM-489 Join/Lock schema and endpoint behavior are locally tested, but the overall bet lifecycle is not complete until Create Bet options, resolution, and history are integrated and verified.
