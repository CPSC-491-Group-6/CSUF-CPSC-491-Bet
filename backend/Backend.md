# Bet Project Backend Documentation

## TOC

- [Bet Project Backend Documentation](#bet-project-backend-documentation)
  - [TOC](#toc)
  - [Purpose](#purpose)
    - [Project structure](#project-structure)
    - [Three-tier architecture](#three-tier-architecture)
    - [Presentation layer](#presentation-layer)
    - [Application logic layer](#application-logic-layer)
    - [Data layer](#data-layer)
  - [Development environment](#development-environment)
    - [Dev Container responsibilities](#dev-container-responsibilities)
  - [Backend dependencies](#backend-dependencies)
    - [Runtime dependencies](#runtime-dependencies)
      - [Node.js](#nodejs)
      - [Express](#express)
      - [`better-sqlite3`](#better-sqlite3)
      - [`dotenv`](#dotenv)
  - [Development dependencies](#development-dependencies)
    - [ESLint](#eslint)
    - [Prettier](#prettier)
    - [`@eslint/js`](#eslintjs)
    - [`globals`](#globals)
  - [Environment configuration](#environment-configuration)
  - [Git exclusions](#git-exclusions)
  - [Backend application entry point](#backend-application-entry-point)
  - [Health endpoint](#health-endpoint)
  - [Main backend flow](#main-backend-flow)
  - [Shared project variable names](#shared-project-variable-names)
    - [User-related variables](#user-related-variables)
    - [Bet-related variables](#bet-related-variables)
    - [Participant-related variables](#participant-related-variables)
  - [Bet status lifecycle](#bet-status-lifecycle)
  - [REST API plan](#rest-api-plan)
  - [SQLite configuration](#sqlite-configuration)
  - [Database initialization](#database-initialization)
  - [Preliminary SQLite schema](#preliminary-sqlite-schema)
    - [`users`](#users)
      - [`users` Responsibilities](#users-responsibilities)
      - [`users` Constraints](#users-constraints)
    - [`bets`](#bets)
      - [`bets` Responsibilities](#bets-responsibilities)
      - [`bets` Constraints](#bets-constraints)
    - [`participants`](#participants)
      - [Relationships](#relationships)
      - [Uniqueness rule](#uniqueness-rule)
    - [Database relationships](#database-relationships)
    - [Repository layer](#repository-layer)
    - [Frontend/backend handoff](#frontendbackend-handoff)
    - [Backend/database handoff](#backenddatabase-handoff)
  - [Code quality and formatting](#code-quality-and-formatting)
  - [Local backend startup procedure](#local-backend-startup-procedure)
  - [Verified database reset procedure](#verified-database-reset-procedure)
  - [Current npm commands](#current-npm-commands)
  - [Open design decisions](#open-design-decisions)
  - [Sprint implementation tracking](#sprint-implementation-tracking)
    - [Revised semester timeline](#revised-semester-timeline)
    - [Sprint 1 — Planning + Code Skeleton](#sprint-1--planning--code-skeleton)
      - [Shared planning and architecture work](#shared-planning-and-architecture-work)
      - [Backend/API code skeleton](#backendapi-code-skeleton)
      - [SQLite code skeleton](#sqlite-code-skeleton)
      - [Development tooling](#development-tooling)
    - [Sprint 1 acceptance criteria](#sprint-1-acceptance-criteria)
  - [Sprint 2 — Accounts](#sprint-2--accounts)
    - [Backend/API work](#backendapi-work)
    - [Database work](#database-work)
  - [Sprint 3 — Create and Join Bets](#sprint-3--create-and-join-bets)
    - [Bet API work](#bet-api-work)
    - [Join / participant / lock work](#join--participant--lock-work)
  - [Sprint 4 — Resolve and History](#sprint-4--resolve-and-history)
    - [Backend/API work](#backendapi-work-1)
    - [Database work](#database-work-1)
  - [Sprint 5 — Quality and Release Candidate](#sprint-5--quality-and-release-candidate)
    - [Backend hardening](#backend-hardening)
    - [Database hardening](#database-hardening)
  - [Sprint 6 — Release](#sprint-6--release)
    - [Backend release configuration](#backend-release-configuration)
    - [Release database tooling](#release-database-tooling)
    - [Final integration verification](#final-integration-verification)

## Purpose

This document describes the planned and currently implemented backend architecture for the Bet project.

It serves as the main reference for:

- backend structure,
- development environment,
- REST API design,
- SQLite database design,
- repository/database boundaries,
- shared variable names,
- bet lifecycle rules,
- frontend/backend/database handoffs,
- project dependencies,
- local startup procedures,
- and implementation progress across Sprints 1–6.

The backend is developed separately from the UI/UX while remaining part of the same Git repository.

---

### Project structure

The repository is organized approximately as:

```text
/Main
├── .gitignore
├── backend/
│   ├── .devcontainer/
│   │   ├── devcontainer.json
│   │   └── Dockerfile
│   ├── .vscode/
│   │   ├── extensions.json
│   │   └── settings.json
│   ├── data/
│   │   └── bet.db
│   ├── src/
│   │   ├── config/
│   │   │   └── env.js
│   │   ├── controllers/
│   │   ├── db/
│   │   │   ├── database.js
│   │   │   └── init.js
│   │   ├── middleware/
│   │   ├── repositories/
│   │   ├── routes/
│   │   │   └── health.js
│   │   └── server.js
│   ├── .env
│   ├── .env.example
│   ├── .nvmrc
│   ├── .prettierignore
│   ├── .prettierrc
│   ├── eslint.config.mjs
│   ├── package.json
│   └── package-lock.json
├── UI/
└── UX/
```

The `/backend` directory contains the Node.js REST API and SQLite integration.

The `/UI` and `/UX` directories are handled separately but communicate with the backend through HTTP API requests.

---

### Three-tier architecture

The project uses a three-tier architecture.

```text
Frontend / Presentation Layer
React / Node-based UI
        |
        | HTTP / REST API
        v
Application Logic Layer
Node.js + Express Backend
        |
        | Repository functions
        v
Data Layer
SQLite Database
```

### Presentation layer

The frontend is responsible for:

- displaying the user interface,
- collecting user input,
- navigation,
- displaying bets and their current state,
- displaying participant information,
- and sending API requests to the backend.

The frontend should never access SQLite directly.

### Application logic layer

The Node.js backend is responsible for:

- REST API routes,
- authentication,
- authorization,
- request validation,
- bet creation,
- bet lifecycle rules,
- participant handling,
- result handling,
- error handling,
- and communication with the repository layer.

### Data layer

SQLite is responsible for persistent storage of:

- users,
- bets,
- participants,
- wagers,
- results,
- status information,
- and timestamps.

SQLite access should remain isolated behind repository/database functions.

---

## Development environment

The backend runs inside a VS Code Dev Container so team members can use a consistent Node.js and SQLite environment.

The development environment has been created and verified successfully.

Current verified versions:

```text
Node.js:  v24.19.0
npm:      11.17.0
SQLite:   3.40.1
```

The Dev Container uses Node.js 24 on Debian Bookworm.

The container also installs the SQLite command-line utility so the database can be inspected directly during development.

### Dev Container responsibilities

The Dev Container provides:

- Node.js,
- npm,
- SQLite CLI access,
- consistent Linux tooling,
- backend port forwarding,
- ESLint support,
- Prettier support,
- and a shared runtime environment for backend developers.

The Express API currently uses port:

```text
3000
```

---

## Backend dependencies

### Runtime dependencies

#### Node.js

Node.js provides the backend JavaScript runtime.

The project currently targets:

```text
Node.js 24
```

The expected major Node version is also documented in:

```text
backend/.nvmrc
```

#### Express

Express provides:

- HTTP routing,
- request handling,
- middleware support,
- JSON request parsing,
- and the REST API server.

#### `better-sqlite3`

`better-sqlite3` provides SQLite access from Node.js.

Database access should occur through database and repository modules rather than directly from route handlers.

#### `dotenv`

`dotenv` loads backend configuration values from:

```text
backend/.env
```

## Development dependencies

### ESLint

ESLint checks backend JavaScript for common programming errors and code-quality problems.

### Prettier

Prettier provides consistent formatting across backend source and configuration files.

### `@eslint/js`

Provides the standard recommended JavaScript lint rules used by the ESLint configuration.

### `globals`

Provides Node.js global definitions to ESLint.

---

## Environment configuration

The backend currently expects:

```env
PORT=3000
DB_PATH=./data/bet.db
NODE_ENV=development
```

Local values are stored in:

```text
backend/.env
```

The local `.env` file should not be committed to Git.

A version-controlled example is stored in:

```text
backend/.env.example
```

Environment variables are loaded through:

```text
backend/src/config/env.js
```

The rest of the backend should use the centralized configuration exported from this file instead of directly accessing `process.env` throughout the application.

---

## Git exclusions

The main repository `.gitignore` excludes backend-generated or machine-specific files such as:

```text
backend/node_modules/
backend/.env
backend/data/*.db
backend/data/*.db-shm
backend/data/*.db-wal
```

The following backend files should be committed:

```text
backend/package.json
backend/package-lock.json
backend/.env.example
backend/.nvmrc
backend/.devcontainer/
backend/.vscode/
backend/eslint.config.mjs
backend/.prettierrc
backend/.prettierignore
backend/src/
```

---

## Backend application entry point

The main Express application is:

```text
backend/src/server.js
```

The server currently:

- creates the Express application,
- enables JSON request parsing,
- mounts backend routes,
- reads the configured port,
- and starts the REST API server.

Development mode uses Node's built-in watch functionality.

```bash
npm run dev
```

Normal startup uses:

```bash
npm start
```

---

## Health endpoint

The first implemented API endpoint is:

```text
GET /health
```

The route implementation is:

```text
backend/src/routes/health.js
```

Expected response:

```json
{
  "status": "ok"
}
```

The endpoint can be tested with:

```bash
curl -s http://localhost:3000/health; echo
```

The health endpoint verifies that:

- the Dev Container is running,
- Node.js is available,
- Express has started,
- routing is working,
- and port forwarding is functioning.

The endpoint has been tested successfully.

---

## Main backend flow

The planned backend feature sequence is:

```text
Authentication
      ↓
Create / List
      ↓
Join / Lock
      ↓
Resolve / History
      ↓
Release
```

The primary MVP user flow is:

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

Backend and database implementation should prioritize supporting this path before optional functionality.

---

## Shared project variable names

Existing project variable names should remain consistent between documentation, API code, repository functions, and database design unless the team explicitly approves a change.

### User-related variables

- `userID`
- `username`

### Bet-related variables

- `betID`
- `creatorID`
- `minimumWager`
- `decision`
- `numberOfParticipants`
- `status`
- `timeStamp`

### Participant-related variables

- `betID`
- `userID`
- `username`
- `wager`
- `timeStamp`

`username` does not currently need to be stored directly in the `participants` table because it can be retrieved through the `userID` relationship with `users`.

---

## Bet status lifecycle

The planned lifecycle is:

```text
Draft
  ↓
Active
  ↓
Locked
  ↓
Resolved
  ↓
Archived
```

| Status     | Meaning                                                       |
| ---------- | ------------------------------------------------------------- |
| `Draft`    | Bet exists but is not yet available for participation         |
| `Active`   | Bet is open for participation                                 |
| `Locked`   | No new participants can join; the bet is waiting for a result |
| `Resolved` | A final `decision` has been recorded                          |
| `Archived` | The completed bet is retained as historical information       |

The backend is responsible for controlling these transitions.

The frontend should not be able to directly force an invalid `status` transition.

SQLite currently restricts the `status` column to these five values using a `CHECK` constraint.

---

## REST API plan

The following routes define the preliminary MVP API.

| Feature        | Method and route             | Purpose                             |
| -------------- | ---------------------------- | ----------------------------------- |
| Health         | `GET /health`                | Confirm that the backend is running |
| Authentication | `POST /api/auth/register`    | Create a user account               |
| Authentication | `POST /api/auth/login`       | Authenticate a user                 |
| Authentication | `GET /api/auth/me`           | Retrieve the authenticated user     |
| Create         | `POST /api/bets`             | Create a bet                        |
| List           | `GET /api/bets`              | Retrieve bets                       |
| Join           | `POST /api/bets/:id/join`    | Join an active bet                  |
| Lock           | `POST /api/bets/:id/lock`    | Prevent additional participation    |
| Resolve        | `POST /api/bets/:id/resolve` | Record the final result             |
| History        | `GET /api/history`           | Retrieve completed bet history      |

The API contract still needs to finalize:

- request fields,
- response fields,
- authentication requirements,
- authorization requirements,
- HTTP status codes,
- standardized error responses,
- and which identifiers are supplied through URL parameters, request bodies, or authenticated sessions.

---

## SQLite configuration

The SQLite connection is managed by:

```text
backend/src/db/database.js
```

The database path is loaded from:

```text
DB_PATH
```

The current local development database is:

```text
backend/data/bet.db
```

The database connection enables:

```text
foreign_keys = ON
```

so SQLite enforces defined foreign-key relationships.

SQLite is also configured to use:

```text
journal_mode = WAL
```

for improved read/write behavior.

The database file and SQLite WAL files should not be committed to Git.

---

## Database initialization

The preliminary schema is initialized through:

```text
backend/src/db/init.js
```

The initialization uses:

```sql
CREATE TABLE IF NOT EXISTS
```

so the initialization process can safely be run repeatedly without deleting existing tables.

The standard initialization command is:

```bash
npm run db:init
```

The initialization currently creates:

| `users`                                                                          | `bets`                                                                                          | `participants`                          |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------- |
| `userID`, `username`, `email`, `passwordHash`, `verificationStatus`, `timeStamp` | `betID`, `creatorID`, `minimumWager`, `decision`, `numberOfParticipants`, `status`, `timeStamp` | `betID`, `userID`, `wager`, `timeStamp` |

A clean local SQLite database has been deleted and successfully recreated using only this initialization command.

This confirms that developers do not need an existing `bet.db` file to establish the preliminary schema.

---

## Preliminary SQLite schema

### `users`

Current structure:

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

#### `users` Responsibilities

The table stores account-level information needed for authentication and user identification.

#### `users` Constraints

`userID`

```text
PRIMARY KEY
AUTOINCREMENT
```

`username`

```text
NOT NULL
UNIQUE
```

`email`

```text
NOT NULL
UNIQUE
```

`passwordHash`

```text
NOT NULL
```

`verificationStatus`

```text
NOT NULL
DEFAULT 0
```

`timeStamp`

```text
NOT NULL
DEFAULT CURRENT_TIMESTAMP
```

---

### `bets`

Current structure:

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

#### `bets` Responsibilities

The table stores the primary state and configuration of each bet.

#### `bets` Constraints

`betID`

```text
PRIMARY KEY
AUTOINCREMENT
```

`creatorID`

```text
NOT NULL
FOREIGN KEY → users.userID
```

`minimumWager`

```text
NOT NULL
DEFAULT 0
```

`decision`

May remain empty until the bet is resolved.

`numberOfParticipants`

```text
NOT NULL
DEFAULT 0
```

The team still needs to decide whether this value should remain stored or instead be calculated from the `participants` table.

`status`

```text
NOT NULL
DEFAULT 'Draft'
```

Allowed values:

```text
Draft
Active
Locked
Resolved
Archived
```

`timeStamp`

```text
NOT NULL
DEFAULT CURRENT_TIMESTAMP
```

---

### `participants`

Current structure:

```text
participants
------------
betID
userID
wager
timeStamp
```

`username` is intentionally not duplicated in this table.

It can be retrieved through:

```text
participants.userID
        ↓
users.userID
        ↓
users.username
```

#### Relationships

```text
participants.betID
        ↓
bets.betID
```

and:

```text
participants.userID
        ↓
users.userID
```

#### Uniqueness rule

The table uses:

```text
PRIMARY KEY (betID, userID)
```

This prevents a particular `userID` from joining the same `betID` more than once.

---

### Database relationships

The current relationships are:

```text
bets.creatorID
    → users.userID

participants.userID
    → users.userID

participants.betID
    → bets.betID
```

These foreign-key relationships have been created and verified directly through SQLite.

The relationship verification used:

```bash
sqlite3 data/bet.db "PRAGMA foreign_key_list(bets);"
sqlite3 data/bet.db "PRAGMA foreign_key_list(participants);"
```

The table structures, primary keys, defaults, uniqueness constraints, and `status` constraint have also been inspected directly using SQLite.

---

### Repository layer

Raw SQLite operations should not be spread throughout Express route handlers.

The intended backend flow is:

```text
Route
  ↓
Controller
  ↓
Repository
  ↓
SQLite
```

For example:

```text
GET /api/bets/:id
        ↓
Bet controller
        ↓
getBetByID(betID)
        ↓
SQLite SELECT
```

Possible repository functions include:

```text
getUserByID()
getUserByEmail()
getUserByUsername()
createUser()

createBet()
getBetByID()
listBetsByUser()
listActiveBets()

addParticipant()

lockBet()
resolveBet()

getHistoryByUser()
```

Repository functions should accept application-level variables such as:

```text
userID
betID
creatorID
minimumWager
wager
status
decision
```

and hide the underlying SQL implementation from controllers and routes.

---

### Frontend/backend handoff

The frontend communicates with the backend through the REST API.

For each endpoint, frontend and backend developers should agree on:

```text
HTTP method
route
request fields
response fields
authentication requirement
authorization requirement
possible errors
```

The frontend should pass application identifiers such as:

```text
userID
betID
```

according to the agreed API contract.

The frontend should not:

- execute SQL,
- open SQLite directly,
- directly modify database state,
- or directly control bet lifecycle transitions.

---

### Backend/database handoff

Controllers and routes should request data through repository functions.

Repository functions are responsible for:

- prepared SQLite statements,
- `INSERT` operations,
- `SELECT` operations,
- `UPDATE` operations,
- relationship queries,
- database constraint handling,
- and converting database results into application-friendly objects.

This keeps SQLite-specific implementation details isolated from HTTP/API logic.

---

## Code quality and formatting

Backend JavaScript is checked using ESLint.

Run:

```bash
npm run lint
```

Formatting is managed by Prettier.

Automatically format supported files:

```bash
npm run format
```

Check formatting without making changes:

```bash
npm run format:check
```

The current backend passes both:

```text
ESLint: PASS
Prettier: PASS
```

Shared editor configuration is stored in:

```text
backend/.vscode/settings.json
backend/.vscode/extensions.json
```

---

## Local backend startup procedure

From inside:

```text
/Main/backend
```

install dependencies when needed:

```bash
npm install
```

Initialize the local SQLite database:

```bash
npm run db:init
```

Start the development server:

```bash
npm run dev
```

In another terminal, verify the API:

```bash
curl -s http://localhost:3000/health; echo
```

Expected response:

```json
{ "status": "ok" }
```

Optionally verify code quality:

```bash
npm run lint
npm run format:check
```

---

## Verified database reset procedure

The generated development database can be removed with:

```bash
rm -f data/bet.db data/bet.db-shm data/bet.db-wal
```

The schema can then be recreated with:

```bash
npm run db:init
```

Verify the created tables with:

```bash
sqlite3 data/bet.db ".tables"
```

Expected tables:

```text
bets          participants          users
```

This procedure has been tested successfully.

It verifies that the preliminary SQLite database can be recreated without requiring an existing database file.

---

## Current npm commands

```text
npm start
    Start the backend normally.

npm run dev
    Start the backend using Node.js watch mode.

npm run db:init
    Create the SQLite database and preliminary schema if needed.

npm run lint
    Run ESLint against the backend.

npm run format
    Format supported backend files using Prettier.

npm run format:check
    Verify formatting without changing files.
```

---

## Open design decisions

The following decisions remain open:

- [ ] Final authentication/session approach
- [ ] Final Create Bet fields
- [ ] Final public/private bet behavior
- [ ] Exact rule for transitioning from `Draft` to `Active`
- [ ] Exact authorization rule for locking a bet
- [ ] Exact authorization rule for resolving a bet
- [ ] Exact format and allowed values for `decision`
- [ ] Whether `numberOfParticipants` should be stored or calculated
- [ ] Whether wagers should remain SQLite `REAL` values or use an integer representation
- [ ] Final history/archive behavior
- [ ] Required SQLite indexes
- [ ] Final database migration strategy
- [ ] Final seed/reset strategy
- [ ] Production SQLite database-file location
- [ ] Final standardized API error format

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
- [ ] Add dedicated seed command
- [ ] Add dedicated reset command

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
- [ ] The plan has been peer reviewed
- [ ] Review feedback has been incorporated
- [ ] Sprint 1 code has been approved through the required PR review workflow

---

## Sprint 2 — Accounts

**Draft:** Sep 21, 2026
**Final:** Sep 28, 2026

**Increment:** A user can register, log in, reach protected content, view a profile, and log out.

### Backend/API work

- [ ] Finalize authentication/session or token approach
- [ ] Implement user repository functions
- [ ] Implement `POST /api/auth/register`
- [ ] Implement `POST /api/auth/login`
- [ ] Implement `GET /api/auth/me`
- [ ] Implement logout/session or token invalidation behavior
- [ ] Add password hashing
- [ ] Add registration/login validation
- [ ] Add standardized authentication errors
- [ ] Add authentication middleware for protected endpoints
- [ ] Add endpoint tests for success and failure paths

### Database work

- [ ] Implement user persistence queries
- [ ] Enforce unique email behavior
- [ ] Confirm username uniqueness behavior
- [ ] Add authentication-related constraints and data helpers
- [ ] Add database tests for account persistence and constraints

---

## Sprint 3 — Create and Join Bets

**Draft:** Oct 5, 2026
**Final:** Oct 12, 2026

**Increment:** Two users can create, list, join, lock, and view a bet in the integrated MVP.

### Bet API work

- [ ] Finalize Create Bet fields
- [ ] Finalize production `bets` schema requirements
- [ ] Implement `createBet()`
- [ ] Implement `getBetByID()`
- [ ] Implement `listBetsByUser()`
- [ ] Implement `listActiveBets()` if required
- [ ] Implement `POST /api/bets`
- [ ] Implement `GET /api/bets`
- [ ] Implement get-bet/detail endpoint
- [ ] Add server-side validation and standardized errors
- [ ] Add automated create/list/get endpoint tests

### Join / participant / lock work

- [ ] Implement participant repository operations
- [ ] Implement join-code generation if required by the final API contract
- [ ] Implement `POST /api/bets/:id/join`
- [ ] Prevent duplicate `userID` / `betID` participation
- [ ] Validate `wager`
- [ ] Decide whether `numberOfParticipants` is stored or calculated
- [ ] Restrict joins to valid open/`Active` states
- [ ] Implement creator/owner authorization for locking
- [ ] Implement `POST /api/bets/:id/lock`
- [ ] Transition `status` from `Active` to `Locked`
- [ ] Prevent new participants after locking
- [ ] Add capacity, duplicate-participant, owner-only lock, and state-rule tests
- [ ] Add a repeatable reset/demo path for integrated testing

---

## Sprint 4 — Resolve and History

**Draft:** Oct 26, 2026
**Final:** Nov 2, 2026

**Increment:** The creator can resolve a bet and participants can see a stable outcome and history.

### Backend/API work

- [ ] Define resolution authorization rules
- [ ] Implement `resolveBet()`
- [ ] Implement `POST /api/bets/:id/resolve`
- [ ] Implement history retrieval
- [ ] Implement `GET /api/history`
- [ ] Enforce server-side state transitions
- [ ] Prevent repeated resolution
- [ ] Add resolve/history endpoint tests

### Database work

- [ ] Store the final outcome/`decision`
- [ ] Add resolved-at persistence if required by the final schema
- [ ] Transition `status` from `Locked` to `Resolved`
- [ ] Make resolved outcomes immutable
- [ ] Implement history ordering/filtering queries
- [ ] Define `Resolved` to `Archived` behavior
- [ ] Verify completed bet data remains available
- [ ] Add database tests for resolution and history behavior

---

## Sprint 5 — Quality and Release Candidate

**Draft:** Nov 9, 2026
**Final:** Nov 16, 2026

**Increment:** The core journey is complete, hardened, accessible, and free of critical defects.

### Backend hardening

- [ ] Strengthen request validation
- [ ] Review and harden authorization checks
- [ ] Finalize safe standardized error handling
- [ ] Review logging and runtime configuration
- [ ] Add malformed-input tests
- [ ] Add forbidden-action tests
- [ ] Run backend regression tests and fix critical defects

### Database hardening

- [ ] Add required SQLite indexes
- [ ] Finalize production constraints
- [ ] Improve migration/schema-change strategy
- [ ] Finalize seed tooling
- [ ] Finalize reset tooling
- [ ] Add database recovery/rebuild procedures
- [ ] Verify clean migration/rebuild behavior
- [ ] Test constraints, reset, and recovery paths

---

## Sprint 6 — Release

**Draft:** Nov 30, 2026
**Final:** Dec 7, 2026

**Increment:** Freeze a reproducible final build with demo/reset/fallback tooling and final regression evidence.

### Backend release configuration

- [ ] Finalize runtime environment configuration
- [ ] Verify setup from a clean Git checkout
- [ ] Finalize backend startup configuration
- [ ] Verify `GET /health` in the release environment
- [ ] Finalize release-safe error behavior
- [ ] Freeze the API except for release-blocking fixes
- [ ] Run complete backend smoke/regression tests

### Release database tooling

- [ ] Finalize migration/schema initialization procedure
- [ ] Finalize production database-file location
- [ ] Finalize seed/demo data
- [ ] Finalize database reset procedure
- [ ] Verify persistence checks
- [ ] Finalize recovery commands
- [ ] Verify clean setup, persistence, reset, and database smoke tests

### Final integration verification

- [ ] Run the complete MVP workflow
- [ ] Verify frontend/backend integration
- [ ] Verify backend/database integration
- [ ] Document fallback launch procedure
- [ ] Complete final regression evidence
- [ ] Freeze a reproducible release build
