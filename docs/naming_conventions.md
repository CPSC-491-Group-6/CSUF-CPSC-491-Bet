# Bet Project Naming Conventions

## Summary

This document records the Bet project's established naming conventions and proposes a consistent approach to other identifiers. It is a reference for new contributions, **not a request to rename existing files**. The first CI audit is informational only: it reports filenames that may need discussion but does not change code, reject a pull request, or replace code review.

## Related Jira Work Item

- Proposed naming-audit subtask: **C-CICD-01A** (numeric `SCRUM-###` issue ID and URL to be linked when confirmed).
- Related work: **C-CICD-01** CI Pipeline Hardening.
- This document and audit require teammate review before becoming project-wide standards.

## Scope and Ownership

- **Established:** Previously agreed project conventions for JavaScript, Markdown, and shell filenames.
- **Proposed:** Identifier conventions below that require team agreement before enforcement.
- **Existing interfaces:** Public API fields, database schemas, import paths, and external library names retain their current spelling. Do not rename to satisfy this guide alone.
- **Frontend:** Component and hook naming must be coordinated with frontend owners; the initial automated filename audit deliberately excludes `frontend/`.
- **Database:** Table/column naming decisions belong to the database owner. No schema migrations are requested.

## File Naming Conventions

| File/category                                        | Case or pattern                                                        | Example                                         | Status                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------- |
| General JavaScript `.js` files and utilities         | camelCase                                                              | `createBetService.js`                           | **Established**                     |
| JavaScript test files                                | camelCase stem plus `.test.js` or `.spec.js`                           | `createBet.test.js`                             | Proposed exception for test tooling |
| JavaScript tool configuration                        | Preserve tool-required names                                           | `eslint.config.mjs`, `vite.config.js`           | Existing/tool exception             |
| Markdown documentation                               | snake_case                                                             | `naming_conventions.md`                         | **Established**                     |
| GitHub-required or widely established Markdown names | Preserve required names                                                | `README.md`, `.github/pull_request_template.md` | Existing/tool exception             |
| Shell scripts (`.sh`)                                | kebab-case                                                             | `ci-backend.sh`                                 | **Established**                     |
| React components and `.jsx` files                    | Coordinate with frontend owner                                         | `CreateBet.jsx`                                 | Outside initial audit               |
| GitHub Actions workflow YAML                         | Existing name/tool conventions; kebab-case preferred for new workflows | `pr-labeler.yml`                                | Proposed                            |
| Git branches                                         | Jira-first identifier and descriptive words                            | `SCRUM-###-C-CICD-01A-Naming-Conventions-Audit` | Existing workflow pattern           |

**Naming examples:** camelCase = `createBetService`; snake_case = `create_bet_service`; kebab-case = `create-bet-service`; PascalCase = `CreateBetService`; UPPER_SNAKE_CASE = `MAX_PARTICIPANTS`.

## JavaScript Identifiers (Proposed, Not Yet Enforced)

| Identifier                                             | Proposed convention                | Example or qualification                  |
| ------------------------------------------------------ | ---------------------------------- | ----------------------------------------- |
| Functions, async functions, methods                    | camelCase                          | `createBet()`, `getBetById()`             |
| Local variables, parameters, ordinary `const` bindings | camelCase                          | `betId`, `requestPayload`                 |
| Truly fixed configuration constants                    | UPPER_SNAKE_CASE where helpful     | `MAX_PARTICIPANTS` (not every `const`)    |
| Classes and constructor-style identifiers              | PascalCase                         | `BetService`                              |
| React component functions                              | PascalCase                         | `CreateBet()`; frontend owner decides     |
| React hooks                                            | `use` + PascalCase suffix          | `useAuth()`; frontend owner decides       |
| Private/internal names                                 | Follow the existing module's style | Do not rename exported contracts          |
| JSON request/response properties                       | Existing API contract              | Preserve `betId` or other agreed spelling |

JavaScript naming rules do **not** override identifiers imposed by frameworks, third-party APIs, existing exported interfaces, or test fixtures. The supplied backend ESLint configuration currently uses recommended rules plus `no-unused-vars` and `eqeqeq`; it does **not** enforce these identifier naming proposals.

## Other Identifiers (Proposed, Owner Approval Needed)

| Area                      | Proposed convention                           | Example                                |
| ------------------------- | --------------------------------------------- | -------------------------------------- |
| Environment variables     | UPPER_SNAKE_CASE                              | `DB_PATH`, `SESSION_SECRET`            |
| SQLite tables and columns | snake_case                                    | `bet_participants`, `created_at`       |
| CSS class names           | kebab-case where consistent with the frontend | `bet-card`                             |
| API routes                | Follow the project's published API contracts  | Do not change live endpoints for style |

## Exceptions and Migration Policy

- Do not bulk-rename existing files or update import paths just to standardize spelling.
- Preserve GitHub/tool-required filenames and entry points such as `README.md` and `eslint.config.mjs`.
- Existing inconsistent filenames should be logged for discussion, not automatically changed.
- Any proposed enforcement must be scoped, approved by affected owners, and introduced with a nonbreaking migration plan.
- When in doubt, consistency with the existing module and compatibility with its consumers take precedence over new stylistic rules.

## Local Validation

The initial audit is read-only and requires Bash and Git, not npm dependencies:

```bash
# Run from the repository root, or any directory within the checkout.
bash scripts/ci-naming-audit.sh

# Inspect the proposed changes before committing.
git diff --check
git status -sb
```

The audit currently scans **tracked** Markdown files outside `frontend/`, JavaScript filenames in `backend/` and `scripts/`, and shell filenames in those two areas. It recognizes common tool/test filename exceptions. It reports potential deviations with GitHub Actions warnings and a summary, **but exits successfully even when it finds deviations**. It does not inspect function names or validate runtime behavior.

## CI/CD Impact

- `.github/workflows/naming-audit.yml` runs the informational filename audit on pull requests targeting `main` and on manual dispatch.
- This is a separate naming-only check: it does not run or duplicate backend/frontend tests, ESLint, database resets, or frontend builds.
- No naming findings may block merging. The naming-audit job must **not** be configured as a required branch-protection check.
- Existing mandatory `Backend CI` and `Frontend CI` checks remain unchanged.
- An eventual blocking naming rule requires explicit team approval, a reviewed exception list, and evidence that existing code is compliant.

## Reviewer Notes and Acceptance Criteria

- [ ] Team confirms the proposed identifier and exception policies.
- [ ] Frontend and database owners confirm or revise their respective proposals.
- [ ] Documentation matches the established JavaScript/Markdown/shell filename conventions.
- [ ] Audit emits warnings for sample nonconforming tracked filenames without failing.
- [ ] Audit ignores frontend files and preserves tool-required exceptions.
- [ ] PR demonstrates the naming workflow does not interfere with required CI jobs.
- [ ] Audit is kept optional in repository rulesets/branch protection.

## Review Requirement

This document becomes an agreed team reference only after review. All mandatory naming enforcement decisions require explicit team approval. An ordinary PR still requires a separate team member's approval and all required application CI checks before merging into `main`.
