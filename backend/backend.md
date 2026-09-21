# Bet Project Backend Tracking

## Purpose

This document is the authoritative backend **sprint deliverable and implementation tracking** record.

It intentionally does not duplicate detailed setup, API, database, authentication-design, or testing instructions. Those references are maintained in focused documents so technical changes can be updated once without causing conflicting documentation.

## Documentation map

| Document                                                         | Authoritative purpose                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| [`README.md`](README.md)                                         | Backend setup, environment, startup, developer onboarding          |
| [`docs/authentication-api.md`](docs/authentication-api.md)       | Authentication routes, request/response contract, example commands |
| [`docs/authentication-design.md`](docs/authentication-design.md) | Authentication architecture and design decisions                   |
| [`docs/database.md`](docs/database.md)                           | SQLite schema, constraints, relationships, persistence             |
| [`docs/testing.md`](docs/testing.md)                             | Test organization, commands, isolation, evidence workflow          |
| [`backend.md`](backend.md)                                       | Sprint deliverables, progress, acceptance criteria, peer review    |

## Project direction

The current MVP backend sequence is:

```text
Authentication
      ↓
Create / List
      ↓
Join / Lock
      ↓
Resolve / History
      ↓
Quality / Release
```

The current user journey targeted by the semester plan is:

```text
Register / Login
      ↓
Create Bet
      ↓
List Bets
      ↓
Join Bet
      ↓
Lock Bet
      ↓
Resolve Bet
      ↓
View History
```

Technical details for implemented features should be recorded in the focused documentation files above. This tracker should record whether planned sprint work is complete, incomplete, under review, or deferred.

## Documentation maintenance rule

When implementation changes:

1. update the relevant focused technical document,
2. update the corresponding sprint checkbox/acceptance criterion here,
3. avoid copying the same detailed procedure into multiple files.

For example:

- session behavior changes → update `docs/authentication-design.md`,
- auth response fields change → update `docs/authentication-api.md`,
- schema changes → update `docs/database.md`,
- test commands/coverage change → update `docs/testing.md`,
- sprint completion changes → update `backend.md`.

---

## Sprint implementation tracking

The project timeline was revised so Sprint 1 includes both shared planning artifacts and actual code-skeleton work. Backend and database foundation work completed during Sprint 1 is therefore part of the planned Sprint 1 increment rather than work completed ahead of schedule.

### Revised semester timeline

| Sprint                                   | Draft        | Final        | Main deliverable                                                                                                     |
| ---------------------------------------- | ------------ | ------------ | -------------------------------------------------------------------------------------------------------------------- |
| Sprint 1 — Planning + Code Skeleton      | Aug 31, 2026 | Sep 14, 2026 | Create the project-management setup and a runnable skeleton so all five members begin contributing code immediately. |
| Sprint 2 — Accounts                      | Sep 21, 2026 | Sep 28, 2026 | A user can register, log in, reach protected content, view a profile, and log out.                                   |
| Sprint 3 — Create and Join Bets          | Oct 5, 2026  | Oct 12, 2026 | Two users can create, list, join, lock, and view a bet in the integrated MVP.                                        |
| Sprint 4 — Resolve and History           | Oct 26, 2026 | Nov 2, 2026  | The creator can resolve a bet and participants can see a stable outcome and history.                                 |
| Sprint 5 — Quality and Release Candidate | Nov 9, 2026  | Nov 16, 2026 | The core journey is complete, hardened, accessible, and free of critical defects.                                    |
| Sprint 6 — Release                       | Nov 30, 2026 | Dec 7, 2026  | Freeze a reproducible final build with demo/reset/fallback tooling and final regression evidence.                    |

---

### Sprint 1 — Planning + Code Skeleton

**Draft:** Aug 31, 2026
**Final:** Sep 14, 2026

**Increment:** Create the project-management setup and a runnable skeleton so all five members begin contributing code immediately.

#### Shared planning and architecture work

- [x] Define the core backend feature sequence
- [x] Draft the preliminary API route list
- [x] Map backend/database work to the revised Sprints 2–6
- [x] Create a simple three-tier architecture diagram
- [x] Identify backend/SQLite dependencies
- [x] Identify frontend/backend handoffs
- [x] Define the initial `users` table
- [x] Define the initial `bets` table
- [x] Define the `participants` table
- [x] Map existing project variables into the schema
- [x] Define the allowed `status` lifecycle
- [x] Identify required primary keys and foreign-key relationships
- [x] Identify likely uniqueness constraints

#### Backend/API code skeleton

- [x] Create backend directory structure
- [x] Configure VS Code Dev Container
- [x] Verify Node.js, npm, and SQLite inside the Dev Container
- [x] Configure Node.js/npm project
- [x] Install Express
- [x] Install `better-sqlite3`
- [x] Install `dotenv`
- [x] Configure centralized environment handling
- [x] Create Express server skeleton
- [x] Enable JSON request parsing
- [x] Create route structure
- [x] Implement `GET /health`
- [x] Verify `GET /health`
- [ ] Add centralized error middleware
- [ ] Add basic automated API smoke tests

#### SQLite code skeleton

- [x] Create SQLite connection module
- [x] Configure SQLite database path through environment variables
- [x] Enable SQLite foreign-key enforcement
- [x] Enable SQLite WAL mode
- [x] Create initial SQLite initialization script
- [x] Create preliminary `users` table
- [x] Create preliminary `bets` table
- [x] Create preliminary `participants` table
- [x] Establish primary keys
- [x] Establish foreign-key relationships
- [x] Establish preliminary uniqueness constraints
- [x] Establish the `status` lifecycle constraint
- [x] Inspect and verify the generated SQLite schema
- [x] Add `npm run db:init`
- [x] Verify database creation from an empty local database state
- [x] Add dedicated seed command
- [x] Add dedicated reset command

#### Development tooling

- [x] Install ESLint and Prettier tooling
- [x] Configure `.env` and `.env.example`
- [x] Configure shared VS Code settings
- [x] Configure shared VS Code extension recommendations
- [x] Configure ESLint
- [x] Configure Prettier
- [x] Add lint and formatting npm commands
- [x] Verify ESLint passes
- [x] Verify Prettier formatting passes

### Sprint 1 acceptance criteria

- [x] The backend implementation sequence is documented
- [x] Preliminary API routes are documented
- [x] Preliminary SQLite tables and relationships are documented
- [x] Existing variable names are included consistently
- [x] The `status` lifecycle is documented
- [x] Frontend/backend/database handoffs are identified
- [x] Work is mapped across the revised Sprints 2–6
- [x] Major dependencies are listed
- [x] A three-tier architecture diagram is included
- [x] A runnable Express backend skeleton exists
- [x] `GET /health` responds successfully
- [x] SQLite can be initialized from an empty local state
- [x] Backend code has visible Git activity tied to Sprint 1 work

### Sprint 1 Peer review

- [x] The plan has been peer reviewed
- [x] Review feedback has been incorporated
- [x] Sprint 1 code has been approved through the required PR review workflow

---

## Sprint 2 — Accounts

**Draft:** Sep 21, 2026

**Final:** Sep 28, 2026

**Increment:** A user can register, log in, reach protected content, view a profile, and log out.

### Backend/API work

- [x] Finalize authentication and server-side session approach
- [x] Split Express application setup from server startup for testability
- [x] Add and validate authentication/session environment configuration
- [x] Implement user repository functions
- [x] Implement `POST /api/auth/register`
- [x] Implement `POST /api/auth/login`
- [x] Implement `GET /api/auth/me`
- [x] Implement logout and session invalidation behavior
- [x] Add Argon2id password hashing
- [x] Add registration input validation
- [x] Add login input validation
- [x] Define standardized authentication errors
- [x] Add global authentication/API error-handling middleware
- [x] Add authentication middleware for protected endpoints
- [x] Add authentication endpoint tests for success and failure paths

### Database work

- [x] Implement user persistence queries
- [x] Enforce unique email behavior
- [x] Enforce unique username behavior
- [x] Add user uniqueness constraints and database test helpers
- [x] Add session persistence schema and data helpers
- [x] Implement server-side session persistence
- [x] Add database tests for account persistence and constraints

### Sprint 2 acceptance criteria

- [x] A user can register with a unique username and email
- [x] A user can log in with a valid username/email and password
- [x] A user can log out and invalidate their session
- [x] A user can reach protected content only when logged in
- [x] A user can view their own profile information
- [x] A user cannot register with a duplicate username or email
- [x] A user cannot log in with an invalid username/email or password
- [x] A user cannot reach protected content when logged out

### Sprint 2 Peer review

- [ ] The plan has been peer reviewed
- [ ] Review feedback has been incorporated
- [ ] Sprint 2 code has been approved through the required PR review workflow

---

## Sprint 3 — Create and Join Bets

**Draft:** Oct 5, 2026

**Final:** Oct 12, 2026

**Increment:** Two users can create, list, join, lock, and view a bet in the integrated MVP.

### Bet API work

- [ ] Finalize Create Bet request and response fields
- [ ] Finalize `bets` schema requirements
- [ ] Implement bet repository functions
- [ ] Implement Create Bet API
- [ ] Implement List Bets API
- [ ] Implement Get Bet API
- [ ] Add server-side validation
- [ ] Add standardized bet-related errors
- [ ] Add create, list, and get endpoint tests

### Join / participant / lock work

- [ ] Implement participant persistence
- [ ] Implement participant repository functions
- [ ] Implement join behavior
- [ ] Implement join-code behavior if required
- [ ] Prevent duplicate participation
- [ ] Validate join requests and wager data
- [ ] Restrict joins based on bet status
- [ ] Implement creator/owner authorization for locking
- [ ] Implement bet lock behavior
- [ ] Prevent new participants after locking
- [ ] Add join, duplicate-participant, authorization, and state-rule tests

### Sprint 3 Database work

- [ ] Finalize participant persistence requirements
- [ ] Enforce unique user/bet participation constraints
- [ ] Add required bet and participant constraints
- [ ] Implement bet status persistence
- [ ] Add database tests for create, join, and lock behavior

---

## Sprint 4 — Resolve and History

**Draft:** Oct 26, 2026

**Final:** Nov 2, 2026

**Increment:** The creator can resolve a bet and participants can see a stable outcome and history.

### Sprint 4 Backend/API work

- [ ] Define resolution authorization rules
- [ ] Implement Resolve Bet API
- [ ] Implement History API
- [ ] Implement server-side bet state transitions
- [ ] Prevent repeated resolution
- [ ] Add resolve and history endpoint tests

### Sprint 4 Database work

- [ ] Persist the final bet outcome
- [ ] Persist resolution timestamps if required
- [ ] Implement resolved-state persistence
- [ ] Make resolved outcomes stable and immutable
- [ ] Implement history ordering queries
- [ ] Implement history filtering queries
- [ ] Verify resolved bet data remains available
- [ ] Add database tests for resolution and history behavior

---

## Sprint 5 — Quality and Release Candidate

**Draft:** Nov 9, 2026

**Final:** Nov 16, 2026

**Increment:** The core journey is complete, hardened, accessible, and free of critical defects.

### Backend hardening

- [ ] Improve request validation
- [ ] Harden authorization checks
- [ ] Improve safe standardized error handling
- [ ] Improve logging
- [ ] Improve runtime configuration
- [ ] Add malformed-input tests
- [ ] Add forbidden-action tests
- [ ] Run full backend regression tests
- [ ] Fix critical backend defects

### Sprint 5 Database hardening

- [ ] Add needed SQLite constraints
- [ ] Add needed SQLite indexes
- [ ] Improve migration and schema-change tooling
- [ ] Improve seed tooling
- [ ] Improve reset tooling
- [ ] Add database recovery tooling
- [ ] Verify clean migration and rebuild behavior
- [ ] Test constraints, reset, and recovery paths

---

## Sprint 6 — Release

**Draft:** Nov 30, 2026

**Final:** Dec 7, 2026

**Increment:** Freeze a reproducible final build with demo/reset/fallback tooling and final regression evidence.

### Backend release configuration

- [ ] Finalize backend startup configuration
- [ ] Finalize runtime environment configuration
- [ ] Finalize health checks
- [ ] Finalize release-safe error behavior
- [ ] Freeze the API except for release-blocking fixes
- [ ] Verify backend setup from a clean environment
- [ ] Run final backend smoke tests
- [ ] Run final backend regression tests
- [ ] Fix remaining release-blocking backend issues

### Release database tooling

- [ ] Finalize database migration and schema initialization
- [ ] Finalize database file location
- [ ] Finalize seed and demo data behavior
- [ ] Finalize database reset behavior
- [ ] Verify persistence
- [ ] Finalize recovery procedures
- [ ] Verify clean database setup
- [ ] Run final database smoke and regression tests

### Final integration verification

- [ ] Run the complete MVP workflow
- [ ] Verify frontend/backend integration
- [ ] Verify backend/database integration
- [ ] Verify clean setup from a fresh environment
- [ ] Document fallback launch and recovery procedures
- [ ] Complete final regression evidence
- [ ] Freeze a reproducible release build

---
