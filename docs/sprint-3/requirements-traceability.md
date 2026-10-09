# Sprint 3 — Create/List Requirements and Test Traceability

**Owner:** Member C  
**Status:** Draft mapping — evidence not yet collected  
**Due for final verification:** October 12, 2026

## 1. Traceability conventions

- `CB-REQ-*`: Create Bet requirements.
- `LB-REQ-*`: View My Bets requirements.
- `Planned`: Requirement/test defined but not executed or verified.
- `Pass`: Test executed successfully; evidence must be linked.
- `Fail`: Tested behavior differs from approved expectation; defect required.
- `Blocked`: Validation cannot proceed due to a missing dependency.

Do not replace `Planned` with `Pass` until real code/test evidence exists.

## 2. Create Bet requirements

| ID | Acceptance criterion | Implementation area | Planned verification | Status | Evidence / defect |
| --- | --- | --- | --- | --- | --- |
| CB-REQ-01 | An unauthenticated user cannot create a bet | API authentication | POST without session returns `401` | Planned | TBD |
| CB-REQ-02 | Valid input creates a bet | API + repository | POST valid payload returns `201`; row exists | Planned | TBD |
| CB-REQ-03 | Required title is validated | API validation | Missing/blank title returns `400` | Planned | TBD |
| CB-REQ-04 | Participant limit follows approved range | API + SQLite | Test min, max, out-of-range and noninteger inputs | Planned | TBD |
| CB-REQ-05 | Owner is authenticated user | API + repository | Create as user A; row `creator_id` = A | Planned | TBD |
| CB-REQ-06 | Client cannot assign ownership | API validation/auth | Attempt `creator_id` override; never create as B | Planned | TBD |
| CB-REQ-07 | New bet has valid generated identifiers and initial state | API + SQLite | Inspect ID, unique join code, `open`, timestamp | Planned | TBD |
| CB-REQ-08 | Persistence survives a subsequent request | API + SQLite | Create then retrieve/list in a separate request | Planned | TBD |
| CB-REQ-09 | Failed creation does not appear successful | Frontend + API | Invalid/API-failure UI state and no partial insert | Planned | TBD |

## 3. View My Bets requirements

| ID | Acceptance criterion | Implementation area | Planned verification | Status | Evidence / defect |
| --- | --- | --- | --- | --- | --- |
| LB-REQ-01 | Listing requires authentication | API authentication | GET without session returns `401` | Planned | TBD |
| LB-REQ-02 | Listing contains only creator-owned bets | Repository + API | Seed users A/B; list as A excludes B's bets | Planned | TBD |
| LB-REQ-03 | No owned bets produces a valid empty result | API + UI | `200` and `{ "bets": [] }`; UI empty state | Planned | TBD |
| LB-REQ-04 | Bet list fields match approved contract | Repository + API | Compare returned keys/types with API spec | Planned | TBD |
| LB-REQ-05 | Results follow approved ordering | Repository + API | Seed multiple creation times; assert order | Planned | TBD |
| LB-REQ-06 | UI handles populated results | Frontend | Render created bets and states correctly | Planned | TBD |
| LB-REQ-07 | UI handles API/authentication failures | Frontend | Mock `401`, `500`, network rejection | Planned | TBD |

## 4. Cross-layer evidence plan

| Evidence ID | Activity | Responsible owner(s) | Link/status |
| --- | --- | --- | --- |
| EV-01 | Fresh database migration / schema check | D | TBD |
| EV-02 | Valid Create Bet request and stored row | B + D | TBD |
| EV-03 | Invalid Create Bet input and rejection | B | TBD |
| EV-04 | Anonymous create/list rejection | B | TBD |
| EV-05 | Two-user ownership isolation | B + D | TBD |
| EV-06 | Empty and populated list UI | Frontend owner | TBD |
| EV-07 | Failed request and recovery UI | Frontend owner | TBD |
| EV-08 | Seed/reset repeatability | D | TBD |
| EV-09 | Midterm integrated workflow | E | TBD |

## 5. Final verification checklist

- [ ] Approved endpoint and request/response contract is linked.
- [ ] B and D reviewed the repository-to-API interface.
- [ ] Every requirement maps to at least one actual test or manual verification.
- [ ] Real test commands and pass/fail outputs are recorded.
- [ ] Screenshots or API evidence are stored without secrets.
- [ ] Failed requirements have a linked defect and owner.
- [ ] Any changed requirements are reflected in API and data dictionary documents.
- [ ] Frontend and API behavior match the same approved contract.
- [ ] Peer review is recorded before issue closure.

## 6. Review and execution log

| Date | Requirement ID(s) | Verification performed | Actual result | Tester | Evidence |
| --- | --- | --- | --- | --- | --- |
| TBD | TBD | TBD | Not executed | TBD | TBD |
