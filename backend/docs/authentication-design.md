# Authentication Design

This document records the Sprint 2 authentication architecture and the reasoning behind the current implementation.

It is a technical design reference, not a sprint checklist. Sprint completion status is tracked in [`../backend.md`](../backend.md).

## Goals

Sprint 2 authentication must allow a user to:

1. register,
2. log in,
3. establish authenticated server-side state,
4. reach protected content,
5. retrieve their profile,
6. log out,
7. lose access to protected content after logout.

The implementation should also remain easy to replace or extend in later sprints.

## Chosen approach

The current design uses:

```text
Password hashing:  Argon2id
Authentication:    Server-side sessions
Session transport: Signed HttpOnly cookie
Session storage:   SQLite
User storage:      SQLite
Authorization:     Express middleware
Validation:        Zod
```

## Password handling

Plaintext passwords are accepted only as request input.

Registration flow:

```text
plaintext password
      ↓
validation
      ↓
Argon2id
      ↓
encoded passwordHash
      ↓
SQLite users.passwordHash
```

The database never stores a recoverable plaintext password.

The current Argon2id configuration is:

```text
memoryCost:  19456 KiB
timeCost:    2
parallelism: 1
```

The encoded Argon2id result contains the algorithm parameters and salt, so no separate salt column is required.

Password handling is isolated behind:

```text
src/services/passwordService.js
```

Public operations:

```text
hashPassword(password)
verifyPassword(passwordHash, password)
```

## Login identity

Login currently uses email plus password.

Email input is normalized to lowercase before lookup.

Username display capitalization is preserved, while username uniqueness and lookup behavior are case-insensitive.

Unknown email addresses and incorrect passwords return the same public error:

```text
INVALID_CREDENTIALS
```

This avoids revealing whether a specific account exists.

## Server-side sessions

A successful login produces:

```text
valid credentials
      ↓
regenerate session ID
      ↓
req.session.userID = user.userID
      ↓
save session to SQLite
      ↓
send signed sid cookie
```

The browser cookie contains only the opaque signed session identifier.

It does not contain:

- `userID`,
- username,
- email,
- password,
- `passwordHash`,
- authorization state.

The actual session record remains on the server.

## Session contents

The authenticated session intentionally stores only the minimum identity needed:

```js
{
  userID: 42;
}
```

Profile information is loaded from the `users` table when needed.

This avoids stale copies of user data inside session state.

## Session cookie

Current cookie behavior:

```text
name:     sid
HttpOnly: true
SameSite: Lax
Secure:   production only
maxAge:   24 hours
```

`HttpOnly` prevents frontend JavaScript from reading the authentication cookie.

`Secure` is disabled for local HTTP development and enabled when `NODE_ENV=production`.

## Session persistence

Sessions are stored in SQLite using the custom `SqliteSessionStore`.

The store implements:

```text
get()
set()
destroy()
touch()
```

`touch()` refreshes expiration for active sessions and supports `resave: false`.

Expired sessions are treated as missing and removed.

## Session fixation protection

After credentials are verified, login calls:

```text
req.session.regenerate()
```

before storing `userID`.

The authenticated user therefore receives a new session identifier rather than continuing an identifier that existed before login.

## Protected routes

Protected endpoints use:

```text
src/middleware/requireAuth.js
```

The middleware checks:

```text
req.session.userID
```

If the value is missing, the request returns:

```text
401 AUTH_REQUIRED
```

The middleware is reusable for future routes such as:

```text
POST /api/bets
POST /api/bets/:id/join
POST /api/bets/:id/lock
POST /api/bets/:id/resolve
```

## Current-user lookup

`GET /api/auth/me` uses the `userID` stored in the session to retrieve the current database record.

Flow:

```text
sid cookie
   ↓
express-session
   ↓
SQLite session
   ↓
req.session.userID
   ↓
authService.getCurrentUser()
   ↓
userRepository.findById()
   ↓
safe user response
```

If the referenced user no longer exists, the stale session is destroyed and the request becomes unauthenticated.

## Logout

Logout performs both parts of invalidation:

```text
destroy SQLite session
      +
clear sid cookie
```

Deleting only the browser cookie would leave server-side state alive, so both operations are required.

## Application layers

The authentication implementation follows:

```text
Route
  ↓
Controller
  ↓
Service
  ↓
Repository
  ↓
SQLite
```

### Routes

Routes map HTTP methods and paths to controllers and middleware.

Example:

```text
POST /api/auth/login
```

### Controllers

Controllers handle HTTP-specific behavior:

- `req`,
- `res`,
- session regeneration,
- session persistence,
- cookie clearing,
- HTTP status codes.

Controllers do not contain SQL.

### Services

Services implement authentication business rules:

- validation,
- normalization,
- duplicate checks,
- password hashing,
- credential verification,
- safe-user conversion.

Services do not construct HTTP responses.

### Repositories

Repositories contain SQLite queries and hide SQL details from services/controllers.

Current user repository operations:

```text
createUser()
findById()
findByEmail()
findByUsername()
```

## Dependency injection and testability

Factories are used for components that need replaceable dependencies:

```text
createUserRepository(database)
createAuthService({ userRepository, passwordService })
createAuthController({ authService })
createAuthRouter({ authService })
createApp({ authService, sessionMiddleware })
```

This allows tests to use:

- in-memory SQLite,
- deterministic password-service fakes,
- test session stores,

without touching `data/bet.db`.

## Standardized errors

Expected authentication failures use `AppError`.

Current codes include:

```text
VALIDATION_ERROR
EMAIL_ALREADY_EXISTS
USERNAME_ALREADY_EXISTS
INVALID_CREDENTIALS
AUTH_REQUIRED
```

Unexpected errors return:

```text
INTERNAL_ERROR
```

The global error middleware avoids exposing internal implementation details to clients.

## Future changes

This design can be changed later without replacing the entire user model.

Potential future work includes:

- CSRF strategy review if deployment topology changes,
- session expiration policy changes,
- stronger production cookie/domain configuration,
- rate limiting,
- account verification flows,
- password reset flows,
- session revocation/admin controls,
- migration to another session store,
- migration to token-based authentication if the project later requires it.

These are not required to satisfy the current Sprint 2 increment.
