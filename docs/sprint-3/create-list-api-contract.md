# Sprint 3 — Create/List API Contract

**Owner:** Member C  
**Status:** Draft / proposed interface; **not verified against live endpoints**  
**Reviewers:** Member B (API), Member D (repository), frontend owner

## 1. Overview

| Method | Proposed path | Authentication | Proposed successful response |
| --- | --- | --- | --- |
| `POST` | `/api/bets` | Required session | `201 Created` with `{ "bet": ... }` |
| `GET` | `/api/bets` | Required session | `200 OK` with `{ "bets": [...] }` |

Both paths are proposed Sprint 3 endpoints. The current code provided for review registers `/api/auth` and `/health`, but does **not yet** show implemented bets routes.

The established authentication middleware reads `req.session.userID`. API code must never trust a client-provided owner ID.

## 2. Shared conventions

- JSON request/response bodies use `Content-Type: application/json`.
- The browser sends the existing session cookie using the project's current authentication mechanism; do not introduce separate client-managed tokens.
- Errors use the existing `AppError` response shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid bet information.",
    "details": [{ "field": "title", "message": "Bet title is required." }]
  }
}
```

- `details` is optional and should appear only when useful for safe validation feedback.
- Specific bet error identifiers/messages below are **proposed**, except for the established authentication error pattern. Member B must approve exact codes.

## 3. POST /api/bets

### Request body — proposed

```json
{
  "title": "Lakers vs Celtics",
  "description": "Who wins the matchup?",
  "max_participants": 4
}
```

| Field | Type | Required | Proposed validation |
| --- | --- | --- | --- |
| `title` | string | Yes | Trim; 1–150 characters after trim |
| `description` | string | No | Trim; 0–2000 characters; default `""` |
| `max_participants` | integer | No | 2–100; default `2` |

No request parameter may set `id`, `creator_id`, `join_code`, `status`, or lifecycle timestamps. **Proposed behavior:** reject unexpected fields with `400` rather than silently accepting them.

### Successful response — proposed (`201`)

```json
{
  "bet": {
    "id": "c4d2f1b8-4af1-4d75-8f86-8c44d40b4b20",
    "creator_id": 1,
    "title": "Lakers vs Celtics",
    "description": "Who wins the matchup?",
    "join_code": "A1B2C3D4E5F6",
    "status": "open",
    "max_participants": 4,
    "outcome_user_id": null,
    "created_at": "2026-10-09T19:00:00.000Z",
    "locked_at": null,
    "resolved_at": null
  }
}
```

Values above are **illustrative only**, not captured from a running API. The schema supports the displayed fields; final response projection requires Member B/frontend-owner approval.

### Error responses — proposed

| Scenario | Status | Contract expectation |
| --- | --- | --- |
| Missing session | `401` | Existing `AUTH_REQUIRED` error convention |
| Missing/invalid required field | `400` | `VALIDATION_ERROR` with field-level details |
| Extra/forbidden field | `400` | Reject client-controlled ownership or lifecycle properties |
| Join-code allocation failure | `503` or `500` | Safe, stable error response; exact code TBD |
| Unhandled database error | `500` | Existing global `INTERNAL_ERROR` response |

## 4. GET /api/bets

### Request — proposed

No body, owner query parameter, or user ID path parameter. Identity comes from the session.

### Successful response — proposed (`200`)

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
      "max_participants": 4,
      "outcome_user_id": null,
      "created_at": "2026-10-09T19:00:00.000Z",
      "locked_at": null,
      "resolved_at": null
    }
  ]
}
```

### Empty response — proposed (`200`)

```json
{
  "bets": []
}
```

### Query behavior

- Return only bets where `bets.creator_id` matches the authenticated session's `userID`.
- **Proposed ordering:** newest `created_at` first, followed by `id` as deterministic tie-breaker.
- The current scope is creator-owned bets; joined bets are not automatically included.
- Final decision required on whether list responses should include full `join_code` and outcome/lifecycle fields.

### Errors

| Scenario | Status | Contract expectation |
| --- | --- | --- |
| Missing/expired session | `401` | Existing `AUTH_REQUIRED` response |
| Unhandled service/database error | `500` | Existing safe `INTERNAL_ERROR` response |

## 5. Repository-to-API interface — proposed

The following pseudocode documents the **expected contract only**; it is not implementation code.

```javascript
/**
 * Store validated, server-authored bet data and return the stored row.
 * @param {object} betData - Includes session-derived creator_id.
 */
createBet(betData);

/**
 * Look up a bet by its generated identifier for internal use.
 * Public access to a bet must separately enforce access rules.
 * @param {string} betId - Generated unique bet ID.
 */
findById(betId);

/**
 * Retrieve rows belonging to the authenticated creator.
 * @param {number} creatorId - Value derived from req.session.userID.
 */
findByCreatorId(creatorId);
```

Member B and Member D must agree on method names and returned field shapes before integration.

## 6. Approval questions

- [ ] Approve endpoint paths and response wrappers (`bet` / `bets`).
- [ ] Approve title/description length limits and unknown-field policy.
- [ ] Assign ID/join-code generation ownership to B or D.
- [ ] Decide whether creator joins `bet_participants` automatically.
- [ ] Agree on list ordering and which fields are exposed in list responses.
- [ ] Approve precise error codes and join-code collision behavior.
- [ ] Capture live request/response samples after implementation is integrated.

## 7. Review record

| Reviewer | Decision / change request | Date |
| --- | --- | --- |
| Member B | Pending | |
| Member D | Pending | |
| Frontend owner | Pending | |
