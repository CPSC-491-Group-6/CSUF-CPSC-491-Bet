# Authentication API

This document defines the current Sprint 2 authentication HTTP contract.

The backend uses Argon2id password hashing and SQLite-backed server-side sessions. The browser receives only an opaque signed session-ID cookie named `sid`.

## Base URL

Default local development URL:

```text
http://127.0.0.1:3000
```

## Response conventions

Successful authentication responses return a safe user representation:

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

Neither plaintext passwords nor `passwordHash` values are returned by the API.

Expected application errors use:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message."
  }
}
```

Validation failures may additionally include:

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

Unexpected internal failures return a generic `INTERNAL_ERROR` instead of exposing database messages, stack traces, or other internal details.

## POST `/api/auth/register`

Create a new account.

### Request

```json
{
  "username": "TestUser",
  "email": "test@example.com",
  "password": "ExamplePassword123!"
}
```

Example:

```bash
curl -i   -X POST   http://127.0.0.1:3000/api/auth/register   -H "Content-Type: application/json"   -d '{
    "username": "TestUser",
    "email": "test@example.com",
    "password": "ExamplePassword123!"
  }'
```

### Successful response

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

### Duplicate email

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

### Duplicate username

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

### Invalid input

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

## POST `/api/auth/login`

Verify existing credentials and establish an authenticated server-side session.

### Request

```json
{
  "email": "test@example.com",
  "password": "ExamplePassword123!"
}
```

Example using a cookie jar:

```bash
curl -i   -c cookies.txt   -X POST   http://127.0.0.1:3000/api/auth/login   -H "Content-Type: application/json"   -d '{
    "email": "test@example.com",
    "password": "ExamplePassword123!"
  }'
```

### Successful response

```text
200 OK
```

The response body contains the safe user object.

The response also includes a session cookie similar to:

```text
Set-Cookie: sid=...; Path=/; HttpOnly; SameSite=Lax
```

The actual authenticated state is stored in SQLite, not in the cookie.

### Invalid credentials

Unknown emails and incorrect passwords deliberately return the same public response:

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

This prevents the endpoint from revealing whether a specific email address has an account.

## GET `/api/auth/me`

Return the profile associated with the current authenticated session.

### Request

```bash
curl -i   -b cookies.txt   http://127.0.0.1:3000/api/auth/me
```

### Successful response

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

### Missing or invalid session

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

If a session refers to a user record that no longer exists, the stale session is invalidated and the request is treated as unauthenticated.

## POST `/api/auth/logout`

Destroy the current authenticated server-side session.

### Request

```bash
curl -i   -b cookies.txt   -c cookies.txt   -X POST   http://127.0.0.1:3000/api/auth/logout
```

### Successful response

```text
204 No Content
```

Logout:

1. destroys the SQLite session,
2. clears the `sid` cookie,
3. prevents the previous session from reaching protected routes.

Subsequent requests to `/api/auth/me` using the old session return `401 AUTH_REQUIRED`.

## GET `/health`

Verify that the backend is available.

```bash
curl http://127.0.0.1:3000/health
```

Expected response:

```json
{
  "status": "ok"
}
```

## Automated verification

Run the auth tests:

```bash
npm run test:auth
```

Run the live demonstration:

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
