# Jira Work Item Description Template

> Use this template when creating Jira Tasks or Stories. The Jira issue should define the implementation before development begins. The resulting pull request should be able to reference this issue and demonstrate that the implementation and validation requirements below were satisfied.

## Summary

<!-- Describe the behavior or capability that must exist when this issue is complete. Focus on the outcome, not work already performed. -->

## Purpose / User or System Need

<!-- Explain why this work is needed and what project requirement, sprint deliverable, defect, or quality objective it supports. -->

## Scope

### In Scope

<!-- List the specific behavior, files, components, routes, database objects, tests, or tooling this issue owns. -->

- foo

### Out of Scope

<!-- Explicitly identify adjacent work that belongs to another Jira issue or team member. This is especially important for avoiding overlap between Members A-E. -->

- foo

## Implementation Plan

<!-- Describe HOW the work should be implemented. Include the expected control/data flow and enough detail that another developer could begin from this issue without inventing the design. -->

1. foo
2. bar
3. foo bar

## Expected Structure

<!-- Identify expected functions, modules, routes, test files, database helpers, fixtures, or scripts. Use proposed names when they are already known; otherwise describe the responsibility of each component. -->

Example:

```text
backend/
  src/
    ...
  tests/
    ...
```

### Functions / Interfaces

<!-- Document important function signatures or API behavior. Do not over-specify private implementation details that are intentionally flexible. -->

Example:

```text
login(email, password)

Inputs:
- email: string from the login email field
- password: string from the login password field

Behavior:
1. Validate email structure.
2. Query the database for the normalized email.
3. If the user does not exist, reject authentication.
4. Securely compare the supplied password to the stored password hash.
5. Establish authenticated state only after successful verification.

Outputs:
- Success: HTTP 200 with the expected authenticated response/session behavior.
- Authentication failure: HTTP 401.
- Invalid request data: appropriate 4xx validation response according to the API contract.
```

## Data / Persistence Requirements

<!-- Complete this section when the issue reads or changes persistent data. Otherwise write "None". -->

- Tables / records affected:
- Relationships affected:
- Required constraints:
- Expected state before operation:
- Expected state after operation:
- Failure / rollback behavior:
- Restart-persistence requirement:

## Error and Edge-Case Behavior

<!-- Define important rejected inputs, state conflicts, boundary cases, or failure modes before implementation begins. -->

- foo

## Security / Integrity Requirements

<!-- Identify security or data-integrity requirements that apply to THIS issue. Keep broader security testing in the appropriate owner's Jira work. -->

- User-controlled values must not be concatenated into unsafe SQL queries.
- Passwords must never be stored or compared as plaintext when authentication is involved.
- Invalid operations must not leave partial or inconsistent persistent state.
- Add issue-specific requirements below:
  - foo

## Test Implementation

<!-- Define how this issue will be validated. For test-focused Jira items, describe the test code that will be implemented, not merely the behavior to manually check. -->

### Automated Tests

- Test location / file:
- Test setup / fixtures:
- Test database or isolation strategy:
- Positive cases:
- Negative cases:
- Boundary / state-transition cases:
- Cleanup / teardown behavior:

### Manual Validation

<!-- Include only when manual verification adds value beyond automated tests. -->

- foo

## CI/CD Integration

<!-- Describe how the work should participate in the existing validation process. Do not claim ownership of another member's CI/CD scope. -->

- [ ] The implementation can be validated locally using the relevant project validation command.
- [ ] New automated tests return a failing exit status when they fail.
- [ ] New automated tests can run in a clean CI environment.
- [ ] No developer-local database, credentials, or generated state is required.
- [ ] No CI/CD workflow change is required unless explicitly listed below.

Required CI/CD changes, if any:

- None / (changes here)

## Acceptance Criteria

<!-- These are observable conditions that must all be true before the Jira issue can be closed. They should be specific enough for a reviewer to verify. -->

- [ ] Condition A
- [ ] Condition B
- [ ] Condition C

## Evidence Required

<!-- Define what evidence should be attached or linked in Jira before completion. -->

- [ ] Pull request linked to this Jira issue.
- [ ] Automated test output or CI result attached/linked when applicable.
- [ ] Relevant screenshots, query output, or terminal output attached when useful.
- [ ] Any discovered defect has a Jira issue or is documented in this issue.

## Dependencies

<!-- List Jira issues, features, schema work, APIs, or team-member work that must exist before this task can be completed. -->

- None / (dependencies here)

## Risks / Reviewer Focus

<!-- Call out implementation choices or failure modes that deserve extra review. This maps naturally to the Reviewer Notes section of the pull request template. -->

- foo

## Definition of Done

- [ ] Implementation matches the behavior and structure defined in this Jira issue.
- [ ] Acceptance criteria are satisfied.
- [ ] Relevant automated tests are added or updated.
- [ ] Local validation passes.
- [ ] Required CI checks pass.
- [ ] No credentials, secrets, local databases, or generated dependency folders are committed.
- [ ] Pull request references this Jira issue.
- [ ] Another group member reviews the pull request before merge.
