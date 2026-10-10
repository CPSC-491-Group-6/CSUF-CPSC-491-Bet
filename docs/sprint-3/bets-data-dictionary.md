# Sprint 3 — Bets Data Dictionary

**Owner:** Member C
**Status:** Draft — based on `backend/src/data/migrations/001_initial.sql` supplied for review
**Schema verification:** Source reviewed; live database schema not yet inspected

## 1. Authoritative relationships

- `users.userID` is an `INTEGER PRIMARY KEY AUTOINCREMENT`.
- `bets.creator_id` references `users.userID` with `ON DELETE RESTRICT`.
- `bets.outcome_user_id` references `users.userID` with `ON DELETE RESTRICT`.
- `bet_participants.bet_id` references `bets.id` with `ON DELETE CASCADE`.
- `bet_participants.user_id` references `users.userID` with `ON DELETE CASCADE`.
- The configured database connection enables SQLite foreign-key enforcement.

## 2. bets table

| Field | SQLite type | Nullability / default | Source | Constraint / purpose |
| --- | --- | --- | --- | --- |
| `id` | TEXT | Primary key | Server-generated | Unique bet identifier; UUID format is described by schema comments but not enforced by SQLite |
| `creator_id` | INTEGER | NOT NULL | Authenticated session | Foreign key to `users.userID` |
| `title` | TEXT | NOT NULL | Create request | Bet title; no database length limit currently present |
| `description` | TEXT | NOT NULL DEFAULT `''` | Create request / DB | Optional description |
| `join_code` | TEXT | NOT NULL, UNIQUE COLLATE NOCASE | Server-generated | Case-insensitively unique join code |
| `status` | TEXT | NOT NULL DEFAULT `'open'` | Server / DB | One of `open`, `locked`, `resolved` |
| `max_participants` | INTEGER | NOT NULL DEFAULT `2` | Create request / DB | Integer between 2 and 100 |
| `outcome_user_id` | INTEGER | Nullable | Later resolution workflow | Foreign key to `users.userID` |
| `created_at` | TEXT | NOT NULL, current UTC timestamp default | Database | ISO-like timestamp generated with `strftime` |
| `locked_at` | TEXT | Nullable | Later locking workflow | Must align with status constraint |
| `resolved_at` | TEXT | Nullable | Later resolution workflow | Must align with status constraint |

### Lifecycle constraints defined by the migration

| Status | `locked_at` | `resolved_at` | `outcome_user_id` |
| --- | --- | --- | --- |
| `open` | NULL | NULL | NULL |
| `locked` | NOT NULL | NULL | NULL |
| `resolved` | NOT NULL | NOT NULL | NOT NULL |

The migration also creates indexes on `bets.creator_id` and `bets.status`.

## 3. bet_participants table

| Field | SQLite type | Nullability / default | Constraint / purpose |
| --- | --- | --- | --- |
| `bet_id` | TEXT | NOT NULL | References `bets.id`; part of composite primary key |
| `user_id` | INTEGER | NOT NULL | References `users.userID`; part of composite primary key |
| `joined_at` | TEXT | NOT NULL, current UTC timestamp default | Participation timestamp |

`PRIMARY KEY (bet_id, user_id)` prevents the same account from joining the same bet twice at the database layer. The migration creates an index on `bet_participants.user_id`.

## 4. Create/List field ownership

| Field group | Responsible layer | Notes |
| --- | --- | --- |
| `title`, `description`, `max_participants` | Frontend submits; API validates | Proposed business-level limits require approval |
| `creator_id` | API/authentication | Must come from `req.session.userID` |
| `id`, `join_code` | API or repository, to be agreed | Must not be accepted from client input |
| `status`, `created_at` | SQLite defaults or server logic | Preserve existing schema constraints |
| `locked_at`, `resolved_at`, `outcome_user_id` | Later workflow | Not set by initial Create Bet request |

## 5. Open schema/interface decisions

- [ ] Confirm whether Member D's work modifies the existing `bets` schema or only extends its repository/seed support.
- [ ] Decide whether bet creator is also inserted into `bet_participants` on creation.
- [ ] Confirm creation ID/join-code generator and agreed format.
- [ ] Confirm allowed API-level title/description lengths and input normalization.
- [ ] Validate migration/reset behavior against a fresh SQLite database.
- [ ] Update this dictionary if approved schema changes are merged.

## 6. Review record

| Reviewer | Area | Status |
| --- | --- | --- |
| Member D | Tables, constraints, seeds | Pending |
| Member B | API-to-repository compatibility | Pending |
| Member C | Requirements/data dictionary | Drafted |
