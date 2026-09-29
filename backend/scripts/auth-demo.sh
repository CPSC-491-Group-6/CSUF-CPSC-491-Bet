#!/bin/sh

# =============================================================================
# backend/scripts/auth-demo.sh
#
# Sprint 2 Authentication Demonstration
#
# Purpose:
#   Exercise the backend authentication workflow through the real HTTP API.
#
# The script:
#   1. Resolves the backend directory regardless of where the script is run.
#   2. Checks whether the target backend is already responding.
#   3. Starts a temporary local backend when necessary.
#   4. Waits for the /health endpoint to become available.
#   5. Registers a unique demonstration account.
#   6. Logs in and stores the returned session cookie.
#   7. Accesses the protected /api/auth/me endpoint.
#   8. Logs out.
#   9. Confirms the previous session can no longer access /api/auth/me.
#  10. Stops the backend only when this script started it.
#
# Usage:
#
#   From the repository root:
#
#       ./backend/scripts/auth-demo.sh
#
#   From backend/:
#
#       ./scripts/auth-demo.sh
#
#   Against another backend URL:
#
#       BASE_URL=http://127.0.0.1:4000 ./backend/scripts/auth-demo.sh
#
# Notes:
#   - The script only starts/stops a backend automatically when BASE_URL points
#     to localhost or 127.0.0.1.
#   - A backend that was already running before this script started is never
#     stopped by this script.
#   - Temporary cookie and log files are removed during cleanup.
# =============================================================================

set -eu


# -----------------------------------------------------------------------------
# Resolve the backend project directory from this script's actual location.
#
# auth-demo.sh lives under:
#
#   backend/scripts/auth-demo.sh
#
# Therefore the parent of SCRIPT_DIR is always the backend project directory.
#
# This avoids depending on the developer's current working directory and fixes
# errors such as Node looking for:
#
#   /workspaces/CSUF-CPSC-491-Bet/src/server.js
#
# instead of:
#
#   /workspaces/CSUF-CPSC-491-Bet/backend/src/server.js
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

cd "$BACKEND_DIR"


# -----------------------------------------------------------------------------
# Runtime configuration.
#
# BASE_URL may be overridden by the caller. The default matches the normal
# local backend development address.
# -----------------------------------------------------------------------------
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"

# Remove a trailing slash so endpoint construction remains predictable.
BASE_URL="${BASE_URL%/}"

HEALTH_URL="$BASE_URL/health"
REGISTER_URL="$BASE_URL/api/auth/register"
LOGIN_URL="$BASE_URL/api/auth/login"
ME_URL="$BASE_URL/api/auth/me"
LOGOUT_URL="$BASE_URL/api/auth/logout"


# -----------------------------------------------------------------------------
# Generate a unique demo identity for each execution.
#
# Including both the current timestamp and shell process ID makes collisions
# unlikely even when the script is executed repeatedly in quick succession.
# -----------------------------------------------------------------------------
DEMO_ID="$(date +%s)_$$"
DEMO_USERNAME="demo_$DEMO_ID"
DEMO_EMAIL="demo_$DEMO_ID@example.com"

# This password exists only for the temporary account created by the demo.
# The backend should hash it through the normal password service before storing
# anything in SQLite.
DEMO_PASSWORD="DemoPassword123!"


# -----------------------------------------------------------------------------
# Temporary files.
#
# COOKIE_JAR:
#   Stores the session cookie returned by the login endpoint.
#
# RESPONSE_BODY:
#   Stores the response body for the current HTTP request so useful error
#   details can be printed without mixing them into the status-code handling.
#
# SERVER_LOG:
#   Captures output from a backend that this script starts itself.
# -----------------------------------------------------------------------------
COOKIE_JAR="$(mktemp)"
RESPONSE_BODY="$(mktemp)"
SERVER_LOG="$(mktemp)"

SERVER_PID=""
STARTED_BACKEND=0


# -----------------------------------------------------------------------------
# Cleanup handler.
#
# The backend is stopped only when this script started it. If a developer
# already had the backend running, that process is intentionally left alone.
#
# Temporary files are always removed.
# -----------------------------------------------------------------------------
cleanup() {
    if [ "$STARTED_BACKEND" -eq 1 ] && [ -n "$SERVER_PID" ]; then
        if kill -0 "$SERVER_PID" 2>/dev/null; then
            echo
            echo "=== Stopping temporary backend server ==="

            kill "$SERVER_PID" 2>/dev/null || true

            # Wait for the child process so it does not remain as a zombie.
            wait "$SERVER_PID" 2>/dev/null || true
        fi
    fi

    rm -f \
        "$COOKIE_JAR" \
        "$RESPONSE_BODY" \
        "$SERVER_LOG"
}

trap cleanup EXIT INT TERM


# -----------------------------------------------------------------------------
# Determine whether BASE_URL points at a local backend that this script may
# safely manage.
#
# Automatic server startup is deliberately limited to localhost addresses.
# The script must never attempt to start or stop processes merely because a
# remote development/staging URL is unavailable.
# -----------------------------------------------------------------------------
is_local_base_url() {
    case "$BASE_URL" in
        http://127.0.0.1:*|http://localhost:*|https://127.0.0.1:*|https://localhost:*)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}


# -----------------------------------------------------------------------------
# Check whether the backend health endpoint is currently responding.
#
# Any successful HTTP response from /health in the 2xx range is considered
# evidence that the backend is ready for the authentication demonstration.
# -----------------------------------------------------------------------------
backend_is_ready() {
    STATUS_CODE="$(
        curl \
            --silent \
            --output /dev/null \
            --write-out '%{http_code}' \
            "$HEALTH_URL" \
            2>/dev/null \
            || true
    )"

    case "$STATUS_CODE" in
        2??)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}


# -----------------------------------------------------------------------------
# Start a temporary backend.
#
# Because the script changed into BACKEND_DIR near the beginning, src/server.js
# resolves correctly regardless of where the developer originally launched
# auth-demo.sh.
# -----------------------------------------------------------------------------
start_backend() {
    if ! is_local_base_url; then
        echo "ERROR: No backend responded at $BASE_URL."
        echo "Automatic startup is only allowed for localhost targets."
        exit 1
    fi

    echo "No backend detected at $BASE_URL"
    echo "Preparing local database..."

    # Apply pending migrations before Express imports configuration that
    # constructs the SQLite-backed authentication session store.
    #
    # The session store prepares statements during backend startup, so tables
    # such as sessions must already exist before src/server.js is executed.
    if ! npm run db:init; then
        echo
        echo "ERROR: Database initialization failed."
        exit 1
    fi

    echo "Starting temporary backend server..."

    node src/server.js >"$SERVER_LOG" 2>&1 &

    SERVER_PID=$!
    STARTED_BACKEND=1
}


# -----------------------------------------------------------------------------
# Wait until the backend becomes healthy.
#
# The loop also checks whether the process exited early. If that occurs, the
# startup log is printed immediately because configuration/import/database
# errors are more useful than a generic readiness timeout.
# -----------------------------------------------------------------------------
wait_for_backend() {
    ATTEMPT=1
    MAX_ATTEMPTS=30

    while [ "$ATTEMPT" -le "$MAX_ATTEMPTS" ]; do
        if backend_is_ready; then
            echo "Backend is ready."
            return 0
        fi

        if [ "$STARTED_BACKEND" -eq 1 ] && ! kill -0 "$SERVER_PID" 2>/dev/null; then
            echo
            echo "Backend exited before becoming ready."
            echo
            echo "=== Backend startup log ==="
            cat "$SERVER_LOG"

            exit 1
        fi

        ATTEMPT=$((ATTEMPT + 1))
        sleep 1
    done

    echo
    echo "ERROR: Backend did not become ready at $HEALTH_URL."

    if [ "$STARTED_BACKEND" -eq 1 ]; then
        echo
        echo "=== Backend startup log ==="
        cat "$SERVER_LOG"
    fi

    exit 1
}


# -----------------------------------------------------------------------------
# Print a useful failure message for an unexpected HTTP response.
#
# Arguments:
#   $1 - Human-readable operation name.
#   $2 - Expected status code.
#   $3 - Actual status code.
# -----------------------------------------------------------------------------
fail_http_request() {
    OPERATION="$1"
    EXPECTED_STATUS="$2"
    ACTUAL_STATUS="$3"

    echo
    echo "ERROR: $OPERATION failed."
    echo "Expected HTTP status: $EXPECTED_STATUS"
    echo "Actual HTTP status:   $ACTUAL_STATUS"
    echo
    echo "Response body:"

    if [ -s "$RESPONSE_BODY" ]; then
        cat "$RESPONSE_BODY"
        echo
    else
        echo "(empty response)"
    fi

    exit 1
}


# -----------------------------------------------------------------------------
# Register a unique demonstration account.
#
# This exercises the real registration endpoint and therefore validates the
# request validation, user repository, uniqueness constraints, and password
# hashing path used by the application.
# -----------------------------------------------------------------------------
register_demo_user() {
    echo
    echo "=== Registering demo user ==="

    STATUS_CODE="$(
        curl \
            --silent \
            --show-error \
            --output "$RESPONSE_BODY" \
            --write-out '%{http_code}' \
            --request POST \
            --header 'Content-Type: application/json' \
            --data "{
                \"username\":\"$DEMO_USERNAME\",
                \"email\":\"$DEMO_EMAIL\",
                \"password\":\"$DEMO_PASSWORD\"
            }" \
            "$REGISTER_URL"
    )"

    case "$STATUS_CODE" in
        200|201)
            ;;
        *)
            fail_http_request \
                "Registration" \
                "200 or 201" \
                "$STATUS_CODE"
            ;;
    esac

    echo "Registration succeeded (HTTP $STATUS_CODE)."

    if [ -s "$RESPONSE_BODY" ]; then
        cat "$RESPONSE_BODY"
        echo
    fi
}


# -----------------------------------------------------------------------------
# Log in as the newly registered user.
#
# curl stores any Set-Cookie response in COOKIE_JAR. Later requests send that
# cookie back to the backend to demonstrate session-based authentication.
# -----------------------------------------------------------------------------
login_demo_user() {
    echo
    echo "=== Logging in ==="

    STATUS_CODE="$(
        curl \
            --silent \
            --show-error \
            --output "$RESPONSE_BODY" \
            --write-out '%{http_code}' \
            --cookie-jar "$COOKIE_JAR" \
            --request POST \
            --header 'Content-Type: application/json' \
            --data "{
                \"email\":\"$DEMO_EMAIL\",
                \"password\":\"$DEMO_PASSWORD\"
            }" \
            "$LOGIN_URL"
    )"

    case "$STATUS_CODE" in
        200)
            ;;
        *)
            fail_http_request \
                "Login" \
                "200" \
                "$STATUS_CODE"
            ;;
    esac

    echo "Login succeeded (HTTP $STATUS_CODE)."

    if [ -s "$RESPONSE_BODY" ]; then
        cat "$RESPONSE_BODY"
        echo
    fi
}


# -----------------------------------------------------------------------------
# Verify authenticated access to /api/auth/me.
#
# This confirms that the login session cookie is accepted by the protected
# authentication middleware.
# -----------------------------------------------------------------------------
verify_authenticated_session() {
    echo
    echo "=== Accessing protected profile ==="

    STATUS_CODE="$(
        curl \
            --silent \
            --show-error \
            --output "$RESPONSE_BODY" \
            --write-out '%{http_code}' \
            --cookie "$COOKIE_JAR" \
            "$ME_URL"
    )"

    if [ "$STATUS_CODE" != "200" ]; then
        fail_http_request \
            "Authenticated profile request" \
            "200" \
            "$STATUS_CODE"
    fi

    echo "Authenticated request succeeded (HTTP $STATUS_CODE)."

    if [ -s "$RESPONSE_BODY" ]; then
        cat "$RESPONSE_BODY"
        echo
    fi
}


# -----------------------------------------------------------------------------
# Log out using the current authenticated session.
#
# The exact logout implementation may clear or invalidate the server-side
# session. The subsequent /me request verifies the security-relevant behavior.
# -----------------------------------------------------------------------------
logout_demo_user() {
    echo
    echo "=== Logging out ==="

    STATUS_CODE="$(
        curl \
            --silent \
            --show-error \
            --output "$RESPONSE_BODY" \
            --write-out '%{http_code}' \
            --cookie "$COOKIE_JAR" \
            --request POST \
            "$LOGOUT_URL"
    )"

    case "$STATUS_CODE" in
        200|204)
            ;;
        *)
            fail_http_request \
                "Logout" \
                "200 or 204" \
                "$STATUS_CODE"
            ;;
    esac

    echo "Logout succeeded (HTTP $STATUS_CODE)."

    if [ -s "$RESPONSE_BODY" ]; then
        cat "$RESPONSE_BODY"
        echo
    fi
}


# -----------------------------------------------------------------------------
# Confirm that the old session can no longer access the protected endpoint.
#
# A correctly invalidated session should receive an authentication failure,
# normally HTTP 401. HTTP 403 is also accepted because either status can be a
# valid policy choice for refusing an unauthenticated/unauthorized request.
# -----------------------------------------------------------------------------
verify_session_invalidated() {
    echo
    echo "=== Verifying session invalidation ==="

    STATUS_CODE="$(
        curl \
            --silent \
            --show-error \
            --output "$RESPONSE_BODY" \
            --write-out '%{http_code}' \
            --cookie "$COOKIE_JAR" \
            "$ME_URL"
    )"

    case "$STATUS_CODE" in
        401|403)
            ;;
        *)
            fail_http_request \
                "Post-logout profile request" \
                "401 or 403" \
                "$STATUS_CODE"
            ;;
    esac

    echo "Old session correctly rejected (HTTP $STATUS_CODE)."

    if [ -s "$RESPONSE_BODY" ]; then
        cat "$RESPONSE_BODY"
        echo
    fi
}


# -----------------------------------------------------------------------------
# Main demonstration workflow.
# -----------------------------------------------------------------------------
echo
echo "=== Sprint 2 Authentication Demo ==="
echo "Server:   $BASE_URL"
echo "Username: $DEMO_USERNAME"
echo "Email:    $DEMO_EMAIL"
echo


# Use an already-running backend when available. Otherwise start a temporary
# local instance and wait for it to become healthy.
if backend_is_ready; then
    echo "Backend already running at $BASE_URL"
else
    start_backend
    wait_for_backend
fi


register_demo_user
login_demo_user
verify_authenticated_session
logout_demo_user
verify_session_invalidated


echo
echo "=============================================="
echo "Authentication demo completed successfully."
echo "=============================================="