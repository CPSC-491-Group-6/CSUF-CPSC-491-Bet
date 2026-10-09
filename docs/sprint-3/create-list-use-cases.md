# Sprint 3 — Create Bet and View My Bets Use Cases

**Owner:** Member C  
**Status:** Draft — team review required  
**Target review:** October 12, 2026  
**Scope:** Create Bet and View My Bets (creator-owned bets)

## 1. Scope and assumptions

This specification describes the intended user-facing behavior for creating a bet and listing bets created by the signed-in user. It defines a target for implementation and verification; it does **not** claim the functionality has already been implemented or tested.

**Confirmed from existing code:** Authentication uses `req.session.userID`. The initial SQLite schema contains `users`, `bets`, and `bet_participants`; `bets.creator_id` references `users.userID`.

**Proposed for approval:** The Create/List API paths, permitted request fields, validation lengths, response envelopes, ordering, and UI navigation behavior described here. Resolve these with Members B, D, and the frontend owner before treating them as final.

## 2. UC-CB-01 — Create Bet

| Item | Definition |
| --- | --- |
| Primary actor | Authenticated user |
| Trigger | User submits a Create Bet form |
| Preconditions | Valid authenticated session; Create Bet screen is accessible |
| Proposed input | `title` required; `description` optional; `max_participants` optional |
| System-generated data | `id`, `creator_id`, `join_code`, `status`, `created_at` |
| Success outcome | A bet is stored and returned with an owner matching the session user |
| Persistence | One new row in `bets`; participant auto-enrollment is **unresolved** |

### Main success flow

1. The authenticated user opens Create Bet.
2. The user enters the required title and any optional values.
3. The frontend submits the proposed `POST /api/bets` request with session credentials.
4. The API checks authentication and validates the request.
5. The API assigns `creator_id` using `req.session.userID`, generates `id` and `join_code`, and calls the repository.
6. SQLite stores the bet with initial `status = 'open'` and a creation timestamp.
7. The API responds with HTTP `201` and the created bet.
8. The frontend confirms creation and exposes the join code or a link to the bet as agreed by the frontend owner.

### Alternative and error flows

| Case | Expected result (proposed) |
| --- | --- |
| No authenticated session | HTTP `401`; no row created |
| Missing/blank title | HTTP `400` with field-level validation details; no row created |
| Invalid participant limit | HTTP `400`; no row created |
| Unexpected request field, including `creator_id` | HTTP `400` under a strict request schema; no row created |
| Generated join-code collision | Server retries generation or returns a safe failure; no partial row |
| Database/service error | Server returns standardized safe error; no success UI state |

### Open decisions

- Should creating a bet automatically insert its creator into `bet_participants`? **Requires Member B/D agreement.**
- What does the frontend display immediately after a successful creation? **Requires frontend-owner agreement.**
- Are the proposed validation limits of title 1–150 characters and description 0–2000 characters acceptable? **Requires team approval.**

## 3. UC-LB-01 — View My Bets

| Item | Definition |
| --- | --- |
| Primary actor | Authenticated user |
| Trigger | User opens the dashboard or My Bets view |
| Preconditions | Valid authenticated session |
| Proposed endpoint | `GET /api/bets` |
| Success outcome | A list of bets created by the current user, possibly empty |
| Ownership restriction | Only rows with `creator_id = req.session.userID` appear |

### Main success flow

1. An authenticated user navigates to My Bets.
2. The frontend requests `GET /api/bets` with session credentials.
3. The API checks the session and supplies the authenticated user ID to the repository.
4. The repository filters rows by `creator_id` and returns the matching bets.
5. The frontend displays the returned bets and their current states.

### Alternative and error flows

| Case | Expected result (proposed) |
| --- | --- |
| User owns no bets | HTTP `200` with `{ "bets": [] }`; show intentional empty state |
| Session missing/expired | HTTP `401`; do not render private bet data |
| API/network error | Show recoverable failure message; do not pretend loading succeeded |
| Another user owns a bet | It does not appear in the current user's creator-owned list |

### Terminology decision

This contract defines **My Bets = bets I created**, not all bets I have joined. If product requirements require both, use separate views or explicitly expand the API contract rather than silently changing ownership filtering.

## 4. Related requirements

See [`requirements-traceability.md`](./requirements-traceability.md) for `CB-REQ-*` and `LB-REQ-*` criteria and verification evidence.

## 5. Review record

| Reviewer | Area | Status | Notes |
| --- | --- | --- | --- |
| Member B | API and authentication | Pending | |
| Member D | Schema and repository | Pending | |
| Frontend owner | UI interactions | Pending | |
| Member C | Requirements alignment | Drafted | |
