#!/bin/sh

# backend/scripts/auth-demo.sh
#
# Demonstrates the complete Sprint 2 authentication workflow.
#
# The script:
#   1. Checks whether the configured backend is already healthy.
#   2. Starts a temporary local backend if necessary.
#   3. Waits for GET /health to succeed.
#   4. Registers a unique demonstration account.
#   5. Logs in and stores the session cookie.
#   6. Accesses the protected /api/auth/me endpoint.
#   7. Logs out and destroys the authenticated session.
#   8. Confirms the old session can no longer access /api/auth/me.
#   9. Stops the backend only if this script started it.
#
# BASE_URL may be overridden, for example:
#
#   BASE_URL=http://127.0.0.1:4000 npm run demo:auth
#
# Automatic backend startup is intentionally limited to local HTTP addresses.
# A remote BASE_URL may still be tested if its backend is already running.

set -eu

# Use the normal development URL unless another URL is supplied by the caller.
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
HEALTH_URL="${BASE_URL}/health"

#
# Parse the URL using Node's standards-compliant URL implementation.
#
# Using Node here avoids fragile shell parsing for:
#   - explicit ports,
#   - omitted ports,
#   - IPv4,
#   - IPv6,
#   - localhost.
#
# Node is already a required dependency for this backend.
#
BASE_SCHEME="$(
  node -e '
    const url = new URL(process.argv[1]);
    process.stdout.write(url.protocol.replace(":", ""));
  ' "$BASE_URL"
)"

BASE_HOST="$(
  node -e '
    const url = new URL(process.argv[1]);
    process.stdout.write(url.hostname);
  ' "$BASE_URL"
)"

BASE_PORT="$(
  node -e '
    const url = new URL(process.argv[1]);

    if (url.port) {
      process.stdout.write(url.port);
    } else if (url.protocol === "https:") {
      process.stdout.write("443");
    } else {
      process.stdout.write("80");
    }
  ' "$BASE_URL"
)"

# Generate unique credentials for every run so repeated demonstrations do not
# violate the username/email uniqueness constraints.
DEMO_SUFFIX="$(date +%s)"
DEMO_USERNAME="${DEMO_USERNAME:-demo_${DEMO_SUFFIX}}"
DEMO_EMAIL="${DEMO_EMAIL:-demo_${DEMO_SUFFIX}@example.com}"
DEMO_PASSWORD="${DEMO_PASSWORD:-ExamplePassword123!}"

# Temporary files used for session-cookie persistence and temporary server
# output. Both files are removed by cleanup().
COOKIE_JAR="$(mktemp)"
SERVER_LOG="$(mktemp)"

# Track ownership of the temporary backend process. If the developer already
# had a healthy backend running, this script must not terminate that process.
STARTED_SERVER=0
SERVER_PID=""

# Allow the temporary backend up to 30 seconds to become healthy.
MAX_STARTUP_ATTEMPTS=30
STARTUP_DELAY_SECONDS=1

#
# cleanup
#
# Remove temporary files and terminate only the backend process started by
# this script.
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
# assert_status EXPECTED ACTUAL REQUEST_NAME
#
# Verify that an API request returned exactly the HTTP status expected by the
# demo. curl normally exits successfully for HTTP 4xx/5xx responses, so the
# status must be checked explicitly rather than relying only on `set -e`.
#
assert_status() {
  expected_status="$1"
  actual_status="$2"
  request_name="$3"

  if [ "$actual_status" != "$expected_status" ]; then
    echo \
      "${request_name} failed: expected HTTP ${expected_status}, got ${actual_status}" \
      >&2

    exit 1
  fi

  echo "${request_name}: PASS (HTTP ${actual_status})"
}

#
# server_is_ready
#
# Return success only when GET /health responds with an HTTP 2xx status.
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
# base_url_is_local
#
# Automatic startup can only launch a backend on the local machine/container.
# Remote URLs may still be used when the remote backend is already healthy.
#
base_url_is_local() {
  case "$BASE_HOST" in
    localhost|127.0.0.1|::1)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

#
# port_is_in_use
#
# Return success when a local process is listening on the port derived from
# BASE_URL.
#
# Matching the parsed BASE_PORT instead of hard-coding 3000 keeps behavior
# consistent when callers use values such as:
#
#   BASE_URL=http://127.0.0.1:4000
#
port_is_in_use() {
  ss -ltnH 2>/dev/null |
    awk -v port="$BASE_PORT" '
      $4 ~ ":" port "$" {
        found = 1
      }

      END {
        exit found ? 0 : 1
      }
    '
}

#
# start_backend_if_needed
#
# Reuse an already-healthy backend whenever possible. If no backend is healthy,
# start a temporary local Node process on the port specified by BASE_URL.
#
start_backend_if_needed() {
  if server_is_ready; then
    echo "Backend already running at $BASE_URL"
    return
  fi

  # Starting a local process would make no sense for a remote BASE_URL.
  if ! base_url_is_local; then
    echo \
      "Backend at $BASE_URL is not responding, and automatic startup is available only for local URLs." \
      >&2

    exit 1
  fi

  # src/server.js currently provides a normal HTTP server rather than HTTPS.
  if [ "$BASE_SCHEME" != "http" ]; then
    echo \
      "Automatic backend startup supports local HTTP URLs only." \
      >&2

    exit 1
  fi

  # A process may own the requested port without being the expected backend.
  # Attempting to start another server would result in EADDRINUSE.
  if port_is_in_use; then
    echo
    echo "Port $BASE_PORT is already in use, but $HEALTH_URL is not responding."
    echo "Stop the process using port $BASE_PORT and run the demo again."
    echo
    echo "Inspect the port with:"
    echo "  ss -ltnp | grep ':$BASE_PORT'"

    exit 1
  fi

  echo "No backend detected at $BASE_URL"
  echo "Starting temporary backend server..."

  #
  # Override PORT for this child process so automatic startup uses the same
  # port specified by BASE_URL.
  #
  # Example:
  #
  #   BASE_URL=http://127.0.0.1:4000
  #
  # starts src/server.js with PORT=4000 rather than whatever PORT is normally
  # configured in .env.
  #
  PORT="$BASE_PORT" node src/server.js >"$SERVER_LOG" 2>&1 &

  SERVER_PID=$!
  STARTED_SERVER=1

  attempt=1

  while [ "$attempt" -le "$MAX_STARTUP_ATTEMPTS" ]; do
    if server_is_ready; then
      echo "Backend is ready."
      return
    fi

    # Detect a Node process that failed during startup instead of waiting for
    # the full health-check timeout.
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

register_status="$(
  curl -sS \
    -X POST \
    "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"$DEMO_USERNAME\",
      \"email\": \"$DEMO_EMAIL\",
      \"password\": \"$DEMO_PASSWORD\"
    }" \
    -o /dev/null \
    -w '%{http_code}'
)"

assert_status \
  "201" \
  "$register_status" \
  "Registration"

echo
echo "=== 2. Login and save session cookie ==="

login_status="$(
  curl -sS \
    -c "$COOKIE_JAR" \
    -X POST \
    "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$DEMO_EMAIL\",
      \"password\": \"$DEMO_PASSWORD\"
    }" \
    -o /dev/null \
    -w '%{http_code}'
)"

assert_status \
  "200" \
  "$login_status" \
  "Login"

echo
echo "=== 3. Access protected profile ==="

profile_status="$(
  curl -sS \
    -b "$COOKIE_JAR" \
    "$BASE_URL/api/auth/me" \
    -o /dev/null \
    -w '%{http_code}'
)"

assert_status \
  "200" \
  "$profile_status" \
  "Protected profile request"

echo
echo "=== 4. Logout ==="

logout_status="$(
  curl -sS \
    -b "$COOKIE_JAR" \
    -c "$COOKIE_JAR" \
    -X POST \
    "$BASE_URL/api/auth/logout" \
    -o /dev/null \
    -w '%{http_code}'
)"

# Logout intentionally returns 204 No Content.
assert_status \
  "204" \
  "$logout_status" \
  "Logout"

echo
echo "=== 5. Confirm protected endpoint is rejected after logout ==="

post_logout_status="$(
  curl -sS \
    -b "$COOKIE_JAR" \
    "$BASE_URL/api/auth/me" \
    -o /dev/null \
    -w '%{http_code}'
)"

# This request is expected to fail authentication. The 401 response proves
# that logout invalidated the previous server-side session.
assert_status \
  "401" \
  "$post_logout_status" \
  "Post-logout protected request"

echo
echo "=== Authentication demo complete ==="