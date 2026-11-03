#!/bin/sh

# =============================================================================
# Bet Project - Environment Configuration Preflight
#
# SCRUM-750 / C-CICD-05
#
# Validates required configuration before CI or staging operations.
#
# Usage:
#   ./scripts/ci-env-check.sh ci
#   ./scripts/ci-env-check.sh staging
#
# This script never prints configuration values or secrets.
# =============================================================================

set -eu

# Report a configuration error without displaying its value.
fail() {
	printf 'ERROR: %s\n' "$1" >&2
	exit 1
}

# Check that an environment variable is populated.
require_value() {
	variable_name="$1"
	variable_value="$2"

	if [ -z "$variable_value" ]; then
		fail "$variable_name must be configured."
	fi
}

# Validate PORT using the same supported TCP range as the backend.
validate_port() {
	case "$PORT" in
	'' | *[!0-9]*)
		fail "PORT must be an integer from 1 to 65535."
		;;
	esac

	if ! printf '%s\n' "$PORT" |
		awk '
            /^[0-9]+$/ {
                if ($0 + 0 >= 1 && $0 + 0 <= 65535) {
                    valid = 1
                }
            }
            END {
                exit(valid ? 0 : 1)
            }
        '; then
		fail "PORT must be an integer from 1 to 65535."
	fi
}

# Validate SESSION_SECRET without displaying its contents.
validate_session_secret() {
	require_value "SESSION_SECRET" "${SESSION_SECRET:-}"

	if [ "${#SESSION_SECRET}" -lt 32 ]; then
		fail "SESSION_SECRET must contain at least 32 characters."
	fi
}

# Require an explicitly configured SQLite database location.
validate_database_path() {
	require_value "DB_PATH" "${DB_PATH:-}"

	if [ "$DB_PATH" = ":memory:" ]; then
		fail "DB_PATH must identify a persistent database for this environment."
	fi
}

# Require the expected application runtime mode.
validate_node_environment() {
	expected_environment="$1"

	require_value "NODE_ENV" "${NODE_ENV:-}"

	if [ "$NODE_ENV" != "$expected_environment" ]; then
		fail "NODE_ENV must be $expected_environment for this environment."
	fi
}

# Select the environment being validated.
environment="${1:-}"

case "$environment" in
ci)
	echo "[Environment] Validating CI configuration..."

	validate_node_environment "test"
	validate_database_path
	validate_session_secret

	if [ "$DB_PATH" != "./data/ci-test.db" ]; then
		fail "CI must use the isolated ./data/ci-test.db database."
	fi

	if [ -n "${PORT:-}" ]; then
		validate_port
	fi
	;;

staging)
	echo "[Environment] Validating staging configuration..."

	require_value "DEPLOY_ENV" "${DEPLOY_ENV:-}"

	if [ "$DEPLOY_ENV" != "staging" ]; then
		fail "DEPLOY_ENV must be staging."
	fi

	validate_node_environment "production"
	validate_database_path
	validate_session_secret
	require_value "PORT" "${PORT:-}"

	validate_port

	case "$DB_PATH" in
	"./data/bet.db" | "./data/ci-test.db")
		fail "Staging must use an explicitly separated database path."
		;;
	esac
	;;

*)
	fail "Usage: ./scripts/ci-env-check.sh ci|staging"
	;;
esac

echo "[Environment] Configuration preflight passed."
