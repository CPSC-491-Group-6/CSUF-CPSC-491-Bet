#!/bin/sh

# =============================================================================
# Bet Project - Complete Local CI Runner
#
# Purpose:
#   Run advisory naming/format audits, the existing backend/frontend validation,
#   and build-info generation for the successfully built frontend artifact.
#
# Ownership:
#   Backend checks belong in ci-backend.sh.
#   Frontend checks and the production build belong in ci-frontend.sh.
#   Filename rules belong in naming-audit.sh.
#   Build metadata belongs in generate-build-info.sh.
#
# Usage:
#   ./scripts/ci-check.sh
#
# Exit behavior:
#   Naming and whitespace violations are advisory and do not block this runner.
#   Audit infrastructure errors and failures in backend, frontend, or build-info
#   generation produce a nonzero exit status.
# =============================================================================

set -e

# Resolve paths independently of the directory from which the runner is called.
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Both the naming audit and formatting checks need a valid Git checkout.
if ! git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	echo "[Local CI] ERROR: Expected to run inside a Git checkout." >&2
	exit 2
fi

# Detect a missing audit script rather than claiming naming rules were checked.
if [ ! -f "$SCRIPT_DIR/ci-naming-audit.sh" ]; then
	echo "[Local CI] ERROR: Missing scripts/ci-naming-audit.sh." >&2
	exit 2
fi

advisory_warnings=0

# Run an advisory check without letting an expected violation block the build.
# The maximum expected violation exit code is supplied per audit because
# Git diff --check returns 2 for whitespace errors, while naming-audit returns 1.
# Unexpected higher exit codes remain blocking so tool errors are not hidden.
run_advisory_check() {
	label="$1"
	max_violation_status="$2"
	shift 2

	echo
	echo "[Local CI] Running $label..."
	if "$@"; then
		echo "[Local CI] PASS: $label"
	else
		status=$?
		if [ "$status" -gt "$max_violation_status" ]; then
			echo "[Local CI] ERROR: $label could not complete (exit $status)." >&2
			exit "$status"
		fi
		advisory_warnings=$((advisory_warnings + 1))
		echo "[Local CI] WARNING: $label found violations (advisory only)." >&2
	fi
}

echo "============================================================"
echo "Bet Project - Local CI"
echo "============================================================"

# Run the Bash-based naming audit, which re-scans current local filenames.
run_advisory_check "filename naming audit" 1 bash "$SCRIPT_DIR/ci-naming-audit.sh"

# Check whitespace errors in both unstaged and staged changes. These commands
# do not modify source files or impose new formatter/linter conventions.
run_advisory_check "unstaged whitespace format audit" 2 git -C "$REPO_ROOT" diff --check
run_advisory_check "staged whitespace format audit" 2 git -C "$REPO_ROOT" diff --cached --check

# Delegate component-specific validation to the established scripts. Failures
# remain blocking through `set -e` and must not be downgraded to warnings.
echo
echo "[Local CI] Running backend validation..."
"$SCRIPT_DIR/ci-backend.sh"

echo
echo "[Local CI] Running frontend validation and production build..."
"$SCRIPT_DIR/ci-frontend.sh"

# The frontend runner creates frontend/dist; the existing generator requires
# that directory and writes frontend/dist/BUILD_INFO.txt for this build.
echo
echo "[Local CI] Generating frontend build information..."
sh "$SCRIPT_DIR/generate-build-info.sh" "$REPO_ROOT/frontend/dist"

# Confirm that the expected metadata output was generated.
if [ ! -s "$REPO_ROOT/frontend/dist/BUILD_INFO.txt" ]; then
	echo "[Local CI] ERROR: frontend/dist/BUILD_INFO.txt was not generated." >&2
	exit 1
fi

echo
echo "============================================================"
if [ "$advisory_warnings" -gt 0 ]; then
	echo "Required local CI checks passed with $advisory_warnings advisory warning(s)."
else
	echo "All local CI checks and advisory audits passed."
fi
echo "Frontend build information: frontend/dist/BUILD_INFO.txt"
echo "============================================================"
