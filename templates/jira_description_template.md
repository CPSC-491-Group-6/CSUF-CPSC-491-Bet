# Jira Description Template

> Use this template for implementation and testing work items.
>
> The Jira issue should define the work **before development begins**. It should
> explain what will be implemented, where it belongs, how it should behave, how
> it will be validated, and what evidence is required before the issue can be
> considered complete.

## Summary

<!--
Briefly describe what this Jira work item will implement and why it is needed.

Describe the intended outcome, not work that has already been completed.

Example:
Implement automated SQLite persistence tests for Create Bet so the project can
verify that accepted bet data is stored correctly and invalid requests do not
leave partial records.
-->

## Related Project Requirement or Sprint Goal

<!--
Identify the sprint deliverable, user story, requirement, or project milestone
this work supports.

Example:
Sprint 3 - Create and Join Bets

Main deliverable: Two users can create, list, join, lock, and view a bet in the
integrated MVP.
-->

## Type of Work

- [ ] Feature implementation
- [ ] Bug fix
- [ ] Refactor
- [ ] Automated test
- [ ] Manual or repeatable validation
- [ ] Database or persistence work
- [ ] CI/CD or development tooling
- [ ] Documentation
- [ ] Other

## Purpose and System Need

<!--
Explain why this work is necessary.

Describe:

- The system behavior this task is responsible for.
- The problem or risk being addressed.
- Why the task belongs in the current sprint.
- How it contributes to the project deliverable.

For testing tasks, identify the exact quality property being validated, such as
persistence, integrity, authorization, state transition, atomicity, or
regression prevention.
-->

## In Scope

<!--
List the exact work that this Jira item owns.

Be specific enough that another developer can tell what should be implemented.

Examples:

- Add automated persistence tests for Create Bet.
- Verify the creator relationship is stored correctly.
- Verify invalid creation does not leave partial data.
- Add reusable isolated SQLite setup if needed by this task.
-->

<!-- Add in-scope items below. -->

## Out of Scope

<!--
Explicitly identify nearby responsibilities that belong to another Jira item or
another team member. This is especially important for avoiding overlap.

Examples:

- React UI behavior.
- General API contract testing.
- Full security testing.
- Overall GitHub Actions ownership.
- Deployment testing.
-->

<!-- Add out-of-scope items below. -->

## Implementation Plan

<!--
Describe HOW this work should be implemented before development begins.

Include:

- Functions, modules, routes, models, helpers, or scripts that will be added or
  modified.
- Expected control and data flow.
- Important validation logic.
- Expected error behavior.
- Existing project components that should be reused.
- Any implementation constraints.

Example for login():

1. Receive `email` and `password`.
2. Validate that both fields exist.
3. Validate the email format.
4. Query the database for the user by email.
5. Reject unknown users with the defined authentication failure response.
6. Securely compare the submitted password with the stored password hash.
7. Create or return the authenticated session or response on success.
8. Return the defined failure status when authentication fails.

Do not use vague instructions such as "make login work."
-->

### Expected Flow

```text
<Input or Trigger>
        |
        v
<Validation>
        |
        v
<Business or Persistence Logic>
        |
        v
<Expected Result>
```

### Planned Implementation Steps

<!-- Add numbered implementation steps below. -->

## Expected Code and File Structure

<!--
List the expected files or directories this issue should use.

Use the existing project structure whenever possible.

Example:

backend/
  tests/
    database/
      helpers/
      fixtures/
      create-bet-persistence.test.js

scripts/
  ci-backend.sh
-->

```text
<project structure here>
```

## Functions, Interfaces, and Data Contracts

<!--
Define important functions, parameters, requests, responses, or database
interactions that development should follow.

For each function or interface, define:

- Name.
- Inputs.
- Validation.
- Processing.
- Output.
- Failure behavior.

Example:

login(email, password)

Inputs:

- `email`: string.
- `password`: string.

Validation:

- Email is present.
- Password is present.
- Email has valid structure.

Processing:

- Find the user by email.
- Compare the submitted password against the stored password hash.

Success:

- Return the project's defined authenticated result.
- Return the exact success status defined by the API contract.

Failure:

- Unknown email or invalid password returns the defined authentication failure
  status.
- No authenticated session is created.
-->

### Interface or Function

**Name:** `<function or route>`

**Inputs:**

<!-- List inputs here. -->

**Validation:**

<!-- List validation rules here. -->

**Processing:**

<!-- Describe processing steps here. -->

**Success Result:**

<!-- Define the exact success result here. -->

**Failure Result:**

<!-- Define the exact failure result here. -->

## Data and Persistence Requirements

<!--
Complete this section when the task creates, reads, updates, or deletes
persistent data.

Define:

- Tables or records involved.
- Required relationships.
- Fields that must change.
- Fields that must remain unchanged.
- Transaction requirements.
- Persistence expectations after restart.
- Cleanup or reset expectations.

For failed operations, explicitly state whether the database must remain
unchanged.
-->

### Records or Tables Involved

<!-- List records or tables here. -->

### Required Relationships

<!-- List required relationships here. -->

### Expected Persistent Changes

<!-- List expected persistent changes here. -->

### Values That Must Remain Unchanged

<!-- List values that must remain unchanged here. -->

### Failure and Rollback Requirements

<!-- Define rollback and unchanged-state requirements here. -->

## Error and Edge-Case Behavior

<!--
Define important failure conditions BEFORE implementation.

Do not write "handle errors appropriately."

For each relevant failure, define:

- Trigger.
- Expected result or status.
- Expected database state.
- Whether any partial state is allowed.

Examples:

- Missing email -> exact validation result.
- Unknown ID -> exact not-found result.
- Duplicate join -> exact conflict or rejection result.
- Invalid state transition -> operation rejected and persistent state unchanged.
-->

| Condition     | Expected Result | Expected Persistent State |
| ------------- | --------------- | ------------------------- |
| `<condition>` | `<result>`      | `<state>`                 |
| `<condition>` | `<result>`      | `<state>`                 |

## Validation Procedure

> Every test or validation task must contain a procedure precise enough that
> another team member can reproduce the same result without guessing.

### Test Case ID

`<C-TEST-XX-TC01>`

### Test Objective

<!--
State one exact behavior this test proves.

Example:
Verify that resolving a locked bet stores the final resolved state and result,
preserves creator and participant relationships, and remains correct after
restart.
-->

### Preconditions

<!--
Define the exact state required before Step 1.

Examples:

- Backend dependencies are installed.
- Test database is available.
- Database is reset to a known state.
- User A exists.
- User B exists.
- User A is authenticated.
- Bet A exists.
- Bet A is in the LOCKED state.
-->

<!-- Add preconditions here. -->

### Test Data

<!--
Use deterministic test-only values whenever practical.

Do not use real credentials or secrets.

Example:

User A email: `creator@test.local`

User B email: `participant@test.local`

Bet title: `Sprint Test Bet`

Starting state: `LOCKED`
-->

| Field     | Test Value |
| --------- | ---------- |
| `<field>` | `<value>`  |
| `<field>` | `<value>`  |

### Exact Test Steps

<!--
Write numbered steps that another teammate can follow exactly.

For UI validation, include navigation and interaction.

Example:

1. Navigate to `/login`.
2. Enter `creator@test.local` into the email field.
3. Enter the defined test password into the password field.
4. Click `Login`.
5. Record the HTTP or API result.
6. Verify the resulting page and session state.

For API or backend validation, include the exact setup and action sequence.

For database validation, include exact database assertions after the operation.
-->

<!-- Add numbered test steps here. -->

### Expected Results

<!--
Define the expected result for each significant step.

Use exact expected values.

Include, where applicable:

- HTTP status code.
- Response body or required fields.
- UI result.
- Database row.
- Row count.
- State transition.
- Process exit code.
- Integrity-check output.

Avoid ambiguous wording such as "should succeed," "should fail," or
"returns 200/401/500 depending." Define one expected result for each test
condition.
-->

#### Expected Application or API Result

- **HTTP status:** `<exact code>`
- **Response or result:** `<exact expected result>`

#### Expected UI Result

<!-- Remove this subsection if it is not applicable. -->

`<exact expected UI state>`

#### Expected Database Result

<!-- Remove this subsection if it is not applicable. -->

- **Table or record:** `<table or record>`
- **Expected row count:** `<count>`
- **Expected field values:** `<values>`
- **Expected relationships:** `<relationships>`
- **Values that remain unchanged:** `<values>`

### Database Verification

<!--
Required when persistence is part of the test.

Do not treat a successful HTTP response as proof that persistence is correct.

Document:

- What database object is inspected.
- Which record is inspected.
- What values should exist.
- What must not exist.
-->

#### Record Verification

- **Table or collection:** `<name>`
- **Record identifier:** `<identifier>`
- **Fields to verify:** `<fields>`
- **Expected values:** `<values>`

#### Relationship Verification

<!-- Describe exact relationships to verify. -->

#### Integrity Checks

Where applicable, execute:

```sql
PRAGMA integrity_check;
```

Expected:

```text
ok
```

Then execute:

```sql
PRAGMA foreign_key_check;
```

Expected:

```text
No rows or violations
```

### Negative and Failure Validation

<!--
Define repeatable rejected-operation tests when applicable.

Example:

1. Record the database state.
2. Attempt an invalid Resolve operation.
3. Verify the exact rejection status.
4. Query the database again.
5. Verify no partial update was persisted.
-->

#### Failure Condition

`<exact invalid condition>`

#### Failure Test Steps

<!-- Add numbered failure-test steps here. -->

#### Expected Failure Result

- **HTTP or process result:** `<exact result>`
- **Expected database state:** `<exact state>`
- **Partial writes allowed:** `<Yes or No>`
- **Expected unchanged values:** `<values>`

### Repeatability and Reset Procedure

<!--
Explain how to reproduce the test from the same known starting state.

Use the project's actual commands and controlled test environment.

Examples, where applicable:

cd backend
npm run db:reset:seed
npm test

For CI or backend validation:

./scripts/ci-backend.sh

Do not require another developer's personal database state.
-->

#### Setup and Reset Commands

```bash
# Add the exact commands required to establish the test state.
```

#### Repeatability Requirements

- [ ] Test does not depend on personal developer data.
- [ ] Test can be run more than once from the documented starting state.
- [ ] Test does not depend on previous test execution order where practical.
- [ ] Test cleanup or reset procedure is documented.
- [ ] Test uses test-only credentials and data.

### Pass Criteria

<!--
Define ALL conditions required for a passing result.

Example:

- Request returns HTTP 200.
- Bet row has state RESOLVED.
- Result matches the expected value.
- Participant relationship remains unchanged.
- `PRAGMA integrity_check` returns `ok`.
- Automated test process exits with code 0.
-->

<!-- Add exact pass criteria here. -->

### Fail Criteria

<!--
Define conditions that make the test fail.

Example:

- Wrong HTTP status.
- Missing or incorrect database row.
- Partial write remains after a rejected operation.
- Foreign-key violation exists.
- Automated command exits with a nonzero status.
-->

<!-- Add exact fail criteria here. -->

### Cleanup

<!--
Define the exact action required after the test.

Examples:

- Delete the temporary SQLite database.
- Reset the test database.
- Clear test session or cookies.
- Restore the known seed state.

Automated tests should perform cleanup automatically where practical.
-->

<!-- Add numbered cleanup steps here. -->

## Automated Test Implementation

<!--
If this Jira item requires automation, define what should be implemented.

Include:

- Test file.
- Test framework.
- Shared helper or fixture usage.
- Assertions.
- How to run only this test.
- How to run the complete relevant suite.
-->

### Planned Test File

`<path/to/test-file>`

### Test Framework

`<framework or runner>`

### Shared Helpers and Fixtures

<!-- List shared helpers and fixtures here. -->

### Required Assertions

<!-- List required assertions here. -->

### Local Command

```bash
# Add the exact command that runs this test.
```

### Full Relevant Validation Command

```bash
# Add the exact component or full validation command.
```

## CI/CD Impact

<!--
Explain how this work interacts with the existing CI process.

Member-specific testing tasks should make their test result CI-compatible
without taking ownership of the entire pipeline unless that is the actual
assignment.
-->

- [ ] No CI/CD changes required.
- [ ] Adds or changes an automated test.
- [ ] Existing backend or frontend CI command must execute the new test.
- [ ] Changes a local CI script.
- [ ] Changes a GitHub Actions workflow.
- [ ] Changes build or versioning behavior.

### Expected CI Behavior

<!--
Example:

- Passing test returns exit code 0.
- Failing test returns a nonzero exit code.
- Existing `./scripts/ci-backend.sh` executes the test through the backend test
  command.
-->

<!-- Define expected CI behavior here. -->

## Dependencies

<!--
List work that must exist before this issue can be completed.

Examples:

- Resolve endpoint implemented.
- Database schema available.
- Shared isolated test helper available.
- Sprint 3 lifecycle implemented.

Use Jira issue links where available.
-->

<!-- Add dependencies here. -->

## Risks and Reviewer Focus

<!--
Identify areas that deserve extra review.

Examples:

- Test accidentally uses the normal development database.
- Rejected operation leaves a partial row.
- Test passes only because execution order creates required state.
- SQL is constructed through unsafe concatenation.
-->

<!-- Add risks and reviewer-focus items here. -->

## Acceptance Criteria

<!--
Use measurable completion conditions.

These should describe the behavior or output required by the task, not vague
work effort.

Example:

- Valid Resolve stores the correct result.
- Duplicate Resolve is rejected.
- Rejected Resolve leaves persistent state unchanged.
- Restart preserves the resolved state.
- Automated test executes through backend validation.
-->

<!-- Add acceptance-criteria checkboxes here. -->

## Evidence Required

<!--
Define what must be attached or linked before completion.

Examples:

- Pull request.
- Automated test output.
- CI result.
- Database query output.
- Screenshots.
- Jira defect links.
- Integrity-check output.
-->

- [ ] Pull request linked.
- [ ] Relevant automated test output attached or referenced.
- [ ] CI or local validation result recorded.
- [ ] Database evidence included when persistence is tested.
- [ ] Related defects or issues linked when applicable.

## Definition of Done

<!--
State the conditions that make the Jira item complete.

A typical development or testing issue is done when:

- Planned implementation is complete.
- Defined validation procedure passes.
- Automated tests are added or updated where appropriate.
- Local validation passes.
- Required CI checks pass.
- Evidence is attached.
- Another team member reviews the PR before merge.
-->

- [ ] Planned implementation is complete.
- [ ] Validation procedure has been executed successfully.
- [ ] All acceptance criteria are satisfied.
- [ ] Automated tests were added or updated when appropriate.
- [ ] Relevant local validation passes.
- [ ] Required CI checks pass.
- [ ] Evidence is attached or linked.
- [ ] Pull request was reviewed by another group member before merge.

## Reviewer Notes

<!--
Call out anything the reviewer should inspect or reproduce closely.

Examples:

- Confirm the test uses an isolated SQLite database.
- Reproduce TC02 and verify no row remains after failure.
- Confirm integrity checks are asserted rather than only printed.
-->
