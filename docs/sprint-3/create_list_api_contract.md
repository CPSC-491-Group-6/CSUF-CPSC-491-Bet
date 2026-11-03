# Sprint 3 — Create/List API Contract

**Owner:** Member C  
**Status:** Create/List and Join/Lock implemented; local tests passed; integration review and merge pending  
**Reviewers:** Member B (API), Member D (repository and authorization), frontend owner; Member E (database changes)  
**Related work:** SCRUM-489 — Join and Lock API

## 1. Overview

This document describes the implemented Create, List, Join, and Lock Bet API contracts. The original Sprint 3 Create/List interface has been extended to document the SCRUM-489 Join/Lock implementation.

| Method | Path                       | Authentication                 | Successful response                           |
| ------ | -------------------------- | ------------------------------ | --------------------------------------------- |
| `POST` | `/api/bets`                | Required session               | `201 Created` with `{ "bet": ... }`           |
| `GET`  | `/api/bets`                | Required session               | `200 OK` with `{ "bets": [...] }`             |
| `GET`  | `/api/bets/public`         | Required session               | `200 OK` with `{ "bets": [...] }`             |
| `GET`  | `/api/bets/code/:joinCode` | Required session               | `200 OK` with `{ "bet": ... }`                |
| `POST` | `/api/bets/join`           | Required session               | `201 Created` with `{ "participation": ... }` |
| `POST` | `/api/bets/:betId/lock`    | Required session; creator only | `200 OK` with `{ "bet": ... }`                |

The routes above are registered by `backend/src/routes/bets.js` through `createBetRouter()`.

The established authentication middleware reads `req.session.userID`. API code must never trust a client-provided owner or participant ID.

The current implementation supports:

- Authenticated bet creation and retrieval.
- Creator-scoped My Bets retrieval.
- Public bet discovery.
- Case-insensitive join-code lookup.
- Joining open bets using a join code.
- Participant capacity enforcement.
- Duplicate-participant rejection.
- Answer selection during joining.
- Creator-only locking.
- Persistent transition from `open` to `locked`.

The current Join/Lock implementation does not include final bet resolution, outcome calculation, or history retrieval.

## 2. Shared conventions

- JSON request/response bodies use `Content-Type: application/json`.
- The browser sends the existing session cookie using the project's current authentication mechanism; do not introduce separate client-managed tokens.
- The authenticated user ID is obtained from `req.session.userID`.
- Join and Lock operations use the existing `requireAuth` middleware.
- Database mutations are performed through repositories rather than directly through controllers.
- Errors use the existing `AppError` response shape.

Example validation error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid bet information.",
    "details": [
      {
        "field": "title",
        "message": "Bet title is required."
      }
    ]
  }
}
```

The `details` property is optional and should appear only when useful for safe validation feedback.

The Join/Lock error identifiers documented in Sections 8 and 9 correspond to the implemented service and locally passing automated tests.

Member B and the frontend owner should review the final request and response contracts before integration is considered complete.

### Session authentication

All documented bet routes require an authenticated session.

An unauthenticated request returns HTTP `401` with error code:

```text
AUTH_REQUIRED
```

The HTTP request body must not be allowed to override the session identity.

### Bet lifecycle

The currently supported persistent states are:

```text
open
  |
  v
locked
  |
  v
resolved
```

SCRUM-489 implements the transition:

```text
open → locked
```

The `resolved` state is represented by the database schema, but resolution is outside the Join/Lock API implementation.

Joining is only permitted while the bet is `open`.

### Participant capacity

The creator is inserted into `bet_participants` during Create Bet and counts toward `max_participants`.

For example:

```text
max_participants = 3

Creator       → 1 participant
First joiner  → 2 participants
Second joiner → 3 participants
Further joins → rejected with BET_FULL
```

The API derives the current participant count from `bet_participants`; clients cannot directly set that count.

## 3. POST /api/bets

### Request body

```json
{
  "title": "Lakers vs Celtics",
  "description": "Who wins the matchup?",
  "max_participants": 4,
  "visibility": "private"
}
```

| Field              | Type    | Required | Validation                                                         |
| ------------------ | ------- | -------- | ------------------------------------------------------------------ |
| `title`            | string  | Yes      | Existing Create Bet schema validation                              |
| `description`      | string  | No       | Existing Create Bet schema validation; defaults to an empty string |
| `max_participants` | integer | No       | 2–100; default `2`                                                 |
| `visibility`       | string  | No       | `public` or `private`; default `private`                           |

The current Create Bet implementation rejects attempts to provide client-controlled properties such as:

- `id`
- `creator_id`
- `join_code`
- `status`
- Lifecycle timestamps

The creator ID comes from the authenticated session. The server generates the bet ID and join code.

### Successful response (`201`)

Illustrative response:

```json
{
  "bet": {
    "id": "c4d2f1b8-4af1-4d75-8f86-8c44d40b4b20",
    "creator_id": 1,
    "title": "Lakers vs Celtics",
    "description": "Who wins the matchup?",
    "join_code": "A1B2C3D4E5F6",
    "status": "open",
    "visibility": "private",
    "max_participants": 4,
    "winning_option_id": null,
    "current_participants": 1,
    "created_at": "2026-10-09T19:00:00.000Z",
    "locked_at": null,
    "resolved_at": null
  }
}
```

Values above are illustrative, not a captured production response.

The obsolete `outcome_user_id` field has been replaced by `winning_option_id` in the updated database model.

New bets start in the `open` state and include the creator as their first participant.

### Error responses

| Scenario                       | Status                        | Contract expectation                                       |
| ------------------------------ | ----------------------------- | ---------------------------------------------------------- |
| Missing session                | `401`                         | `AUTH_REQUIRED`                                            |
| Missing/invalid required field | `400`                         | `VALIDATION_ERROR`                                         |
| Extra/forbidden field          | `400`                         | Reject client-controlled ownership or lifecycle properties |
| Join-code allocation failure   | Pending contract confirmation | Safe error response                                        |
| Unhandled database error       | `500`                         | Existing safe `INTERNAL_ERROR` convention                  |

The exact join-code allocation failure contract has not been established by SCRUM-489 and remains subject to API-owner review.

### Creator-defined answers

The database now contains a `bet_options` table for creator-defined answer options.

However, the existing Join/Lock tests do not prove that `POST /api/bets` accepts and persists an `options` array.

Creator-defined answer creation through the HTTP API remains an integration dependency owned through the agreed Create Bet and database workstreams.

Do not assume that sending an `options` array to this endpoint is supported until its interface and persistence behavior are implemented and verified.

## 4. GET /api/bets

### Request

No request body, owner query parameter, or user ID path parameter is required.

Identity comes from the authenticated session.

### Successful response (`200`)

Illustrative response:

```json
{
  "bets": [
    {
      "id": "c4d2f1b8-4af1-4d75-8f86-8c44d40b4b20",
      "creator_id": 1,
      "title": "Lakers vs Celtics",
      "description": "Who wins the matchup?",
      "join_code": "A1B2C3D4E5F6",
      "status": "open",
      "visibility": "private",
      "max_participants": 4,
      "winning_option_id": null,
      "current_participants": 1,
      "created_at": "2026-10-09T19:00:00.000Z",
      "locked_at": null,
      "resolved_at": null
    }
  ]
}
```

### Empty response (`200`)

```json
{
  "bets": []
}
```

### Query behavior

- Return bets where `bets.creator_id` matches the authenticated session's `userID`.
- Order by `created_at` descending, then by `id` descending.
- The current creator-scoped list does not automatically include every bet the user has joined.
- The current participant count is derived from `bet_participants`.
- Creator-scoped retrieval may include the join code; public discovery must not expose private join codes.

### Errors

| Scenario                         | Status | Contract expectation         |
| -------------------------------- | ------ | ---------------------------- |
| Missing/expired session          | `401`  | `AUTH_REQUIRED`              |
| Unhandled service/database error | `500`  | Safe internal error response |

### GET /api/bets/public

Returns publicly discoverable bets using the response wrapper:

```json
{
  "bets": []
}
```

The actual list can contain public bets, including bets that have reached capacity.

Public discovery must:

- Exclude private bets.
- Exclude join codes.
- Include the live participant count.
- Use deterministic ordering.
- Require an authenticated session under the current router.

### GET /api/bets/code/:joinCode

Retrieves a bet by its join code.

The lookup is case-insensitive, including for private bets.

Successful response:

```json
{
  "bet": {
    "id": "c4d2f1b8-4af1-4d75-8f86-8c44d40b4b20",
    "join_code": "A1B2C3D4E5F6",
    "status": "open",
    "visibility": "private",
    "max_participants": 4,
    "current_participants": 1
  }
}
```

This example shows relevant fields rather than a complete response projection.

| Condition              | HTTP  | Error              |
| ---------------------- | ----- | ------------------ |
| Valid join code        | `200` | None               |
| Invalid code format    | `400` | `VALIDATION_ERROR` |
| Unknown code           | `404` | `BET_NOT_FOUND`    |
| Missing authentication | `401` | `AUTH_REQUIRED`    |

## 5. Repository-to-API interface

The original Create/List repository interfaces remain relevant.

```javascript
/**
 * Store validated, server-authored bet data and return the stored row.
 * The creator is also inserted into bet_participants.
 * @param {object} betData - Includes session-derived creator_id.
 */
createBet(betData);

/**
 * Look up a bet by its generated identifier.
 * Public access must separately enforce access rules.
 * @param {string} betId - Generated bet ID.
 */
findById(betId);

/**
 * Retrieve bets belonging to the authenticated creator.
 * @param {number} creatorId - Session-derived user ID.
 */
findByCreatorId(creatorId);
```

SCRUM-489 adds the following participation operations:

```javascript
/**
 * Join an open bet using the supplied code.
 * Membership, capacity, and answer selection are validated
 * inside a SQLite transaction.
 *
 * @param {object} params
 * @param {string} params.joinCode
 * @param {number} params.userID
 * @param {string|null} params.selectedOptionID
 */
joinByCode(params);

/**
 * Lock an open bet only when the authenticated user
 * is its creator.
 *
 * @param {object} params
 * @param {string} params.betID
 * @param {number} params.userID
 */
lockById(params);
```

### Implemented architecture

```text
HTTP request
    |
    v
requireAuth
    |
    v
createBetParticipationController
    |
    v
createBetParticipationService
    |
    v
createBetParticipationRepository
    |
    v
SQLite transaction
    |
    v
JSON response or standardized error
```

Join and Lock repositories use immediate SQLite transactions.

This serializes competing writes and protects against inconsistent capacity or state changes when multiple requests occur close together.

### Persistence rules

A successful join:

1. Resolves the supplied join code.
2. Requires the bet to be open.
3. Rejects duplicate participation.
4. Validates the selected answer when options exist.
5. Rejects joining beyond capacity.
6. Inserts the authenticated participant.
7. Returns the new participant information and count.

A successful lock:

1. Finds the requested bet.
2. Confirms the authenticated user is its creator.
3. Requires the bet to be open.
4. Updates `status` to `locked`.
5. Stores `locked_at`.
6. Returns the updated bet.

Rejected operations must not partially modify persistent state.

## 6. Approval questions

The original contract began as a proposal. The following decisions are implemented and locally tested, but team approvals should not be considered complete without recorded review.

- [ ] Approve final endpoint paths and response wrappers (`bet`, `bets`, `participation`).
- [ ] Confirm title/description validation limits and unknown-field policy with Member B.
- [ ] Confirm ID/join-code generation ownership.
- [ ] Confirm creator auto-participation as an agreed product rule.
- [ ] Approve creator-scoped and public list field projections.
- [ ] Confirm final error codes and join-code collision behavior.
- [x] Validate implemented Join/Lock request and response behavior locally.
- [x] Validate duplicate participation and capacity rules locally.
- [x] Validate creator-only lock authorization locally.
- [x] Validate participant answer persistence locally.
- [ ] Capture and approve live session-authenticated request/response examples outside the test harness.
- [ ] Obtain Member E's review of the answer-option and outcome schema changes.
- [ ] Obtain Member D's authorization review.

The checked items are supported by the local automated test results. Unchecked items remain pending review or validation.

## 7. Review record

| Reviewer       | Decision / change request                          | Date |
| -------------- | -------------------------------------------------- | ---- |
| Member B       | Pending API contract confirmation                  |      |
| Member D       | Pending authorization/repository review            |      |
| Frontend owner | Pending integration review                         |      |
| Member E       | Pending database migration and answer-model review |      |

No approval, merge, or GitHub-hosted CI result is claimed in this document.

## 8. POST /api/bets/join

**Related Jira:** SCRUM-489 — Join and Lock API

### Purpose

Allow an authenticated user to join an open bet by submitting its generated join code and, where applicable, selecting one of the bet creator's available answer options.

### Request

```http
POST /api/bets/join
Content-Type: application/json
```

```json
{
  "join_code": "ABC123DEF456",
  "selected_option_id": "option-yes"
}
```

| Field                | Type           | Required    | Behavior                                                                                 |
| -------------------- | -------------- | ----------- | ---------------------------------------------------------------------------------------- |
| `join_code`          | string         | Yes         | Validated using the existing join-code schema; matched case-insensitively                |
| `selected_option_id` | string or null | Conditional | Required when the bet has defined options; otherwise optional for legacy optionless bets |

The authenticated participant ID comes from `req.session.userID`.

A request must not be able to select another user as the participant.

### Successful response (`201`)

Illustrative response based on the implemented controller and tested repository behavior:

```json
{
  "participation": {
    "bet_id": "test-bet-one",
    "user_id": 2,
    "selected_option_id": "option-yes",
    "current_participants": 2
  }
}
```

The response contains:

- The joined bet ID.
- The authenticated user ID.
- The saved selected option, if provided.
- The current participant count.

### Successful persistence

The new participant is stored in `bet_participants`.

```text
bet_participants
----------------
bet_id             = test-bet-one
user_id            = 2
selected_option_id = option-yes
```

The participant count is derived from stored membership records.

The join does not change the bet's lifecycle state.

### Error responses

| Condition                         | Status | Error code         | Persistent result             |
| --------------------------------- | ------ | ------------------ | ----------------------------- |
| Missing authentication            | `401`  | `AUTH_REQUIRED`    | No participant added          |
| Invalid join-code format          | `400`  | `VALIDATION_ERROR` | No participant added          |
| Unknown join code                 | `404`  | `BET_NOT_FOUND`    | No participant added          |
| Already participating             | `409`  | `ALREADY_JOINED`   | Existing membership unchanged |
| Bet at capacity                   | `409`  | `BET_FULL`         | No participant added          |
| Bet locked or otherwise not open  | `409`  | `BET_NOT_OPEN`     | No participant added          |
| Required answer missing           | `400`  | `ANSWER_REQUIRED`  | No participant added          |
| Invalid answer option             | `400`  | `INVALID_OPTION`   | No participant added          |
| Invalid selected-option ID format | `400`  | `VALIDATION_ERROR` | No participant added          |

Example duplicate-join error:

```json
{
  "error": {
    "code": "ALREADY_JOINED",
    "message": "You already joined this bet."
  }
}
```

Example full-bet error:

```json
{
  "error": {
    "code": "BET_FULL",
    "message": "This bet has reached capacity."
  }
}
```

### Answer-option validation

The database supports options stored in `bet_options`, each belonging to one bet.

When options exist:

- A valid option is required.
- The option must belong to the bet being joined.
- The selected option is stored in `bet_participants.selected_option_id`.
- Options belonging to another bet must be rejected.

For legacy bets without options, the current implementation allows joining without a selected answer.

This compatibility behavior is implemented and tested, but Member A and Member B should confirm it is consistent with the final product rules.

## 9. POST /api/bets/:betId/lock

**Related Jira:** SCRUM-489 — Join and Lock API

### Purpose

Allow the authenticated creator of an open bet to lock it against further joining.

### Request

```http
POST /api/bets/test-bet-one/lock
```

No JSON request body is required.

The bet is identified by the `betId` path parameter.

The user is identified through the authenticated session.

### Successful response (`200`)

Illustrative response:

```json
{
  "bet": {
    "id": "test-bet-one",
    "creator_id": 1,
    "status": "locked",
    "locked_at": "2026-11-02T12:00:00.000Z"
  }
}
```

The example shows the fields returned by the current lock operation. The timestamp is illustrative; the actual value is generated by SQLite when the bet is locked.

### Successful state transition

```text
Before:
status    = open
locked_at = null

After:
status    = locked
locked_at = non-null timestamp
```

The operation must:

- Preserve the bet's ID and creator.
- Preserve existing participants.
- Prevent subsequent joins.
- Leave `winning_option_id` unset.
- Store the locked state persistently.

### Authorization

Only the user whose session ID matches `bets.creator_id` may lock the bet.

The controller must not accept a client-supplied creator ID as authorization evidence.

### Error responses

| Condition                 | Status | Error code         | Persistent result |
| ------------------------- | ------ | ------------------ | ----------------- |
| Missing authentication    | `401`  | `AUTH_REQUIRED`    | State unchanged   |
| Unknown bet               | `404`  | `BET_NOT_FOUND`    | State unchanged   |
| Non-creator attempts lock | `403`  | `NOT_BET_CREATOR`  | State unchanged   |
| Bet already locked        | `409`  | `BET_NOT_OPEN`     | State unchanged   |
| Invalid state for locking | `409`  | `BET_NOT_OPEN`     | State unchanged   |
| Invalid bet ID input      | `400`  | `VALIDATION_ERROR` | State unchanged   |

Example unauthorized-lock error:

```json
{
  "error": {
    "code": "NOT_BET_CREATOR",
    "message": "Only the bet creator may lock this bet."
  }
}
```

### Repeat-lock behavior

Locking an already locked bet returns HTTP `409`.

The operation must not replace the original `locked_at` timestamp.

The `open → locked` transition is not repeated.

## 10. Automated validation and evidence

The Join/Lock API is covered by:

```text
backend/tests/bets/betParticipation.test.js
```

Run from `backend/`:

```bash
node --test tests/bets/betParticipation.test.js
```

### SCRUM-489 integration test results

Recorded local results:

```text
tests:   15
passed:  15
failed:  0
skipped: 0
```

The fifteen tests verify:

1. Valid joining and participant persistence.
2. Unknown join-code rejection.
3. Duplicate-join rejection.
4. Capacity enforcement.
5. Locked-bet joining rejection.
6. Non-creator lock rejection.
7. Valid creator locking.
8. Repeated-lock rejection.
9. Authentication requirements.
10. Selected-answer persistence.
11. Required-answer enforcement.
12. Cross-bet answer-option rejection.
13. Case-insensitive join codes.
14. Unknown-bet lock rejection.
15. SQLite integrity after Join/Lock operations.

### Complete backend regression results

Recorded local results:

```text
tests:   102
passed:  92
failed:  0
skipped: 10
```

The ten skipped tests were existing Sprint 3 Create Bet cases. They are not counted as passing.

### Backend CI

The local command:

```bash
./scripts/ci-backend.sh
```

completed with:

```text
[Backend] Checks passed.
```

The successful run included database initialization, repeatable seeding, reset validation, formatting, and the backend automated tests.

These results were recorded before the subsequent dependency remediation. A fresh CI run is required to validate the dependency changes.

### Database integrity

The Join/Lock integration suite verifies:

```sql
PRAGMA integrity_check;
PRAGMA foreign_key_check;
```

Expected:

```text
integrity_check  = ok
foreign_key_check = no violations
```

The isolated tests passed these integrity requirements.

### Validation limitations

The following have not been established by the current Join/Lock test evidence:

- A fully integrated frontend-to-backend user journey.
- Persistence of creator-defined answer options through the Create Bet HTTP endpoint.
- Final outcome resolution.
- History retrieval.
- Historical resolved-bet migration with nonempty production data.
- GitHub-hosted CI results for the proposed PR.
- Peer review and merge approval.

The next review should verify authorization independently and confirm that the implemented answer-selection contract matches the agreed frontend and database interfaces.
