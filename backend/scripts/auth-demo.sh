#!/bin/sh

# backend/scripts/auth-demo.sh
#
# Demonstrates the complete Sprint 2 authentication workflow.
#
# The script:
#   1. Checks whether the backend is already running.
#   2. Starts a temporary backend if necessary.
#   3. Waits for the /health endpoint.
#   4. Registers a unique demonstration account.
#   5. Logs in and stores the session cookie.
#   6. Accesses the protected /api/auth/me endpoint.
#   7. Logs out.
#   8. Confirms the old session can no longer access /api/auth/me.
#   9. Stops the backend only if this script started it.

set -eu

# Use the normal local development URL unless another URL is explicitly
# provided when invoking the script.
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
HEALTH_URL="${BASE_URL}/health"

# Generate unique account information for every execution so repeated demo
# runs do not conflict with username/email UNIQUE constraints.
DEMO_SUFFIX="$(date +%s)"
DEMO_USERNAME="${DEMO_USERNAME:-demo_${DEMO_SUFFIX}}"
DEMO_EMAIL="${DEMO_EMAIL:-demo_${DEMO_SUFFIX}@example.com}"
DEMO_PASSWORD="${DEMO_PASSWORD:-ExamplePassword123!}"

# Temporary files used for the browser-style cookie jar and server output.
COOKIE_JAR="$(mktemp)"
SERVER_LOG="$(mktemp)"

# Track whether this script owns the backend process. An already-running server
# belongs to the developer and must not be stopped when the demo finishes.
STARTED_SERVER=0
SERVER_PID=""

# Wait up to 30 seconds for a newly started backend to become healthy.
MAX_STARTUP_ATTEMPTS=30
STARTUP_DELAY_SECONDS=1

#
# cleanup
#
# Always remove temporary files. If this script started the backend, terminate
# that specific Node process as well.
#
cleanup() {
  rm -f "$COOKIE_JAR"

  if [ "$STARTED_SERVER" -eq 1 ] && [ -n "$SERVER_PID" ]; then
    echo
    echo "=== Stopping temporary backend server ==="

    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi

  rm -f "$SERVER_LOG"
}

trap cleanup EXIT INT TERM

#
# server_is_ready
#
# Return success only when GET /health responds with a successful HTTP status.
# Response content is discarded because only availability matters here.
#
server_is_ready() {
  curl \
    --silent \
    --fail \
    --max-time 2 \
    "$HEALTH_URL" \
    >/dev/null 2>&1
}

#
# port_is_in_use
#
# Return success when something is already listening on the configured local
# backend port, even if that process does not respond to our /health endpoint.
#
# This prevents the demo from trying to start another Node server on a port
# that is already occupied.
#
port_is_in_use() {
  # This demo uses the project's standard port 3000 by default. ss returns a
  # matching LISTEN socket when another process currently owns that port.
  ss -ltn 2>/dev/null \
    | grep -q ':3000 '
}

#
# start_backend_if_needed
#
# Reuse an existing backend when possible. Otherwise start the Node server
# directly, remember its PID, and wait until /health reports success.
#
start_backend_if_needed() {
  if server_is_ready; then
    echo "Backend already running at $BASE_URL"
    return
  fi

  # A process may own port 3000 without actually being the expected backend.
  # Starting another server would fail with EADDRINUSE, so report the problem
  # clearly instead.
  if port_is_in_use; then
    echo
    echo "Port 3000 is already in use, but $HEALTH_URL is not responding."
    echo "Stop the process using port 3000 and run the demo again."
    echo
    echo "Inspect the port with:"
    echo "  ss -ltnp | grep ':3000'"
    exit 1
  fi

  echo "No backend detected at $BASE_URL"
  echo "Starting temporary backend server..."


  # Run the actual Node server rather than `npm run dev`. Tracking the Node PID
  # directly makes cleanup predictable and avoids leaving a child server alive.
  node src/server.js >"$SERVER_LOG" 2>&1 &

  SERVER_PID=$!
  STARTED_SERVER=1

  attempt=1

  while [ "$attempt" -le "$MAX_STARTUP_ATTEMPTS" ]; do
    if server_is_ready; then
      echo "Backend is ready."
      return
    fi

    # Check whether Node exited before it ever became healthy.
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      echo
      echo "Backend exited before becoming ready."
      echo
      echo "=== Backend startup log ==="
      cat "$SERVER_LOG"
      exit 1
    fi

    sleep "$STARTUP_DELAY_SECONDS"
    attempt=$((attempt + 1))
  done

  echo
  echo "Backend did not become ready."
  echo
  echo "=== Backend startup log ==="
  cat "$SERVER_LOG"
  exit 1
}

echo
echo "=== Sprint 2 Authentication Demo ==="
echo "Server:   $BASE_URL"
echo "Username: $DEMO_USERNAME"
echo "Email:    $DEMO_EMAIL"
echo

start_backend_if_needed

echo
echo "=== 1. Register ==="

curl -sS -i \
  -X POST \
  "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$DEMO_USERNAME\",
    \"email\": \"$DEMO_EMAIL\",
    \"password\": \"$DEMO_PASSWORD\"
  }"

echo
echo
echo "=== 2. Login and save session cookie ==="

curl -sS -i \
  -c "$COOKIE_JAR" \
  -X POST \
  "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$DEMO_EMAIL\",
    \"password\": \"$DEMO_PASSWORD\"
  }"

echo
echo
echo "=== 3. Access protected profile ==="

curl -sS -i \
  -b "$COOKIE_JAR" \
  "$BASE_URL/api/auth/me"

echo
echo
echo "=== 4. Logout ==="

curl -sS -i \
  -b "$COOKIE_JAR" \
  -c "$COOKIE_JAR" \
  -X POST \
  "$BASE_URL/api/auth/logout"

echo
echo
echo "=== 5. Confirm protected endpoint is rejected after logout ==="

curl -sS -i \
  -b "$COOKIE_JAR" \
  "$BASE_URL/api/auth/me"

echo
echo
echo "=== Authentication demo complete ==="
