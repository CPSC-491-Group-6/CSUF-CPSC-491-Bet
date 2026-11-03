# CI/CD Guide

## Purpose

This document defines the Continuous Integration / Continuous Delivery (CI/CD) workflow for the Bet project.

The pipeline supports automated backend, frontend, database, configuration, and security-related validation. It provides consistent local and GitHub Actions checks while maintaining the team's pull-request review requirements.

The Bet project uses:

- React and Vite for the frontend.
- Node.js and Express for the backend.
- SQLite for persistence.
- GitHub Actions for automated CI.
- npm lockfiles for reproducible dependency installation.
- GitHub environments, variables, and secrets for deployment configuration.

The CI/CD foundation was established during Sprint 2 and expanded during Sprints 3 and 4.

Sprint 4 includes SCRUM-750 / C-CICD-05, which introduces environment configuration separation and preflight validation. Transport-security verification is maintained as a distinct security validation responsibility.

---

## Repository Layout

The CI/CD components include:

```text
.github/
  workflows/
    ci.yaml
    format-audit.yaml
    naming-audit.yaml
    pr-labeler.yaml
  labeler.yml
  pull_request_template.md

backend/
  .env.example
  scripts/
    resetDatabase.js
    seedDatabase.js
  src/
    config/
      env.js
    data/

frontend/
  vite.config.js

docs/
  cicd.md

scripts/
  check-transport-security.sh
  ci-backend.sh
  ci-check.sh
  ci-env-check.sh
  ci-format-audit.sh
  ci-frontend.sh
  ci-naming-audit.sh
  generate-build-info.sh

.nvmrc
```

The two configuration and security validation scripts have distinct responsibilities:

- `ci-env-check.sh` validates environment configuration before CI or staging operations.
- `check-transport-security.sh` is the transport-security validation entry point and remains separate from environment configuration validation.

The transport-security script's exact assertions and integration point are governed by its implementation and should be documented alongside its owning security requirement.

---

## Local CI Workflow

From the repository root:

```bash
./scripts/ci-check.sh
```

The repository-wide CI runner executes advisory naming and whitespace audits, backend validation, frontend validation, and frontend build metadata generation.

Backend CI includes the SCRUM-750 environment configuration preflight.

### Environment Preflight

Run:

```bash
./scripts/ci-env-check.sh ci
```

CI mode validates:

- `NODE_ENV=test`.
- `DB_PATH=./data/ci-test.db`.
- `SESSION_SECRET` is configured and at least 32 characters long.
- `PORT`, when provided, is a valid TCP port.

The existing `ci-backend.sh` exports isolated CI values and invokes this validator before database cleanup and initialization.

### Transport Security

The transport-security validation entry point is:

```bash
./scripts/check-transport-security.sh
```

Transport-security validation is distinct from environment preflight validation.

Its purpose is to verify the application's defined transport-security requirements without duplicating environment configuration checks.

Transport security includes the project's HTTPS-related session and cookie behavior. Existing backend tests include checks that HTTPS sessions use protected cookies, HTTP does not incorrectly issue Secure cookies, and untrusted HTTPS headers cannot enable secure-cookie behavior.

The standalone transport-security script must be inspected to confirm its invocation, exact assertions, prerequisites, and whether it is currently executed by local CI or GitHub Actions.

Both scripts should return nonzero exit statuses for blocking validation failures and avoid exposing credentials or sensitive configuration values.

---

## Environment Configuration and Secrets

### Local Development

Local backend configuration uses `backend/.env`, based on `backend/.env.example`.

Local environment files are ignored by Git, while example files may be committed.

### GitHub CI

Backend CI uses an isolated SQLite database and a deterministic test-only session secret.

It does not require staging secrets.

### Staging

Staging configuration requires:

| Variable         | Type                 | Requirement                             |
| ---------------- | -------------------- | --------------------------------------- |
| `DB_PATH`        | Environment variable | Dedicated staging SQLite database       |
| `DEPLOY_ENV`     | Environment variable | `staging`                               |
| `NODE_ENV`       | Environment variable | `production`                            |
| `PORT`           | Environment variable | Staging backend port                    |
| `SESSION_SECRET` | Environment secret   | Unique secret of at least 32 characters |

Staging preflight can be invoked with:

```bash
./scripts/ci-env-check.sh staging
```

Required staging values must be supplied through the authorized deployment environment.

The preflight does not establish a deployment, initialize the staging database, or verify that the deployment host is reachable.

---

## Validation and Failure Behavior

### Environment Configuration Validation

The environment preflight rejects missing configuration, unsupported environment modes, invalid ports, short session secrets, and prohibited database configurations.

Successful preflight output is:

```text
[Environment] Configuration preflight passed.
```

Failed validation returns a nonzero exit status and identifies the invalid requirement without printing the session secret.

## Transport Security Validation

The Bet project includes an opt-in transport-security validation script:

```text
scripts/check-transport-security.sh
```

This script supports the CC67-TC01 and CC67-TC02 security validation requirements. It verifies the externally observable HTTPS and HTTP behavior of a deployed Bet application.

Transport-security validation is separate from the environment configuration preflight introduced under SCRUM-750.

### Purpose and Scope

The script verifies:

- HTTPS connectivity using the system's trusted certificate authorities.
- TLS 1.2 or newer for a successful HTTPS connection.
- Successful `GET /health` over HTTPS.
- HTTP-to-HTTPS redirection or explicit HTTP rejection on port 80.
- Redirect destinations that match the supplied HTTPS origin.

The script does not authenticate, submit credentials, transmit session cookies, modify application data, or perform database operations.

It sends an unauthenticated `GET /health` request to each applicable entry point.

### Usage

Run the script against an authorized deployed environment:

```bash
./scripts/check-transport-security.sh https://hostname
```

An explicit HTTPS port is also supported:

```bash
./scripts/check-transport-security.sh https://hostname:8443
```

The script requires:

- An explicit HTTPS origin.
- A DNS hostname or IPv4 address.
- An optional HTTPS port.
- An available `curl` installation.
- Network connectivity to the deployment.

Paths, query parameters, URL credentials, and IPv6 addresses are not supported by the current input validation.

The HTTP check always targets port 80 on the supplied hostname, regardless of the HTTPS port.

### CC67-TC01 — HTTPS Certificate and TLS Validation

The script requests:

```text
https://hostname/health
```

The request uses `curl` with:

```text
--proto '=https'
--tlsv1.2
```

Certificate and hostname verification remain enabled through curl's normal trust configuration.

The HTTPS request must complete successfully and return HTTP `200`.

A failed connection, certificate validation failure, TLS negotiation failure, or unexpected HTTP response causes the check to fail.

The script confirms successful negotiation with TLS 1.2 or newer. It does not establish whether older TLS protocol versions are disabled by the deployment.

### CC67-TC02 — HTTP Redirect or Rejection

After HTTPS validation succeeds, the script requests:

```text
http://hostname/health
```

The HTTP endpoint is evaluated without following redirects.

Accepted redirect status codes are:

- `301` — Moved Permanently.
- `302` — Found.
- `303` — See Other.
- `307` — Temporary Redirect.
- `308` — Permanent Redirect.

For an accepted redirect, the `Location` header must identify the supplied HTTPS origin or a path under that origin.

The script also accepts explicit HTTP rejection using:

- `400` — Bad Request.
- `403` — Forbidden.
- `426` — Upgrade Required.

An HTTP `200` response, an unexpected redirect destination, or another unsupported response status causes validation to fail.

If the HTTP endpoint cannot be reached, the script reports the result as inconclusive. Deployment network rules must then be inspected separately.

### Exit Codes

| Exit Code | Meaning                                  | Required Action                            |
| --------- | ---------------------------------------- | ------------------------------------------ |
| `0`       | Observed transport checks passed         | Record validation evidence                 |
| `1`       | A transport-security check failed        | Investigate and correct the deployment     |
| `2`       | Invalid input or missing prerequisite    | Correct invocation or environment          |
| `3`       | HTTP entry-point result was inconclusive | Verify external network exposure and retry |

The script is configured to fail rather than silently accept an unexpected HTTP response.

### CI/CD Integration

`check-transport-security.sh` is an opt-in deployment validation tool.

It is not part of the mandatory local CI execution sequence in `scripts/ci-check.sh` or the reviewed `.github/workflows/ci.yaml`.

This separation is intentional because a valid transport-security check requires a reachable deployment with externally configured HTTPS and HTTP entry points.

The script should be run after a staging deployment is available and whenever transport-related deployment configuration changes.

It should not be added to normal pull-request CI without an approved deployment environment and a separate integration plan.

### Relationship to Environment Preflight

| Validation                                   | `ci-env-check.sh` | `check-transport-security.sh` |
| -------------------------------------------- | ----------------- | ----------------------------- |
| Checks HTTP redirection or rejection         | No                | Yes                           |
| Checks HTTPS certificate trust               | No                | Yes                           |
| Requires a deployed application              | No                | Yes                           |
| Requires TLS 1.2+ for its HTTPS request      | No                | Yes                           |
| Runs through existing backend CI             | Yes               | No                            |
| Sends credentials or session cookies         | No                | No                            |
| Validates CI database isolation              | Yes               | No                            |
| Validates required environment variables     | Yes               | No                            |
| Validates session-secret presence and length | Yes               | No                            |
| Validates staging configuration values       | Yes               | No                            |
| Verifies HTTPS `/health` returns `200`       | No                | Yes                           |

The environment preflight verifies that required configuration is present and meets its defined validation rules.

The transport-security script verifies selected externally observable security properties after an application has been deployed.

Both are necessary parts of the overall configuration and deployment validation strategy, but they serve different stages of the workflow.

### Validation Evidence

For each deployment transport-security check, record:

1. Deployment environment and target hostname.
2. Execution date.
3. Script invocation, without credentials.
4. Exit code.
5. HTTPS certificate and TLS check result.
6. HTTP redirect or rejection check result.
7. Any inconclusive network conditions.
8. Related Jira issue or pull request.

An exit code of `0` confirms that the sampled transport checks passed. It does not establish complete transport security across all endpoints, clients, proxy configurations, or supported protocol versions.

### Ownership

The deployment or security owner is responsible for external HTTPS configuration, certificate management, and HTTP redirection or rejection behavior.

The CI/CD owner maintains integration guidance and documentation.

Changes to transport-security enforcement or deployment infrastructure require coordination with the appropriate owner.

The implementation of `check-transport-security.sh` should remain associated with its CC67 validation requirements rather than being absorbed into SCRUM-750's environment configuration scope.

### Full CI Validation

Run:

```bash
./scripts/ci-check.sh
```

The previously recorded complete local CI validation produced:

| Validation                | Result                           |
| ------------------------- | -------------------------------- |
| Backend formatting        | Passed                           |
| Backend tests             | 141 passed, 10 skipped, 0 failed |
| Build metadata generation | Passed                           |
| Environment preflight     | Passed                           |
| Frontend ESLint           | Passed                           |
| Frontend formatting       | Passed                           |
| Frontend production build | Passed                           |
| Frontend tests            | 62 passed, 0 failed              |
| Naming audit              | 95 files checked, 0 violations   |

The transport-security script's standalone execution result must be recorded separately unless its inclusion in the validated CI command is confirmed.

---

## Build Versioning and Artifacts

Successful frontend builds produce:

```text
frontend/dist/
```

The repository generates build metadata using:

```bash
./scripts/generate-build-info.sh frontend/dist
```

The generated metadata is stored at:

```text
frontend/dist/BUILD_INFO.txt
```

Successful push-triggered builds on `main` are uploaded to GitHub Actions as versioned frontend artifacts.

The configured artifact retention period is 30 days, subject to repository and organization limits.

---

## CI/CD and Security Ownership

| Component                         | Responsibility                                  |
| --------------------------------- | ----------------------------------------------- |
| `.github/workflows/ci.yaml`       | GitHub Actions CI orchestration                 |
| `backend/scripts/seedDatabase.js` | Development and test fixture seeding            |
| `backend/src/config/env.js`       | Backend application configuration validation    |
| `check-transport-security.sh`     | Transport-security validation                   |
| `ci-backend.sh`                   | Backend validation and CI preflight integration |
| `ci-check.sh`                     | Repository-wide local validation                |
| `ci-env-check.sh`                 | CI and staging configuration validation         |
| `ci-frontend.sh`                  | Frontend validation and production build        |
| `generate-build-info.sh`          | Build metadata generation                       |

The CI/CD owner maintains shared validation integration and documentation.

The backend and security owners retain responsibility for the behavior tested by the transport-security checks.

The database owner retains responsibility for database initialization, schema, and persistence behavior.

The authorized deployment owner manages staging configuration and secret rotation.

Changes to another member's code require coordination before implementation.

---

## Pull Request Workflow

Before opening a pull request:

1. Confirm the correct feature branch.
2. Review changes for ownership conflicts.
3. Execute relevant local validation scripts.
4. Run `./scripts/ci-check.sh`.
5. Run applicable security checks.
6. Review the Git diff and staged files.
7. Verify that no credentials or generated runtime databases are committed.
8. Commit using the corresponding SCRUM issue identifier.
9. Push the feature branch.
10. Create a pull request using the repository template.
11. Link the corresponding Jira issue.
12. Obtain another group member's approval.
13. Confirm required GitHub Actions checks pass before merging.

Direct pushes to `main` are not part of the team's contribution process.

---

## Sprint 4 — SCRUM-750 Validation

SCRUM-750 introduces environment configuration preflight validation and integrates it with the existing backend CI runner.

The implementation includes:

- Broader `.gitignore` protection for local environment files.
- `scripts/ci-env-check.sh`.
- Blocking preflight integration in `scripts/ci-backend.sh`.
- CI and staging validation modes.
- Configuration separation without introducing staging secrets into pull-request CI.
- Removal of intentional demo-credential logging from the updated database seeder.
- Documentation of environment requirements and ownership.

Local backend CI and complete local CI passed following the initial preflight integration.

Final validation of the updated seeder, staging environment configuration, and GitHub Actions PR checks must be recorded before the Jira issue is closed.

The separate `check-transport-security.sh` remains documented as part of the project's security validation tooling.

---

## Definition of Done

The CI/CD configuration work is complete when:

- [ ] Required local, CI, and staging configuration is documented.
- [ ] Local environment files remain excluded from source control.
- [ ] Configuration preflight validation succeeds with valid values.
- [ ] Missing or invalid required configuration causes a nonzero failure.
- [ ] Environment preflight executes before CI database operations.
- [ ] Sensitive values are not intentionally printed by modified scripts.
- [ ] Applicable transport-security validation remains operational.
- [ ] Staging environment configuration is verified.
- [ ] Environment configuration ownership and update procedures are documented.
- [ ] Backend and frontend local validation passes.
- [ ] Required GitHub Actions checks pass.
- [ ] Evidence is linked to SCRUM-750.
- [ ] Another group member approves the pull request before merge.
