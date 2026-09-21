# Authentication API Documentation

The Sprint 2 backend uses Argon2id password hashing and SQLite-backed server-side sessions.

The browser receives only an opaque signed session-ID cookie named `sid`. Authenticated user state is stored on the server in SQLite.

## Development setup

Initialize the database:

```bash
npm run db:init
```

Start the backend:

```bash
npm run dev
```

The default development server is:

```text
http://localhost:3000
```

A valid `SESSION_SECRET` must exist in `.env` before the backend will start.

---

## Register

### Register request

```http
POST /api/auth/register
Content-Type: application/json
```

Example:

```json
{
  "username": "TestUser",
  "email": "test@example.com",
  "password": "ExamplePassword123!"
}
```

Example curl command:

```bash
curl -i \
  -X POST \
  http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "TestUser",
    "email": "test@example.com",
    "password": "ExamplePassword123!"
  }'
```

### Register successful response

```text
201 Created
```

```json
{
  "user": {
    "userID": 1,
    "username": "TestUser",
    "email": "test@example.com",
    "verificationStatus": 0,
    "timeStamp": "2026-09-21 12:00:00"
  }
}
```

The plaintext password and `passwordHash` are never included in the API response.

---

## Login

### Login request

```http
POST /api/auth/login
Content-Type: application/json
```

Example:

```json
{
  "email": "test@example.com",
  "password": "ExamplePassword123!"
}
```

Example using a curl cookie jar:

```bash
curl -i \
  -c cookies.txt \
  -X POST \
  http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "ExamplePassword123!"
  }'
```

### Login successful response

```text
200 OK
```

The response includes the safe user representation and a `Set-Cookie` header containing the signed `sid` session identifier.

Example cookie attributes:

```text
sid=...; Path=/; HttpOnly; SameSite=Lax
```

The session itself is stored in SQLite.

---

## Current User

### Current user request

```http
GET /api/auth/me
```

The request must include a valid authenticated session cookie.

Example:

```bash
curl -i \
  -b cookies.txt \
  http://localhost:3000/api/auth/me
```

### Current user successful response

```text
200 OK
```

```json
{
  "user": {
    "userID": 1,
    "username": "TestUser",
    "email": "test@example.com",
    "verificationStatus": 0,
    "timeStamp": "2026-09-21 12:00:00"
  }
}
```

### Missing authentication

```text
401 Unauthorized
```

```json
{
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Authentication is required."
  }
}
```

---

## Logout

### Logout request

```http
POST /api/auth/logout
```

Example:

```bash
curl -i \
  -b cookies.txt \
  -c cookies.txt \
  -X POST \
  http://localhost:3000/api/auth/logout
```

### Logout successful response

```text
204 No Content
```

Logout destroys the corresponding server-side SQLite session and clears the browser's `sid` cookie.

Requests to protected endpoints using the old session will subsequently return `401 Unauthorized`.

---

## Authentication Errors

Invalid login credentials return the same response whether the email address does not exist or the password is incorrect.

```text
401 Unauthorized
```

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password."
  }
}
```

Duplicate email registration:

```text
409 Conflict
```

```json
{
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "An account with that email already exists."
  }
}
```

Duplicate username registration:

```text
409 Conflict
```

```json
{
  "error": {
    "code": "USERNAME_ALREADY_EXISTS",
    "message": "That username is already in use."
  }
}
```

Invalid request data:

```text
400 Bad Request
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The authentication request contains invalid input.",
    "details": [
      {
        "field": "email",
        "message": "Email must be a valid email address."
      }
    ]
  }
}
```

Unexpected server errors return a generic response rather than exposing internal database or application information.

```text
500 Internal Server Error
```

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected server error occurred."
  }
}
```

---

## Automated Verification

Run all backend tests:

```bash
npm test
```

Run only authentication-related tests:

```bash
npm run test:auth
```

Run the health test:

```bash
npm run test:health
```

Run the complete authentication demonstration while the backend is running:

```bash
npm run demo:auth
```

The demo performs:

```text
register
→ login
→ authenticated /me
→ logout
→ rejected /me
```
