# Backend Testing

This document describes how backend automated tests are organized and how to reproduce Sprint 2 authentication verification and SCRUM-489 Join/Lock API verification.

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

Run the SCRUM-489 Join/Lock integration tests:

```bash
node --test tests/bets/betParticipation.test.js
```

Run the existing Bet API regression tests:

```bash
node --test tests/bets/betApi.test.js
```

Run the shared backend CI script from the repository root:

```bash
./scripts/ci-backend.sh
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

### Bet API regression tests

File:

```text
tests/bets/betApi.test.js
```

These tests verify:

- bet creation assigns the authenticated session owner,
- generated join codes have the expected format,
- the creator is counted as a participant,
- new bets default to private visibility,
- invalid and client-controlled fields are rejected,
- My Bets remains scoped to the authenticated creator,
- public discovery excludes private bets and join codes,
- full public bets remain discoverable,
- join-code lookup is case-insensitive,
- join-code lookup handles invalid and unknown codes,
- bet API routes require authenticated sessions,
- the historical visibility migration defaults existing bets to private.

The test setup uses the applicable production bet migrations so the isolated database includes the answer-option and winning-outcome schema.

### SCRUM-489 Join and Lock API integration tests

File:

```text
tests/bets/betParticipation.test.js
```

This suite validates the implemented endpoints:

```text
POST /api/bets/join
POST /api/bets/:betId/lock
```

Both endpoints require an authenticated session.

Join requests use the bet's join code and may include `selected_option_id`. The authenticated user's ID comes from the session, not from client-supplied request data.

Lock requests require the authenticated user to be the bet creator.

#### Automated test cases

| Test ID | Test objective                  | Expected HTTP result | Verified persistence behavior                          |
| ------- | ------------------------------- | -------------------- | ------------------------------------------------------ |
| TC01    | Valid authenticated join        | 201                  | Participant membership is inserted and count increases |
| TC02    | Unknown join code               | 404                  | No participant inserted                                |
| TC03    | Duplicate join                  | 409                  | No duplicate participant row                           |
| TC04    | Full bet                        | 409                  | Capacity remains unchanged                             |
| TC05    | Join locked bet                 | 409                  | No participant inserted                                |
| TC06    | Unauthorized lock               | 403                  | Bet remains open                                       |
| TC07    | Valid creator lock              | 200                  | Status becomes `locked`; `locked_at` is populated      |
| TC08    | Repeated lock                   | 409                  | Previously stored state remains unchanged              |
| TC09    | Missing authentication          | 401                  | No join or lock changes                                |
| TC10    | Valid selected answer           | 201                  | `selected_option_id` is persisted                      |
| TC11    | Missing required answer         | 400                  | No participant inserted                                |
| TC12    | Answer belonging to another bet | 400                  | No participant inserted                                |
| TC13    | Case-insensitive join code      | 201                  | Participant membership is inserted                     |
| TC14    | Lock unknown bet                | 404                  | Existing bet remains unchanged                         |
| TC15    | Join/Lock database integrity    | 201 and 200          | Integrity check succeeds; no foreign-key violations    |

#### Join error contract

| Condition                | HTTP status | Error code         |
| ------------------------ | ----------- | ------------------ |
| Invalid join-code format | 400         | `VALIDATION_ERROR` |
| Unknown join code        | 404         | `BET_NOT_FOUND`    |
| Duplicate participation  | 409         | `ALREADY_JOINED`   |
| Full bet                 | 409         | `BET_FULL`         |
| Locked bet               | 409         | `BET_NOT_OPEN`     |
| Missing required answer  | 400         | `ANSWER_REQUIRED`  |
| Invalid answer option    | 400         | `INVALID_OPTION`   |
| Missing authentication   | 401         | `AUTH_REQUIRED`    |

#### Lock error contract

| Condition                | HTTP status | Error code        |
| ------------------------ | ----------- | ----------------- |
| Successful creator lock  | 200         | None              |
| Non-creator lock attempt | 403         | `NOT_BET_CREATOR` |
| Unknown bet              | 404         | `BET_NOT_FOUND`   |
| Already locked bet       | 409         | `BET_NOT_OPEN`    |
| Missing authentication   | 401         | `AUTH_REQUIRED`   |

#### Persistence assertions

The tests inspect database records instead of relying only on HTTP responses.

Successful joining must:

1. Insert exactly one participant relationship.
2. Associate the participant with the correct bet.
3. Store the selected answer when one is required.
4. Update the live participant count.
5. Leave the bet open until explicitly locked.

Successful locking must:

1. Preserve the bet's identity and creator.
2. Change `status` from `open` to `locked`.
3. Populate `locked_at`.
4. Preserve existing participant relationships.
5. Leave `winning_option_id` unset.

Rejected operations must not insert participants or change the bet state.

#### SQLite integrity verification

The suite checks:

```sql
PRAGMA integrity_check;
```

Expected:

```text
ok
```

It also checks:

```sql
PRAGMA foreign_key_check;
```

Expected:

```text
No rows
```

#### Test execution

From `backend/`:

```bash
node --check tests/bets/betParticipation.test.js
node --test tests/bets/betParticipation.test.js
```

Then execute the complete backend suite:

```bash
npm test
```

Run the repository's backend CI entry point:

```bash
cd ..
./scripts/ci-backend.sh
```

#### Verified local results

Evidence supplied from the SCRUM-489 development branch:

```text
Join/Lock integration tests:
tests:   15
passed:  15
failed:  0
skipped: 0
```

Complete backend test suite:

```text
tests:   102
passed:  92
failed:  0
skipped: 10
```

The ten skipped tests belong to the existing Sprint 3 Create Bet test file. They are not counted as successful executions.

Local backend CI completed with:

```text
[Backend] Checks passed.
```

The successful CI run included:

- retired database-path checks,
- tracked SQLite runtime-file checks,
- dependency installation,
- Prettier formatting validation,
- database initialization,
- initial seeding,
- repeatable seeding,
- database reset,
- seeding after reset,
- the complete backend test suite,
- CI database cleanup.

These results demonstrate successful local validation. GitHub-hosted CI and peer review must be recorded separately after the PR is opened.

#### Known scope boundaries

SCRUM-489 validates joining and creator-only locking.

The following work is not verified by these tests:

- Create Bet accepting and persisting creator-defined answer options through the HTTP API,
- final outcome resolution using `winning_option_id`,
- history retrieval,
- complete frontend-to-backend integration,
- a production database migration containing historical resolved bets.

Those operations require their own implementation or validation evidence.

## Test isolation

Tests should never rely on or modify the developer's real database.

Authentication/database integration tests use:

```text
new Database(":memory:")
```

Each test context creates an isolated schema and closes it afterward.

The Join/Lock integration tests also create a separate in-memory database, apply the relevant production bet migrations, insert deterministic test users and bets, and close the connection after testing.

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

Join/Lock tests also use:

```text
createBetRepository(database)
createBetParticipationRepository(database)
createBetService({ betRepository })
createBetParticipationService({ participationRepository })
```

The test application combines the bet service methods and injects an isolated session stub into `createApp()`.

Production authentication middleware remains active for endpoint authorization checks.

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

## Dependency security audit

Dependency security verification is separate from functional correctness.

Run from `backend/`:

```bash
npm audit --omit=dev
npm audit
```

During SCRUM-489 validation, the initial production audit identified three vulnerabilities:

- `body-parser`: high severity,
- `zod`: high severity,
- `qs`: moderate severity.

The initial full audit identified eight vulnerabilities: two high and six moderate.

After `npm audit fix`, npm reported five remaining moderate-severity findings associated with the ESLint/minimatch dependency chain. No high-severity findings remained in that reported audit.

These remaining findings require separate dependency-security review.

Do not use `npm audit fix --force` without evaluating its dependency and compatibility changes.

The complete backend CI suite must be rerun after any dependency changes before reporting them as validated.

## Evidence capture

For sprint evidence, useful captures include:

- successful `npm test`,
- successful `npm run lint`,
- successful `npm run format:check`,
- `npm run demo:auth` showing the full request sequence,
- successful SCRUM-489 Join/Lock integration tests,
- persisted participant answer selection,
- successful creator-only lock state transition,
- rejected join/lock attempts without partial database changes,
- SQLite integrity and foreign-key verification,
- successful `./scripts/ci-backend.sh`,
- dependency audit findings and remediation status,
- PR/review link,
- relevant commits,
- Jira completion,
- peer review approval.

The test/demo output should support the claims recorded in `backend.md` rather than replacing the implementation evidence in Git.
