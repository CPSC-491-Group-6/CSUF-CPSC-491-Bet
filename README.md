<!-- README.md -->
<!-- Main project overview. Update links, status, and scope as the project evolves. -->

# Bet

**Bet** is a CPSC 491 senior capstone project at **California State University, Fullerton**. We are building a full-stack social wagering application where friends can create, join, manage, and resolve friendly bets.

> **Current focus: Sprint 3 - Create and List Bets**  
> The team is working on bet creation and listing, API contracts, test integration, and CI/CD improvements. This is a development project, not a production betting service.

**Quick navigation:** [Features](#features-and-scope) | [Technology](#technology-stack) | [Getting started](#getting-started) | [Testing and CI/CD](#testing-and-cicd) | [Roadmap](#development-roadmap) | [Documentation](#documentation) | [Contributing](#contributing)

## Features and scope

The planned minimum viable product (MVP) includes:

- Account registration, login, logout, and protected routes.
- A personal dashboard with the user's bets.
- Bet creation and listing.
- Joining bets using an invite code.
- Participant management and creator-only bet locking.
- Bet resolution, state management, and history.

**Out of scope for the MVP:** Real-money transactions, payment processing, betting odds, chat, and advanced notifications.

These are project goals; they are not a claim that every feature is complete.

## Technology stack

| Area                           | Technologies                      |
| ------------------------------ | --------------------------------- |
| Frontend                       | React, Vite, JavaScript           |
| Backend                        | Node.js, Express                  |
| Database                       | SQLite                            |
| Version control and automation | Git, GitHub, GitHub Actions       |
| Planning and collaboration     | Jira, Google Docs/Sheets, ChatGPT |

## Getting started

1. Clone the [Bet repository](https://github.com/CPSC-491-Group-6/CSUF-CPSC-491-Bet) and open it in your development environment.
2. Follow the component-specific setup instructions in the [backend README](backend/README.md) and [frontend README](frontend/README.md).
3. From the repository root, run the shared validation command below.

```bash
./scripts/ci-check.sh
```

The shared command delegates to the backend and frontend CI scripts. For script-specific behavior and prerequisites, see [scripts/README.md](scripts/README.md). For database setup, see [backend/docs/database.md](backend/docs/database.md).

## Testing and CI/CD

The project uses local CI helper scripts and GitHub Actions to validate changes before merging pull requests into `main` and after pushes to `main`.

| Command or file                | Purpose                                                 |
| ------------------------------ | ------------------------------------------------------- |
| `./scripts/ci-check.sh`        | Run the full local validation sequence                  |
| `./scripts/ci-backend.sh`      | Validate backend tests and database operations          |
| `./scripts/ci-frontend.sh`     | Validate frontend lint, tests, and production build     |
| `./scripts/ci-naming-audit.sh` | Report filename convention warnings without blocking CI |
| `.github/workflows/`           | GitHub Actions workflow definitions                     |

The naming audit is advisory; it does not rename files or replace required checks. For CI architecture, build metadata, artifacts, and troubleshooting, see [docs/CICD.md](docs/CICD.md).

## Development roadmap

| Sprint                       | Focus               | Planned deliverables                                                                                  |
| ---------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------- |
| **1 - Planning**             | Scope and design    | Requirements, acceptance criteria, timeline, frontend/backend/database plans, testing strategy, risks |
| **2 - Authentication**       | Account foundation  | Registration, login, logout, protected routes, user persistence, authentication testing               |
| **3 - Create and List Bets** | Core bet workflow   | Create Bet UI, dashboard, Create Bet API, List My Bets API, bet model                                 |
| **4 - Join and Lock Bets**   | Participation       | Bet details, invite-code joins, participant management, creator-only lock, authorization tests        |
| **5 - Resolve and History**  | Completion workflow | Bet resolution, history, state transitions, authorization, full-system testing                        |
| **6 - Release**              | Stabilization       | Integration, regression testing, fixes, documentation, reproducible build, final demonstration        |

This table reflects the planned capstone sequence; implementation status is tracked in Jira and pull requests.

## Application workflow

```text
Register / Login
       |
       v
   Dashboard
       |
       v
   Create Bet
       |
       v
    List Bets
       |
       v
  Join by Code
       |
       v
    Lock Bet
       |
       v
   Resolve Bet
       |
       v
   Bet History
```

The diagram summarizes the intended user journey, not the complete set of application routes or states.

## Documentation

Start with the [CI/CD guide](docs/CICD.md), [naming conventions](docs/naming_conventions.md), or the [backend documentation](backend/README.md). The following index links to the Markdown files confirmed on the SCRUM-802 feature branch. Update it when other documentation is merged.

<!-- BEGIN DOCUMENTATION INDEX -->

### `.github/`

- [pull_request_template.md](.github/pull_request_template.md)

### `backend/`

- [README.md](backend/README.md)
- [backend.md](backend/backend.md)

### `backend/docs/`

- [authentication-api.md](backend/docs/authentication-api.md)
- [authentication-design.md](backend/docs/authentication-design.md)
- [database.md](backend/docs/database.md)
- [testing.md](backend/docs/testing.md)

### `docs/`

- [CICD.md](docs/CICD.md)
- [naming_conventions.md](docs/naming_conventions.md)

### `frontend/`

- [README.md](frontend/README.md)

### `scripts/`

- [README.md](scripts/README.md)

### `templates/`

- [jira_description_template.md](templates/jira_description_template.md)
- [pull_request_template.md](templates/pull_request_template.md)

<!-- END DOCUMENTATION INDEX -->

## Risks and mitigation

| Risk                  | Likelihood | Impact | Mitigation                                                               |
| --------------------- | ---------- | ------ | ------------------------------------------------------------------------ |
| Schedule delays       | Medium     | High   | Prioritize MVP features and defer optional functionality.                |
| Integration conflicts | Medium     | High   | Integrate continuously across sprints.                                   |
| Uneven workload       | Medium     | High   | Rebalance responsibilities as needed.                                    |
| Merge conflicts       | Medium     | Medium | Use focused branches, small PRs, reviews, and frequent synchronization.  |
| Setup inconsistencies | Medium     | Medium | Use current repository instructions and validate in a fresh environment. |
| Functional defects    | Medium     | High   | Repeatedly test integrated builds and review failures.                   |

## Contributing

- Work on a dedicated feature branch; do not push application changes directly to `main`.
- Follow the [PR template](.github/pull_request_template.md), [Jira description template](templates/jira_description_template.md), and [naming conventions](docs/naming_conventions.md).
- Use commit headers in the format `[SCRUM-###] type: concise synopsis`.
- Record completed and pending validation accurately in the PR.
- Obtain another team member's approval and all required checks before merging.

This repository is maintained by the CPSC 491 Bet project team for its senior capstone coursework.
