#!/bin/sh

# =============================================================================
# Bet Project - Backend Local CI
#
# Purpose:
#   Validate the backend using the same checks expected during automated CI.
#   Keeping backend validation in this script gives local development and
#   GitHub Actions one shared source of truth for backend checks.
#
# Current checks:
#   1. Confirm the backend project and required files exist.
#   2. Confirm active code no longer depends on retired database paths.
#   3. Confirm generated SQLite database files are not tracked by Git.
#   4. Install backend dependencies with `npm ci`.
#   5. Initialize a clean CI SQLite database from migrations.
#   6. Seed the database with application-compatible development fixtures.
#   7. Seed a second time to confirm the operation is repeatable.
#   8. Reset and recreate the database from migrations.
#   9. Seed the recreated database to verify reset compatibility.
#  10. Run backend automated tests.
#
# Usage:
#   ./scripts/ci-backend.sh
#
# Exit behavior:
#   `set -eu` stops execution when a command fails or when an undefined shell
#   variable is used. Any failed validation therefore causes CI to fail.
# =============================================================================

set -eu


# -----------------------------------------------------------------------------
# Resolve repository paths relative to this script.
#
# This allows the script to work regardless of the directory from which a
# developer launches it.
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$REPO_ROOT/backend"


echo "============================================================"
echo "Backend CI"
echo "============================================================"


# -----------------------------------------------------------------------------
# Validate the expected backend project structure before attempting npm or
# database operations.
#
# Clear checks here make missing project files easier to diagnose than later
# failures from `cd`, Node, npm, or SQLite.
# -----------------------------------------------------------------------------
if [ ! -d "$BACKEND_DIR" ]; then
    echo "ERROR: Backend directory not found: $BACKEND_DIR"
    exit 1
fi

if [ ! -f "$BACKEND_DIR/package.json" ]; then
    echo "ERROR: backend/package.json was not found."
    exit 1
fi

if [ ! -f "$BACKEND_DIR/package-lock.json" ]; then
    echo "ERROR: backend/package-lock.json was not found."
    echo "CI requires a committed npm lockfile for reproducible installs."
    exit 1
fi

if [ ! -d "$BACKEND_DIR/scripts" ]; then
    echo "ERROR: backend/scripts directory was not found."
    exit 1
fi


# -----------------------------------------------------------------------------
# Verify that the consolidated database implementation exists.
#
# backend/src/data is now the authoritative location for database connection,
# migration, initialization, and seed source files.
# -----------------------------------------------------------------------------
if [ ! -f "$BACKEND_DIR/src/data/database.js" ]; then
    echo "ERROR: backend/src/data/database.js was not found."
    exit 1
fi

if [ ! -f "$BACKEND_DIR/src/data/init.js" ]; then
    echo "ERROR: backend/src/data/init.js was not found."
    exit 1
fi

if [ ! -d "$BACKEND_DIR/src/data/migrations" ]; then
    echo "ERROR: backend/src/data/migrations was not found."
    exit 1
fi

if [ ! -f "$BACKEND_DIR/src/data/seed.sql" ]; then
    echo "ERROR: backend/src/data/seed.sql was not found."
    exit 1
fi


# -----------------------------------------------------------------------------
# Check active backend code for references to a retired database path.
#
# Comments are intentionally ignored so historical documentation such as:
#
#     // src/db was replaced by src/data.
#     # Database/db.py was replaced by the Node implementation.
#
# does not cause CI to fail.
#
# Executable/configuration references such as:
#
#     import db from "../db/database.js";
#     execFileSync(process.execPath, ["src/db/init.js"]);
#     "db:init": "node src/db/init.js"
#
# will still be reported.
#
# Arguments:
#   $1 - Retired path text to search for.
#   $2 - Human-readable architecture name used in output.
# -----------------------------------------------------------------------------
check_retired_reference() {
    PATTERN="$1"
    DESCRIPTION="$2"

    echo
    echo "[Backend] Checking active code for retired $DESCRIPTION references..."

    # Store discovered references in a temporary file.
    #
    # Using a file instead of setting a variable inside a piped while loop
    # keeps this function portable across POSIX shells, where the loop may run
    # inside a subshell.
    RESULTS_FILE="$(mktemp)"

    # Search backend source files, backend maintenance scripts, and package.json.
    #
    # package.json must be included because npm scripts can contain executable
    # references such as:
    #
    #     "db:init": "node src/db/init.js"
    {
        find \
            "$BACKEND_DIR/src" \
            "$BACKEND_DIR/scripts" \
            -type f \
            \( \
                -name "*.js" \
                -o -name "*.mjs" \
                -o -name "*.cjs" \
                -o -name "*.json" \
                -o -name "*.sh" \
            \) \
            -print

        printf '%s\n' "$BACKEND_DIR/package.json"
    } |
    while IFS= read -r FILE_PATH
    do
        # Skip a path if it somehow disappears between discovery and analysis.
        if [ ! -f "$FILE_PATH" ]; then
            continue
        fi

        # Use only POSIX-compatible AWK syntax so this works with the default
        # AWK implementation provided by Ubuntu/GitHub Actions.
        awk -v pattern="$PATTERN" '
            BEGIN {
                in_block_comment = 0
            }

            {
                original_line = $0
                line = $0

                # -------------------------------------------------------------
                # Remove JavaScript block comments.
                #
                # This handles both:
                #
                #     /* entire comment */
                #
                # and:
                #
                #     activeCode /* comment */ moreActiveCode
                #
                # as well as comments spanning multiple lines.
                # -------------------------------------------------------------
                while (1) {
                    if (in_block_comment == 1) {
                        block_end = index(line, "*/")

                        if (block_end == 0) {
                            line = ""
                            break
                        }

                        line = substr(line, block_end + 2)
                        in_block_comment = 0
                        continue
                    }

                    block_start = index(line, "/*")

                    if (block_start == 0) {
                        break
                    }

                    before_comment = substr(line, 1, block_start - 1)
                    remainder = substr(line, block_start + 2)
                    block_end = index(remainder, "*/")

                    if (block_end > 0) {
                        after_comment = substr(remainder, block_end + 2)
                        line = before_comment after_comment
                        continue
                    }

                    line = before_comment
                    in_block_comment = 1
                    break
                }

                # Locate the retired path after block comments have been
                # removed. If the pattern is absent, this line cannot fail CI.
                pattern_position = index(line, pattern)

                if (pattern_position == 0) {
                    next
                }

                # -------------------------------------------------------------
                # Ignore JavaScript // comments when the retired path occurs
                # only inside the comment.
                #
                # Allowed:
                #
                #     doSomething(); // old path was src/db/init.js
                #
                # Still detected:
                #
                #     const path = "src/db/init.js"; // old path
                # -------------------------------------------------------------
                js_comment_position = index(line, "//")

                if (js_comment_position > 0 && js_comment_position < pattern_position) {
                    next
                }

                # -------------------------------------------------------------
                # Ignore shell # comments when the retired path occurs only
                # inside the comment.
                #
                # Allowed:
                #
                #     echo "Checking database" # old path: src/db
                #
                # Still detected:
                #
                #     OLD_PATH="src/db" # retired
                # -------------------------------------------------------------
                shell_comment_position = index(line, "#")

                if (shell_comment_position > 0 && shell_comment_position < pattern_position) {
                    next
                }

                # The retired path remains in active code/configuration.
                printf "%s:%d:%s\n", FILENAME, FNR, original_line
            }
        ' "$FILE_PATH" >> "$RESULTS_FILE"
    done

    # A non-empty results file means active source/configuration still depends
    # on the retired database architecture.
    if [ -s "$RESULTS_FILE" ]; then
        echo "ERROR: Found active references to the retired $DESCRIPTION architecture:"
        echo

        cat "$RESULTS_FILE"

        rm -f "$RESULTS_FILE"

        return 1
    fi

    rm -f "$RESULTS_FILE"

    echo "[Backend] No active retired $DESCRIPTION references found."
}


# -----------------------------------------------------------------------------
# Ensure active code no longer relies on the old database locations.
#
# Comments documenting either migration are intentionally permitted.
# -----------------------------------------------------------------------------
check_retired_reference \
    "src/db" \
    "src/db"

check_retired_reference \
    "Database/" \
    "root Database/"


# -----------------------------------------------------------------------------
# Ensure generated SQLite runtime files have not been committed.
#
# The schema, migrations, and seed definitions belong in Git. The actual
# SQLite database and its WAL/journal companion files are runtime artifacts
# and should remain ignored.
# -----------------------------------------------------------------------------
echo
echo "[Backend] Checking for tracked SQLite runtime files..."

if git -C "$REPO_ROOT" ls-files \
    | grep -E '(^|/).*\.db(-wal|-shm|-journal)?$' \
    >/dev/null 2>&1
then
    echo "ERROR: Generated SQLite database files are tracked by Git."
    echo

    git -C "$REPO_ROOT" ls-files \
        | grep -E '(^|/).*\.db(-wal|-shm|-journal)?$' \
        || true

    exit 1
fi

echo "[Backend] No SQLite runtime files are tracked."


# -----------------------------------------------------------------------------
# Enter the backend project before running npm/database commands.
# -----------------------------------------------------------------------------
cd "$BACKEND_DIR"


# -----------------------------------------------------------------------------
# Configure an isolated environment specifically for CI validation.
#
# Explicitly overriding DB_PATH prevents this script from modifying the normal
# local development database at backend/data/bet.db.
# -----------------------------------------------------------------------------
export NODE_ENV="test"
export DB_PATH="./data/ci-test.db"

# env.js requires a session signing secret. This deterministic value exists
# only for local/automated CI validation and does not protect production data.
export SESSION_SECRET="ci-only-session-secret-at-least-32-characters"


# -----------------------------------------------------------------------------
# Remove any CI database left behind by an earlier local execution.
#
# Starting from no SQLite file at all ensures migration validation cannot pass
# simply because a previous run already created the expected schema.
# -----------------------------------------------------------------------------
echo
echo "[Backend] Preparing clean CI database..."

rm -f \
    "./data/ci-test.db" \
    "./data/ci-test.db-wal" \
    "./data/ci-test.db-shm" \
    "./data/ci-test.db-journal"


# -----------------------------------------------------------------------------
# Install the exact dependency versions recorded in package-lock.json.
#
# `npm ci` is preferred for CI because it creates a reproducible dependency
# installation and fails when package.json and package-lock.json disagree.
# -----------------------------------------------------------------------------
echo
echo "[Backend] Installing dependencies..."
npm ci


# -----------------------------------------------------------------------------
# Initialize the database entirely from version-controlled migrations.
#
# This validates:
#   - database configuration,
#   - database.js,
#   - src/data/init.js,
#   - migration discovery,
#   - migration SQL,
#   - SQLite schema creation.
# -----------------------------------------------------------------------------
echo
echo "[Backend] Initializing database..."
npm run db:init


# -----------------------------------------------------------------------------
# Seed the database.
#
# The seed workflow exercises multiple backend layers together, including:
#   - passwordService.js,
#   - createUserRepository.js,
#   - the users schema,
#   - src/data/seed.sql,
#   - bets and bet_participants foreign keys.
# -----------------------------------------------------------------------------
echo
echo "[Backend] Seeding database..."
npm run db:seed


# -----------------------------------------------------------------------------
# Seed the same database a second time.
#
# Development fixtures are intended to be repeatable. The second invocation
# proves existing demo users, bets, and participant records do not produce
# unexpected UNIQUE or primary-key failures.
# -----------------------------------------------------------------------------
echo
echo "[Backend] Verifying repeatable database seeding..."
npm run db:seed


# -----------------------------------------------------------------------------
# Reset the database from scratch.
#
# resetDatabase.js should:
#   - reject production execution,
#   - remove the SQLite database and companion files,
#   - recreate the schema using src/data/init.js.
#
# This check occurs before any backend server is started because the reset
# utility intentionally refuses destructive operations while the configured
# backend port is in use.
# -----------------------------------------------------------------------------
echo
echo "[Backend] Verifying database reset..."
npm run db:reset


# -----------------------------------------------------------------------------
# Seed once more after reset.
#
# This proves the reset operation recreated the complete schema expected by
# authentication repositories and bet-related seed data.
# -----------------------------------------------------------------------------
echo
echo "[Backend] Verifying seed after reset..."
npm run db:seed


# -----------------------------------------------------------------------------
# Run the existing backend team's automated test command.
#
# backend/package.json defines npm test using Node's test runner.
# Missing or failing tests now cause this script to exit nonzero.
# Database migration, seed, and reset checks remain unchanged.
# -----------------------------------------------------------------------------
echo
echo "[Backend] Running tests..."
npm test


# -----------------------------------------------------------------------------
# Remove CI-specific SQLite artifacts after successful validation.
#
# GitHub-hosted runners are disposable, but cleaning here also keeps developer
# workspaces tidy after running ./scripts/ci-backend.sh locally.
# -----------------------------------------------------------------------------
echo
echo "[Backend] Cleaning CI database..."

rm -f \
    "./data/ci-test.db" \
    "./data/ci-test.db-wal" \
    "./data/ci-test.db-shm" \
    "./data/ci-test.db-journal"


echo
echo "[Backend] Checks passed."