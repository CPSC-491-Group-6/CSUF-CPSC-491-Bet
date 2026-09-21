# Bet Project Backend

This directory contains the Node.js/Express backend and SQLite persistence layer for the Bet project.

This README is the primary **setup and developer onboarding guide**. Detailed technical references live in [`docs/`](docs/), while [`backend.md`](backend.md) tracks sprint deliverables, acceptance criteria, peer review, and remaining work.

## Requirements

The backend is designed to run in the provided VS Code Dev Container.

Current project environment:

- Node.js 24
- npm
- SQLite 3
- Express
- `better-sqlite3`
- Argon2id password hashing
- SQLite-backed server-side sessions

The backend listens on port `3000` by default.

## Initial setup

From the repository root, open the backend Dev Container or enter the backend directory:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Create a local environment file from the tracked example:

```bash
cp .env.example .env
```

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the generated value into `.env` as `SESSION_SECRET`.

Example:

```env
PORT=3000
DB_PATH=./data/bet.db
NODE_ENV=development
SESSION_SECRET=replace-with-a-random-secret
```

`SESSION_SECRET` is required and must not be committed to Git.

## Initialize the database

Create the local SQLite schema:

```bash
npm run db:init
```

The normal development database is:

```text
backend/data/bet.db
```

The generated database and SQLite WAL files are excluded from Git.

## Start the backend

Development mode:

```bash
npm run dev
```

Normal startup:

```bash
npm start
```

The default server address is:

```text
http://127.0.0.1:3000
```

Verify the backend:

```bash
curl http://127.0.0.1:3000/health
```

Expected response:

```json
{
  "status": "ok"
}
```

## Run tests

Run the full backend test suite:

```bash
npm test
```

Run authentication-focused tests:

```bash
npm run test:auth
```

Run only the health test:

```bash
npm run test:health
```

Run tests continuously while developing:

```bash
npm run test:watch
```

See [`docs/testing.md`](docs/testing.md) for test organization and coverage.

## Run the Sprint 2 authentication demo

The authentication demo automatically checks whether the backend is already running.

If no healthy backend is available, it starts a temporary backend, performs the demo, and stops the temporary process afterward.

```bash
npm run demo:auth
```

The demo verifies:

```text
register
→ login
→ authenticated /me
→ logout
→ rejected /me
```

If another process is already using port `3000`, inspect it with:

```bash
ss -ltnp | grep ':3000'
```

## Code quality

Run ESLint:

```bash
npm run lint
```

Format supported files:

```bash
npm run format
```

Verify formatting without changing files:

```bash
npm run format:check
```

## Current authentication endpoints

| Method | Route                | Authentication | Purpose                                             |
| ------ | -------------------- | -------------- | --------------------------------------------------- |
| `POST` | `/api/auth/register` | Public         | Create a user account                               |
| `POST` | `/api/auth/login`    | Public         | Verify credentials and create a server-side session |
| `GET`  | `/api/auth/me`       | Required       | Return the authenticated user's profile             |
| `POST` | `/api/auth/logout`   | Required       | Destroy the server-side session                     |
| `GET`  | `/health`            | Public         | Verify that the backend is running                  |

Detailed request/response examples are documented in [`docs/authentication-api.md`](docs/authentication-api.md).

## Authentication architecture

Sprint 2 uses:

- Argon2id for password hashing
- `express-session` for session management
- SQLite for session persistence
- an HttpOnly `sid` cookie containing only the opaque signed session identifier
- `SameSite=Lax`
- `Secure` cookies in production
- `req.session.userID` as the minimal authenticated session state
- reusable `requireAuth` middleware for protected routes

See [`docs/authentication-design.md`](docs/authentication-design.md).

## Database documentation

Database schema, constraints, relationships, initialization behavior, and session persistence are documented in:

[`docs/database.md`](docs/database.md)

## Project tracking

[`backend.md`](backend.md) is the backend sprint tracking document.

It records:

- the revised semester timeline,
- completed and remaining sprint work,
- acceptance criteria,
- peer review status,
- and open work that belongs to later sprints.

Technical setup and reference material should be kept in this README or `docs/` rather than duplicated in `backend.md`.

## Documentation map

| Document                                                         | Purpose                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------- |
| [`README.md`](README.md)                                         | Backend setup and developer onboarding                     |
| [`backend.md`](backend.md)                                       | Sprint deliverables and implementation tracking            |
| [`docs/authentication-api.md`](docs/authentication-api.md)       | Authentication HTTP contract and examples                  |
| [`docs/authentication-design.md`](docs/authentication-design.md) | Authentication architecture and security decisions         |
| [`docs/database.md`](docs/database.md)                           | SQLite schema, constraints, relationships, and persistence |
| [`docs/testing.md`](docs/testing.md)                             | Automated tests, demo verification, and test conventions   |
