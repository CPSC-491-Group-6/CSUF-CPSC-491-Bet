# Bet Project Backend

This directory contains the Node.js/Express backend and SQLite persistence layer for the Bet project.

This README is the primary **backend setup and developer onboarding guide**.

Detailed technical documentation is stored in [`docs/`](docs/), while [`backend.md`](backend.md) is used for sprint implementation tracking, acceptance criteria, and peer-review status.

---

## Requirements

The backend is designed to run inside the provided VS Code Dev Container.

Current backend technologies include:

- Node.js 24
- npm
- Express
- SQLite
- `better-sqlite3`
- `dotenv`
- Argon2id password hashing
- `express-session`
- SQLite-backed server-side sessions
- Zod input validation
- Supertest integration testing
- ESLint
- Prettier

The backend uses port:

```text
3000
```

by default.

---

## Initial setup

From the repository root, enter the backend directory:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

---

## Environment configuration

Create a local `.env` file from the tracked example:

```bash
cp .env.example .env
```

The backend expects:

```env
PORT=3000
DB_PATH=./data/bet.db
NODE_ENV=development
SESSION_SECRET=replace-with-a-random-session-secret
```

Generate a secure development session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the generated value into:

```env
SESSION_SECRET=<generated-value>
```

Do not commit the real `.env` file or its `SESSION_SECRET`.

The backend validates required environment configuration during startup and will fail early when critical values are missing or invalid.

---

## Database setup

The normal development database is:

```text
backend/data/bet.db
```

The database file and SQLite WAL files are ignored by Git.

## Initialize the database

Create the SQLite database and schema without deleting existing data:

```bash
npm run db:init
```

This creates the current backend tables if they do not already exist.

Current tables include:

```text
users
bets
participants
sessions
```

---

## Seed demo data

The backend includes a dedicated development seed command:

```bash
npm run db:seed
```

The seed script:

- initializes the database if necessary,
- creates predictable development users,
- hashes demo passwords using Argon2id,
- skips accounts that already exist,
- does not create authentication sessions,
- refuses to run when `NODE_ENV=production`.

The default demo accounts are:

```text
Creator account
Email:    creator@example.com
Password: DemoPassword123!

Participant account
Email:    participant@example.com
Password: DemoPassword123!
```

Only the Argon2id password hash is stored in SQLite.

Running the seed command again is safe:

```bash
npm run db:seed
```

Existing demo accounts will be skipped rather than duplicated.

---

## Reset the development database

Stop the backend server before resetting the database.

Reset the database to an empty initialized schema:

```bash
npm run db:reset
```

The reset command removes:

```text
data/bet.db
data/bet.db-wal
data/bet.db-shm
```

and then recreates the schema through the normal database initialization process.

The reset command:

- refuses to run in production,
- checks whether the backend port is currently in use,
- refuses to reset while the backend is running,
- recreates the database immediately after deletion.

---

## Reset and seed

For a predictable demonstration environment, reset the database and immediately create the demo accounts:

```bash
npm run db:reset:seed
```

This produces:

```text
Clean database schema
+
demo_creator
+
demo_participant
+
zero active sessions
```

This is the recommended command when preparing the backend for a demonstration.

---

## Start the backend

Development mode:

```bash
npm run dev
```

Normal startup:

```bash
npm start
```

The default development URL is:

```text
http://127.0.0.1:3000
```

Verify that the backend is running:

```bash
curl http://127.0.0.1:3000/health
```

Expected response:

```json
{
  "status": "ok"
}
```

---

## Login using the seeded demo data

The following examples assume you already ran:

```bash
npm run db:reset:seed
```

and have the backend running:

```bash
npm run dev
```

Use a second terminal for the following commands.

---

## Login as the demo creator

Run:

```bash
curl -i \
  -c creator-cookies.txt \
  -X POST \
  http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "creator@example.com",
    "password": "DemoPassword123!"
  }'
```

A successful response should return:

```text
HTTP/1.1 200 OK
```

and include a header similar to:

```text
Set-Cookie: sid=...; Path=/; HttpOnly; SameSite=Lax
```

The session cookie is saved to:

```text
creator-cookies.txt
```

---

## View the creator profile

Use the saved session cookie:

```bash
curl -i \
  -b creator-cookies.txt \
  http://127.0.0.1:3000/api/auth/me
```

Expected:

```text
HTTP/1.1 200 OK
```

with a response similar to:

```json
{
  "user": {
    "userID": 1,
    "username": "demo_creator",
    "email": "creator@example.com",
    "verificationStatus": 0,
    "timeStamp": "..."
  }
}
```

---

## Logout the demo creator

Run:

```bash
curl -i \
  -b creator-cookies.txt \
  -c creator-cookies.txt \
  -X POST \
  http://127.0.0.1:3000/api/auth/logout
```

Expected:

```text
HTTP/1.1 204 No Content
```

The server-side session is destroyed and the `sid` cookie is cleared.

Confirm logout:

```bash
curl -i \
  -b creator-cookies.txt \
  http://127.0.0.1:3000/api/auth/me
```

Expected:

```text
HTTP/1.1 401 Unauthorized
```

```json
{
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Authentication is required."
  }
}
```

---

## Login as the demo participant

Run:

```bash
curl -i \
  -c participant-cookies.txt \
  -X POST \
  http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "participant@example.com",
    "password": "DemoPassword123!"
  }'
```

Expected:

```text
HTTP/1.1 200 OK
```

The participant session is saved to:

```text
participant-cookies.txt
```

---

## View the participant profile

```bash
curl -i \
  -b participant-cookies.txt \
  http://127.0.0.1:3000/api/auth/me
```

Expected user:

```text
username: demo_participant
email: participant@example.com
```

---

## Logout the demo participant

```bash
curl -i \
  -b participant-cookies.txt \
  -c participant-cookies.txt \
  -X POST \
  http://127.0.0.1:3000/api/auth/logout
```

Expected:

```text
HTTP/1.1 204 No Content
```

---

## Recommended demo setup

For a completely predictable authentication demonstration:

## Terminal 1

From `backend/`:

```bash
npm run db:reset:seed
npm run dev
```

## Terminal 2

Login as the creator:

```bash
curl -i \
  -c creator-cookies.txt \
  -X POST \
  http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "creator@example.com",
    "password": "DemoPassword123!"
  }'
```

View the protected creator profile:

```bash
curl -i \
  -b creator-cookies.txt \
  http://127.0.0.1:3000/api/auth/me
```

Login as the participant:

```bash
curl -i \
  -c participant-cookies.txt \
  -X POST \
  http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "participant@example.com",
    "password": "DemoPassword123!"
  }'
```

View the protected participant profile:

```bash
curl -i \
  -b participant-cookies.txt \
  http://127.0.0.1:3000/api/auth/me
```

This gives two independently authenticated users, which will also be useful for Sprint 3 Create/Join Bet testing.

---

## Automatic authentication demonstration

The backend includes a repeatable Sprint 2 authentication demo:

```bash
npm run demo:auth
```

The script automatically:

1. checks whether the backend is healthy,
2. reuses an already-running backend when available,
3. starts a temporary backend when necessary,
4. generates a unique demo user,
5. registers the user,
6. logs in,
7. saves the session cookie,
8. accesses `/api/auth/me`,
9. logs out,
10. confirms `/api/auth/me` returns `401`,
11. stops the backend only if the script started it.

Expected flow:

```text
register
→ login
→ authenticated /me
→ logout
→ rejected /me
```

If port `3000` is already occupied unexpectedly, inspect it with:

```bash
ss -ltnp | grep ':3000'
```

---

## Authentication endpoints

| Method | Route                | Authentication | Purpose                                   |
| ------ | -------------------- | -------------- | ----------------------------------------- |
| `POST` | `/api/auth/register` | Public         | Create a user account                     |
| `POST` | `/api/auth/login`    | Public         | Verify credentials and create a session   |
| `GET`  | `/api/auth/me`       | Required       | Retrieve the authenticated user's profile |
| `POST` | `/api/auth/logout`   | Required       | Destroy the current session               |
| `GET`  | `/health`            | Public         | Verify backend availability               |

Detailed request and response documentation:

[`docs/authentication-api.md`](docs/authentication-api.md)

---

## Authentication architecture

Sprint 2 currently uses:

```text
Argon2id
+
server-side sessions
+
SQLite session persistence
+
HttpOnly sid cookie
```

The browser stores only the opaque signed session identifier.

Authenticated state is stored server-side.

Current session state contains only:

```text
userID
```

Cookie configuration includes:

```text
HttpOnly
SameSite=Lax
Secure in production
24-hour maximum age
```

Protected routes use reusable authentication middleware.

Detailed architecture:

[`docs/authentication-design.md`](docs/authentication-design.md)

---

## Run tests

Run all backend tests:

```bash
npm test
```

Run tests continuously:

```bash
npm run test:watch
```

Run authentication-related tests:

```bash
npm run test:auth
```

Run only the health test:

```bash
npm run test:health
```

Testing details:

[`docs/testing.md`](docs/testing.md)

---

## Code quality

Run ESLint:

```bash
npm run lint
```

Automatically format supported files:

```bash
npm run format
```

Check formatting without modifying files:

```bash
npm run format:check
```

Run ESLint and automatically format selected files:

```bash
npm run format:lint
```

A normal pre-PR verification sequence is:

```bash
npm run format:lint
npm test
```

---

## Current npm commands

```text
npm start
    Start the backend normally.

npm run dev
    Start the backend using Node.js watch mode.

npm run db:init
    Initialize the SQLite schema without deleting existing data.

npm run db:seed
    Add predictable development demo accounts.

npm run db:reset
    Delete the local SQLite database and recreate an empty schema.

npm run db:reset:seed
    Reset the database and immediately populate demo accounts.

npm test
    Run the complete backend automated test suite.

npm run test:watch
    Run tests continuously while developing.

npm run test:auth
    Run authentication-related automated tests.

npm run test:health
    Run the automated health endpoint test.

npm run demo:auth
    Run the complete live Sprint 2 authentication demonstration.

npm run lint
    Run ESLint.

npm run format
    Format supported backend files.

npm run format:check
    Verify formatting without modifying files.
```

---

## Database documentation

SQLite schema, constraints, relationships, session persistence, reset behavior, and seed behavior are documented in:

[`docs/database.md`](docs/database.md)

---

## Sprint tracking

[`backend.md`](backend.md) is the authoritative backend sprint tracking document.

It records:

- planned work,
- completed work,
- sprint acceptance criteria,
- peer-review status,
- and future sprint deliverables.

Technical implementation details should be maintained in this README or the focused files inside `docs/`, rather than duplicated throughout `backend.md`.

---

## Documentation map

| Document                                                         | Purpose                                                         |
| ---------------------------------------------------------------- | --------------------------------------------------------------- |
| [`README.md`](README.md)                                         | Backend setup and developer onboarding                          |
| [`backend.md`](backend.md)                                       | Sprint deliverables, progress, acceptance criteria, peer review |
| [`docs/authentication-api.md`](docs/authentication-api.md)       | Authentication HTTP contract and examples                       |
| [`docs/authentication-design.md`](docs/authentication-design.md) | Authentication architecture and security decisions              |
| [`docs/database.md`](docs/database.md)                           | SQLite schema, constraints, relationships, and persistence      |
| [`docs/testing.md`](docs/testing.md)                             | Automated tests, demo verification, and test conventions        |
