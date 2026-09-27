# Backend Testing

This document describes how backend automated tests are organized and how to reproduce Sprint 2 authentication verification.

Sprint status and acceptance criteria are tracked in [`../backend.md`](../backend.md).

## Test runner

The backend uses Node.js's built-in test runner:

```text
node --test
```

HTTP integration tests use:

```text
supertest
```

## Main commands

Run the full backend suite:

```bash
npm test
```

Run tests continuously:

```bash
npm run test:watch
```

Run the authentication-focused suite:

```bash
npm run test:auth
```

Run only the health endpoint test:

```bash
npm run test:health
```

Run the live Sprint 2 authentication demonstration:

```bash
npm run demo:auth
```

## Test layers

The backend intentionally tests authentication at several layers.

### Password service tests

Verify:

- Argon2id hashes are created,
- correct passwords verify successfully,
- incorrect passwords fail verification.

These tests use the real Argon2id implementation.

### User repository tests

Verify:

- user creation,
- lookup by `userID`,
- lookup by email,
- lookup by username,
- missing-user behavior,
- duplicate email rejection,
- duplicate username rejection,
- case-insensitive email behavior,
- case-insensitive username behavior.

Repository tests use isolated in-memory SQLite.

### Authentication service tests

Verify business logic independently of HTTP:

- registration success,
- registration validation,
- password hashing before persistence,
- duplicate email,
- duplicate username,
- successful credential verification,
- bad password,
- missing account,
- generic invalid-credential behavior,
- safe user objects that exclude password data.

These tests may use deterministic fake password services where the Argon2 implementation itself is not the subject of the test.

### Registration endpoint tests

Verify the real HTTP path:

```text
POST /api/auth/register
```

Coverage includes:

- `201` successful registration,
- normalized email behavior,
- safe response fields,
- persisted password hash rather than plaintext,
- validation failure,
- duplicate email,
- duplicate username,
- standardized errors,
- safe handling of unexpected internal errors.

### Login endpoint tests

Verify:

```text
POST /api/auth/login
```

Coverage includes:

- successful login,
- case-insensitive email lookup,
- bad password,
- missing account,
- malformed request,
- registration followed by login,
- session creation,
- no session on failed login.

### Session store tests

Verify the custom SQLite store:

- save/load,
- destroy,
- expiration,
- expired-session cleanup.

### Protected authentication tests

Verify:

```text
GET /api/auth/me
POST /api/auth/logout
```

Coverage includes:

- `/me` rejects missing authentication,
- `/me` returns the current profile,
- responses exclude password data,
- logout destroys SQLite session state,
- logout clears the session cookie,
- logged-out requests cannot access `/me`,
- logout requires authentication,
- stale sessions are invalidated when their user record no longer exists.

### Health test

Verify:

```text
GET /health
```

returns:

```json
{
  "status": "ok"
}
```

## Test isolation

Tests should never rely on or modify the developer's real database.

Authentication/database integration tests use:

```text
new Database(":memory:")
```

Each test context creates an isolated schema and closes it afterward.

This keeps tests:

- repeatable,
- independent,
- fast,
- safe to run in any order.

## Dependency injection

Factories allow tests to substitute isolated dependencies:

```text
createUserRepository(database)
createAuthService({ userRepository, passwordService })
createApp({ authService, sessionMiddleware })
```

This keeps production configuration out of unit/integration tests.

## Real Argon2id versus test password fakes

The real Argon2id implementation is tested directly in password-service tests.

Higher-level service/HTTP tests may use deterministic password fakes such as:

```text
hashed:<password>
```

This keeps endpoint tests fast and makes it clear whether a failure belongs to HTTP/business logic rather than the cryptographic library.

The live demo exercises the real production password service.

## Authentication demo

Run:

```bash
npm run demo:auth
```

The script:

1. checks `GET /health`,
2. reuses an already-running healthy backend, or starts a temporary one,
3. generates unique demo credentials,
4. registers the user,
5. logs in and stores the `sid` cookie,
6. accesses `/api/auth/me`,
7. logs out,
8. confirms `/api/auth/me` now returns `401`,
9. stops only the temporary backend process it started.

Expected high-level result:

```text
register          → 201
login             → 200 + Set-Cookie
authenticated /me → 200
logout            → 204
logged-out /me    → 401 AUTH_REQUIRED
```

## Useful manual checks

Full test and quality pass:

```bash
npm run format
npm run lint
npm test
```

Initialize and start manually:

```bash
npm run db:init
npm run dev
```

Health:

```bash
curl http://127.0.0.1:3000/health
```

Inspect a process occupying port `3000`:

```bash
ss -ltnp | grep ':3000'
```

## Evidence capture

For sprint evidence, useful captures include:

- successful `npm test`,
- successful `npm run lint`,
- successful `npm run format:check`,
- `npm run demo:auth` showing the full request sequence,
- PR/review link,
- relevant commits,
- Jira completion,
- peer review approval.

The test/demo output should support the claims recorded in `backend.md` rather than replacing the implementation evidence in Git.
