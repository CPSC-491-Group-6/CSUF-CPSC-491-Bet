# Sprint 3 — Create/List Integration Contract

**Owner:** Member C  
**Status:** Draft coordination agreement  
**Scope:** Frontend ↔ Express API ↔ SQLite repository, with authentication and midterm evidence

## 1. Goal

Define handoffs so separate Sprint 3 contributions can integrate without duplicate implementations. This document is a contract for discussion, not an assertion that every component is complete.

## 2. Responsibility boundaries

| Area | Primary owner | Contract responsibility |
| --- | --- | --- |
| Create/List use cases, API spec, data dictionary, traceability | C | Define behavior and record approved changes |
| Create/List HTTP routes, controllers, validation and authentication enforcement | B | Implement agreed requests, responses, and status codes |
| Bets schema, repository, migrations, seeds, reset checks | D (database assignment) | Supply database operations and constraints |
| Create/List frontend | Frontend owner — confirm assignment | Use approved API contract; display loading/success/error/empty states |
| Join Bet frontend | Assignment currently ambiguous | Separate feature contract; do not assume Create/List endpoint supports joins |
| Authentication regression tests | A | Preserve existing session behavior and regression evidence |
| Integrated midterm demo, defect/evidence collection | E | Demonstrate approved end-to-end use cases |

**Assignment conflict to resolve:** Shared task descriptions separately name Member D for Join Bet frontend and bets persistence; another frontend task still uses a placeholder. Confirm the active Jira ownership before assigning frontend integration tasks.

## 3. Data flow

```text
Authenticated browser (existing session cookie)
    |
    | POST /api/bets or GET /api/bets
    v
Express router -> requireAuth -> bet controller
    |
    | validated input + req.session.userID
    v
Bet service -> bet repository -> SQLite bets table
    |
    | returned stored bet(s)
    v
Standardized API JSON response -> React UI state
```

## 4. Frontend ↔ API obligations

**Frontend owner supplies:**

- User-entered `title`, `description`, and `max_participants` only for Create Bet.
- The existing session cookie using the application's configured fetch/auth approach.
- Loading, input-validation feedback, success, empty-list, and recoverable error states.
- No browser-generated `creator_id`, `status`, or join-code authority.

**Member B supplies:**

- Agreed `POST /api/bets` and `GET /api/bets` endpoints.
- JSON response shapes matching [`create-list-api-contract.md`](./create-list-api-contract.md).
- Authorization from `req.session.userID`, not URL or JSON values supplied by the browser.
- Stable `400`, `401`, and `500`-class error handling in the existing `AppError` envelope.

## 5. API ↔ repository obligations

**Member B supplies to repository:**

- Validated fields accepted for persistence.
- Creator identity derived from authenticated session.
- Server-generated values or an agreed contract for repository generation.

**Member D supplies to API:**

- Method for inserting a bet and retrieving its stored record.
- Method for querying creator-owned bets using an explicit owner ID.
- Method for internal find-by-ID lookup if needed.
- Constraint-safe persistence; deterministic behavior on empty queries.
- Compatible migration/seed/reset behavior.

**Proposed interface names:** `createBet`, `findById`, `findByCreatorId`. Names require B/D approval.

## 6. Authentication and ownership rules

1. Both Create/List endpoints require an authenticated session.
2. `creator_id` must come from `req.session.userID`.
3. Create requests must not be able to impersonate a different creator.
4. My Bets queries filter on creator identity; other users' creator-owned bets are excluded.
5. Frontend route protection improves UX but is not a substitute for API authentication.
6. Do not log passwords, session cookies, or live credentials in evidence.

## 7. Integration checkpoints

| Checkpoint | Owner(s) | Evidence expected | State |
| --- | --- | --- | --- |
| Agree on request/response/error shapes | C + B + frontend owner | Reviewed API contract | Pending |
| Confirm schema and repository return shape | C + D + B | Schema notes and interface review | Pending |
| Create and list work with two distinct test users | B + D | Isolated integration test output | Pending |
| Frontend shows successful create and empty/populated list | Frontend owner | Browser/test output | Pending |
| Cross-user ownership filtering is verified | B + C | Test/evidence link | Pending |
| Midterm workflow is rehearsed | E + team | Script, screenshots, defect log | Pending |

## 8. Related but separate: Join Bet

Join Bet involves join-code lookup, bet details, locked/open state, duplicate participation, and possible participant insertion. These are **not** covered by `POST /api/bets` or `GET /api/bets`. A separate contract should define the required endpoints and database operations after the responsible owners confirm the feature split.

## 9. Change control

When implementation conflicts with this draft:

1. Record the affected requirement ID and mismatch.
2. Confirm whether the contract or implementation should change.
3. Obtain agreement from impacted owners.
4. Update the relevant contract/data dictionary.
5. Re-run the corresponding verification and link evidence.
6. Record the final outcome in the traceability matrix.

## 10. Approvals

| Member | Review area | Approved? | Date / comments |
| --- | --- | --- | --- |
| A | Auth/test implications | Pending | |
| B | API | Pending | |
| C | Requirements/traceability | Pending | |
| D | Persistence | Pending | |
| E | Demo/evidence | Pending | |
| Frontend owner | React/API handoff | Pending | |
