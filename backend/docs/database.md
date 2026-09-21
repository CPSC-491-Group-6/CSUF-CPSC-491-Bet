# Backend Database

This document describes the current SQLite design used by the Bet backend.

Sprint completion status belongs in [`../backend.md`](../backend.md). This file is the technical database reference.

## Database engine

The backend uses SQLite through:

```text
better-sqlite3
```

The shared connection is managed by:

```text
src/db/database.js
```

The database path is loaded from:

```text
DB_PATH
```

Default development path:

```text
./data/bet.db
```

## SQLite configuration

The shared connection enables:

```text
foreign_keys = ON
journal_mode = WAL
```

Foreign-key enforcement protects defined relationships.

WAL mode improves normal read/write behavior for the local application.

## Initialization

Schema initialization is handled by:

```text
src/db/init.js
```

Run:

```bash
npm run db:init
```

Initialization uses `CREATE TABLE IF NOT EXISTS` and may be run repeatedly without deleting existing tables.

## Current tables

The current backend schema includes:

```text
users
bets
participants
sessions
```

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

Current preliminary structure:

```text
bets
----
betID
creatorID
minimumWager
decision
numberOfParticipants
status
timeStamp
```

`betID`

```text
INTEGER PRIMARY KEY AUTOINCREMENT
```

`creatorID`

```text
NOT NULL
FOREIGN KEY → users.userID
```

`minimumWager`

Current preliminary persisted wager threshold.

`decision`

May remain empty until resolution.

`numberOfParticipants`

Currently stored, but the team still needs to decide whether this value should remain persisted or be calculated from `participants`.

`status`

Current lifecycle:

```text
Draft
→ Active
→ Locked
→ Resolved
→ Archived
```

SQLite constrains the status column to these allowed values.

`timeStamp`

```text
NOT NULL
DEFAULT CURRENT_TIMESTAMP
```

The Sprint 3 implementation will finalize the production bet schema and API contract.

## `participants`

Current preliminary structure:

```text
participants
------------
betID
userID
wager
timeStamp
```

Relationships:

```text
participants.betID
    → bets.betID

participants.userID
    → users.userID
```

The composite key:

```text
PRIMARY KEY (betID, userID)
```

prevents the same user from participating in the same bet more than once.

Username is intentionally not duplicated in this table because it can be retrieved through the user relationship.

## Current relationships

```text
bets.creatorID
    → users.userID

participants.userID
    → users.userID

participants.betID
    → bets.betID
```

Sessions reference `userID` inside serialized session state rather than through a SQLite foreign-key column.

## Repository boundary

Raw SQL should remain outside HTTP controllers.

Current intended layering:

```text
Controller
   ↓
Service
   ↓
Repository
   ↓
SQLite
```

Current user repository operations:

```text
createUser()
findById()
findByEmail()
findByUsername()
```

Sprint 3 is expected to introduce corresponding bet and participant repository operations.

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

## Testing database behavior

Automated tests create isolated SQLite databases using:

```text
:memory:
```

The test database reproduces the user and session constraints needed by the authentication suite.

Tests do not write to:

```text
data/bet.db
```

See [`testing.md`](testing.md).

## Local reset

The generated development database may be removed with:

```bash
rm -f data/bet.db data/bet.db-shm data/bet.db-wal
```

Then recreate the schema:

```bash
npm run db:init
```

Inspect current tables:

```bash
sqlite3 data/bet.db ".tables"
```

As Sprint 5/6 hardening progresses, this manual procedure should be replaced or supplemented by dedicated reset/migration/recovery tooling.

## Open database decisions

The following belong to later sprints:

- final Create Bet fields,
- whether `numberOfParticipants` remains stored or calculated,
- wager representation,
- required production indexes,
- migration strategy,
- seed/reset tooling,
- recovery procedures,
- production database-file location,
- final history/archive persistence behavior.
