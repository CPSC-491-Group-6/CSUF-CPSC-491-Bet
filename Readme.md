# Bet

Bet is a senior capstone project for CPSC 491 at California State University, Fullerton.

The goal of the project is to build a social wagering application where users can create, join, manage, and resolve friendly bets with other users. The application will focus on the software engineering aspects of account management, bet creation, participation, bet state management, history, and testing.

> **Current Status:** Sprint 1 — Project Planning  
> The team is currently defining project scope, requirements, architecture, development tasks, dependencies, and the semester implementation timeline.

---

## Project Goal

Our goal is to develop a working full-stack application that allows users to:

- Register and log in
- View a personal dashboard
- Create bets
- View their bets
- Join bets using an invite code
- Lock bets when participation is complete
- Resolve completed bets
- View previous bet history

Real-money transactions, payment processing, betting odds, chat, and advanced notification systems are currently outside the planned MVP scope.

---

## Planned MVP

The current planned development sequence is:

### Sprint 1 — Planning
- Define project scope
- Create semester timeline
- Define requirements and acceptance criteria
- Plan frontend screens
- Plan backend/API endpoints
- Plan database structure
- Define testing strategy and Definition of Done
- Identify project dependencies and risks

### Sprint 2 — Authentication Foundation
- Register
- Login
- Logout
- Protected routes
- User database
- Authentication testing

### Sprint 3 — Create and List Bets
- Create Bet interface
- Dashboard
- Create Bet API
- List My Bets API
- Bet database model

### Sprint 4 — Join and Lock Bets
- Bet Detail page
- Join by invite code
- Participant management
- Creator-only lock functionality
- Authorization testing

### Sprint 5 — Resolve and History
- Resolve Bet functionality
- Bet history
- Bet state transitions
- Resolution authorization
- Full-system testing

### Sprint 6 — Release
- Final integration
- Regression testing
- Bug fixes
- Documentation
- Production/reproducible build
- Final demonstration preparation

---

## Planned Technology Stack

The current planned stack is:

### Frontend
- React
- Vite
- JavaScript

### Backend
- Node.js
- Express

### Database
- SQLite

### Development Tools
- Git
- GitHub
- ChatGPT
- Google Docs / Sheets

These technologies may change as the team evaluates the project during development.

---

## Planned Application Flow

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
