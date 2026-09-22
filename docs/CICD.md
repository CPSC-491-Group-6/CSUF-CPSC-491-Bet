<!-- ./docs/CICD.md -->
<!-- This file should be updated when the CI/CD workflow is modified. -->
<!-- This file provides a guide for setting up and maintaining the CI/CD pipeline. -->

# CI/CD Guide

## Purpose

This document defines the initial Continuous Integration / Continuous Delivery (CI/CD) workflow for the Bet project.

The Sprint 2 goal is to establish a reliable CI foundation that the full team can extend as automated tests, security checks, and deployment steps are added. The first version of the pipeline should stay simple enough to debug while still proving that the project can be installed, checked, built, versioned, and reproduced from a clean environment.

The Bet project currently uses:

- React and Vite for the frontend
- Node.js and Express for the backend
- SQLite for persistence
- GitHub for source control and pull requests
- npm lockfiles for reproducible dependency installation

The initial CI/CD work should preserve the team's pull-request review process while adding automated validation before and after merges to `main`.

---

## Sprint 2 CI/CD Goals

By the end of Sprint 2, the repository should provide:

- Automated CI checks on pull requests targeting `main`
- An automated build after every merge or push to `main`
- Reproducible dependency installation with `npm ci`
- Frontend lint and production build validation
- Backend automated test execution once backend tests are available
- Frontend automated test execution once frontend tests are available
- Unique build identifiers
- Build metadata stored with successful builds
- Build artifacts for successful `main` builds
- A local command that developers can run before opening a pull request
- A documented process for extending the pipeline

The Sprint 2 pipeline does **not** need to perform production deployment yet.

---

## Repository Layout

The CI/CD starter files are organized as follows:

```text
.
├── .github/
│   └── pull_request_template.md
├── docs/
│   └── CICD.md
├── scripts/
│   ├── README.md
│   ├── ci-backend.sh
│   ├── ci-check.sh
│   ├── ci-frontend.sh
│   └── generate-build-info.sh
└── .nvmrc
```

A GitHub Actions workflow can call these same scripts so local validation and GitHub validation use the same commands.

That is intentional: developers should be able to reproduce CI failures locally instead of debugging one set of local commands and a different set of CI commands.

---

## Local CI Workflow

From the repository root, run:

```bash
./scripts/ci-check.sh
```

The script runs the backend and frontend checks in sequence.

The initial checks are:

### Backend

```text
npm ci
npm test --if-present
```

`npm test --if-present` is temporary while the backend automated test suite is being introduced.

Once the backend test contribution is merged, this should be changed to:

```text
npm test
```

so a missing test script becomes a CI failure.

### Frontend

```text
npm ci
npm run lint
npm test --if-present
npm run build
```

The same rule applies to frontend tests. Once the frontend automated test suite is merged, change:

```text
npm test --if-present
```

to:

```text
npm test
```

The production build should create:

```text
frontend/dist/
```

---

## Why the Scripts Are Split

The local runner is intentionally divided into:

```text
ci-check.sh
ci-backend.sh
ci-frontend.sh
```

`ci-check.sh` is the top-level developer command.

`ci-backend.sh` contains backend-specific validation.

`ci-frontend.sh` contains frontend-specific validation.

This allows the backend and frontend owners to extend their own CI logic without creating unnecessary merge conflicts in one large script.

For example, the backend owner can later add API integration tests to `ci-backend.sh`, while the frontend owner can add component tests to `ci-frontend.sh`.

---

## Suggested GitHub Actions Flow

The GitHub Actions workflow should follow this sequence:

```text
Pull Request to main
        |
        +--> Backend CI
        |
        +--> Frontend CI
        |
        +--> Human Review
        |
        v
      Merge
        |
        v
Push to main
        |
        +--> Backend CI
        |
        +--> Frontend CI
        |
        +--> Generate Build Information
        |
        +--> Upload Build Artifact
```

The important design rule is that GitHub Actions should call the same repository scripts used locally whenever practical.

For example:

```yaml
- name: Run backend checks
  run: ./scripts/ci-backend.sh

- name: Run frontend checks
  run: ./scripts/ci-frontend.sh
```

This avoids duplicating the detailed command sequence in multiple places.

---

## Build Versioning

The starter build-information script supports both GitHub Actions and local testing.

### GitHub Actions format

When the following environment variables exist:

```text
GITHUB_RUN_NUMBER
GITHUB_RUN_ATTEMPT
GITHUB_SHA
```

the build version uses:

```text
ci-<run-number>.<attempt>-<short-sha>
```

Example:

```text
ci-42.1-a12bc34
```

If the same workflow is rerun:

```text
ci-42.2-a12bc34
```

### Local format

When the GitHub Actions variables are not present, the script uses Git and UTC time:

```text
local-<timestamp>-<short-sha>
```

Example:

```text
local-20260921T231500Z-a12bc34
```

The local format exists so developers can test artifact generation before the workflow is merged.

---

## Generate Build Information Locally

First build the frontend:

```bash
./scripts/ci-frontend.sh
```

Then run:

```bash
./scripts/generate-build-info.sh frontend/dist
```

This creates:

```text
frontend/dist/BUILD_INFO.txt
```

A local example might contain:

```text
Build Version: local-20260921T231500Z-a12bc34
Commit SHA: a12bc34...
Build Source: local
```

A GitHub Actions build can additionally include its workflow run and attempt numbers.

---

## Extending the Backend Pipeline

The backend owner should build on:

```text
scripts/ci-backend.sh
```

Recommended future checks include:

- Authentication tests
- API endpoint tests
- SQLite initialization tests
- Temporary test database creation
- Seed validation
- Reset validation
- Integration tests

Tests should use a temporary or dedicated test database.

Automated tests should not modify a developer's normal local SQLite database.

Once backend tests exist, replace:

```bash
npm test --if-present
```

with:

```bash
npm test
```

---

## Extending the Frontend Pipeline

The frontend owner should build on:

```text
scripts/ci-frontend.sh
```

Recommended future checks include:

- React component tests
- Authentication form tests
- Route tests
- Dashboard tests
- Production build verification

Once frontend tests exist, replace:

```bash
npm test --if-present
```

with:

```bash
npm test
```

---

## Extending Database Validation

Database CI should eventually verify the following lifecycle:

```text
Create Temporary Database
        |
        v
Initialize Schema
        |
        v
Run Seed Command
        |
        v
Validate Seed Data
        |
        v
Run Reset Command
        |
        v
Validate Reset State
        |
        v
Delete Temporary Database
```

This should be added to the backend CI path or to a dedicated database CI script if the checks become large enough to justify their own job.

---

## Dependency and Security Automation

Another team member can add dependency and security automation without changing the local CI scripts.

Potential additions include:

- Dependabot
- Dependency Review
- `npm audit` with a team-agreed failure threshold
- GitHub CodeQL in a later sprint
- Secret scanning if available for the repository

Security checks should be introduced carefully so the team understands why a check fails and how developers are expected to fix it.

---

## Pull Request Workflow

Before opening a pull request, a developer should:

1. Pull the latest target branch.
2. Run the relevant application locally.
3. Run: `./scripts/ci-check.sh`
4. Fix local CI failures.
5. Push the feature branch.
6. Open a pull request.
7. Link the related Jira work item.
8. Wait for automated checks.
9. Request review from another team member.
10. Merge only after the required review and CI checks pass.

The repository pull request template provides a checklist for these steps.

---

## Main Branch Protection

After the CI jobs have run successfully at least once, the team should configure `main` so that:

- Pull requests are required before merge
- At least one approving review is required
- Backend CI must pass
- Frontend CI must pass
- Review conversations must be resolved
- Direct pushes are restricted where repository permissions allow it

Repository settings are not represented by a normal Git commit, so screenshots should be retained as Sprint evidence.

---

## Troubleshooting Local CI

### `npm ci` fails

Check whether `package.json` and `package-lock.json` are synchronized.

A developer should normally resolve this by updating dependencies through the normal npm workflow and committing the resulting lockfile rather than editing the lockfile manually.

### Frontend lint fails

Run:

```bash
cd frontend
npm run lint
```

Fix the reported files and rerun the full local CI check.

### Frontend build fails

Run:

```bash
cd frontend
npm run build
```

Resolve the Vite or application error before opening or updating the pull request.

### Tests are not running

During the initial CI foundation, tests use:

```text
npm test --if-present
```

Check whether the relevant `package.json` defines a `test` script.

After the team's automated tests are merged, the CI scripts should be updated to require tests.

### Shell script permission error

From the repository root, run:

```bash
chmod +x scripts/*.sh
```

Then commit the executable permission changes.

---

## Team Ownership

The recommended Sprint 2 split is:

| Member   | Primary CI/CD Area                                                             |
| -------- | ------------------------------------------------------------------------------ |
| Member A | CI foundation, local CI scripts, build versioning, artifacts, CI documentation |
| Member B | Backend authentication and API automated tests                                 |
| Member C | Frontend automated tests and build validation                                  |
| Member D | SQLite initialization, seed, reset, and database CI tests                      |
| Member E | Dependency and security automation                                             |

Member A owns the shared CI foundation, but the pipeline should be structured so each member can extend their area through separate pull requests.

---

## Definition of Done for the CI Foundation

The Member A CI foundation is complete when:

- Local backend validation can be run with `./scripts/ci-backend.sh`
- Local frontend validation can be run with `./scripts/ci-frontend.sh`
- The full local pipeline can be run with `./scripts/ci-check.sh`
- A production frontend build can be created
- Build metadata can be generated with `generate-build-info.sh`
- The pipeline structure is documented
- A pull request checklist exists
- Other team members have clear extension points for their tests and automation
- The same scripts are ready to be called by the GitHub Actions workflow
