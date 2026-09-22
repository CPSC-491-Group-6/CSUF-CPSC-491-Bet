<!-- ./scripts/README.md -->
<!-- CI Helper Scripts -->
<!-- This is a simple README for the CI helper scripts. -->
<!-- This file should be updated when scripts are added or modified. -->

# CI Helper Scripts

This directory contains local CI helper scripts for the Bet project.

These scripts are designed to mirror the checks used by the GitHub Actions CI pipeline so developers can catch problems locally before pushing code or opening a pull request.

The goal is to keep local validation and GitHub validation as consistent as possible.

---

## Available Scripts

### `ci-check.sh`

Runs the complete local CI workflow.

```bash
./scripts/ci-check.sh
```

This script runs:

1. Backend CI checks
2. Frontend CI checks

It should be the main command developers run before opening or updating a pull request.

Internally, it calls:

```text
ci-backend.sh
ci-frontend.sh
```

Keeping the backend and frontend checks in separate scripts allows different team members to extend their area without repeatedly editing the same file.

---

## `ci-backend.sh`

Runs backend-specific CI validation.

```bash
./scripts/ci-backend.sh
```

Current checks include:

```text
npm ci
npm test --if-present
```

### What the backend checks verify

- The `backend/` directory exists
- `backend/package.json` exists
- `backend/package-lock.json` exists
- Backend dependencies can be installed from the lockfile
- Backend tests run if a `test` script is currently defined

### Why `npm ci` is used

The CI scripts use:

```bash
npm ci
```

instead of:

```bash
npm install
```

`npm ci` performs a clean dependency installation using the exact dependency versions recorded in `package-lock.json`.

This helps make local CI and GitHub Actions builds reproducible.

### Temporary backend test behavior

The backend currently uses:

```bash
npm test --if-present
```

This allows the CI foundation to work before all automated backend tests have been implemented.

Once the backend automated test suite is added, this should be changed to:

```bash
npm test
```

At that point, missing or failing backend tests should cause CI to fail.

### Future backend additions

Backend contributors can extend `ci-backend.sh` with additional checks such as:

- Authentication tests
- API endpoint tests
- Authorization tests
- SQLite initialization tests
- Database seed tests
- Database reset tests
- Integration tests
- Test coverage reporting

Backend-specific checks should normally be added to `ci-backend.sh` rather than directly to `ci-check.sh`.

---

## `ci-frontend.sh`

Runs frontend-specific CI validation.

```bash
./scripts/ci-frontend.sh
```

Current checks include:

```text
npm ci
npm run lint
npm test --if-present
npm run build
```

### What the frontend checks verify

- The `frontend/` directory exists
- `frontend/package.json` exists
- `frontend/package-lock.json` exists
- Frontend dependencies can be installed from the lockfile
- ESLint passes
- Frontend tests run if a `test` script currently exists
- The React/Vite application can produce a production build
- The expected `frontend/dist/` directory is created

### Temporary frontend test behavior

The frontend currently uses:

```bash
npm test --if-present
```

This allows the CI foundation to be merged before the frontend automated test suite is complete.

Once frontend automated tests are available, change this to:

```bash
npm test
```

This makes frontend testing mandatory.

### Future frontend additions

Frontend contributors can extend `ci-frontend.sh` with checks such as:

- React component tests
- Authentication form tests
- Route tests
- Dashboard tests
- Create Bet tests
- Build validation
- Test coverage reporting

Frontend-specific checks should normally be added to `ci-frontend.sh`.

---

## `generate-build-info.sh`

Generates metadata that uniquely identifies a build.

Example:

```bash
./scripts/generate-build-info.sh frontend/dist
```

The generated file is:

```text
frontend/dist/BUILD_INFO.txt
```

This makes it possible to determine which Git commit and CI execution produced a particular build artifact.

---

## Build Version Format

When the script runs inside GitHub Actions, it uses:

```text
ci-<run-number>.<attempt>-<short-commit-sha>
```

Example:

```text
ci-42.1-a12bc34
```

Where:

```text
42       = GitHub Actions workflow run number
1        = workflow attempt number
a12bc34  = shortened Git commit SHA
```

If the same workflow is rerun, the attempt number changes.

For example:

```text
ci-42.2-a12bc34
```

This allows multiple attempts of the same build to be uniquely identified.

---

## Local Build Versions

The build-information script can also run locally.

When GitHub Actions environment variables are unavailable, the script uses:

```text
local-<UTC timestamp>-<short-commit-sha>
```

Example:

```text
local-20260921T231500Z-a12bc34
```

This allows developers to test build-version generation before changes are merged into the GitHub Actions pipeline.

---

## Example Local Build Workflow

To validate the entire project locally:

```bash
./scripts/ci-check.sh
```

If the checks pass, the frontend production build should exist at:

```text
frontend/dist/
```

Build metadata can then be generated with:

```bash
./scripts/generate-build-info.sh frontend/dist
```

The resulting directory may look similar to:

```text
frontend/dist/
├── assets/
├── index.html
└── BUILD_INFO.txt
```

---

## Making the Scripts Executable

After cloning the repository or adding new scripts, make sure the shell scripts are executable.

From the repository root:

```bash
chmod +x scripts/*.sh
```

Then stage the permission changes:

```bash
git add scripts
```

Git tracks executable permissions, so these changes should be committed.

---

## Expected Repository Structure

The CI helper scripts expect the repository to contain:

```text
.
├── backend/
│   ├── package.json
│   └── package-lock.json
│
├── frontend/
│   ├── package.json
│   └── package-lock.json
│
└── scripts/
    ├── README.md
    ├── ci-backend.sh
    ├── ci-check.sh
    ├── ci-frontend.sh
    └── generate-build-info.sh
```

The scripts determine the repository root automatically, so they can be launched from locations other than the project root.

---

## Adding New CI Scripts

If a new category of CI checks becomes large enough to justify its own script, create a separate script instead of placing unrelated logic into an existing file.

For example:

```text
scripts/
├── ci-backend.sh
├── ci-check.sh
├── ci-database.sh
├── ci-frontend.sh
└── generate-build-info.sh
```

The new script can then be called from:

```text
ci-check.sh
```

For example:

```text
Backend CI
    |
    v
Database CI
    |
    v
Frontend CI
```

This keeps each script focused and reduces merge conflicts.

---

## Guidelines for Contributors

When extending these scripts:

- Keep backend-specific logic in `ci-backend.sh`
- Keep frontend-specific logic in `ci-frontend.sh`
- Create a dedicated script for large new CI areas
- Keep `ci-check.sh` focused on orchestrating the full local CI run
- Use non-interactive commands that can run in GitHub Actions
- Make failures return a non-zero exit code
- Avoid depending on developer-specific files or local state
- Do not use a developer's normal SQLite database for automated tests
- Do not commit secrets, credentials, `node_modules`, local database files, or generated build output unless explicitly required

---

## Relationship to GitHub Actions

The GitHub Actions workflow should reuse these scripts wherever practical.

For example:

```yaml
- name: Run backend checks
  run: ./scripts/ci-backend.sh

- name: Run frontend checks
  run: ./scripts/ci-frontend.sh
```

This avoids maintaining one set of commands for developers and another set of commands for GitHub Actions.

If a CI check fails on GitHub, a developer should usually be able to reproduce it locally by running the corresponding script.

---

## Recommended Developer Workflow

Before opening a pull request:

```bash
git pull
./scripts/ci-check.sh
```

If the checks pass:

```bash
git add .
git commit -m "Describe the completed work"
git push
```

Then open or update the pull request and wait for the GitHub Actions checks to complete.

Code should only be merged after:

- Required CI checks pass
- Another group member reviews the pull request
- Any required review comments are resolved

---

## Future Improvements

These scripts are intended to grow with the project.

Possible later additions include:

- Dedicated database CI
- API integration tests
- Frontend component tests
- End-to-end tests
- Test coverage reports
- Dependency security checks
- Staging deployment validation
- Smoke tests
- Release packaging
- Production deployment checks

The scripts should remain simple enough that developers can understand and reproduce the CI process locally.
