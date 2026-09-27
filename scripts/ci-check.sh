#!/bin/sh

# =============================================================================
# Bet Project - Complete Local CI Runner
#
# Purpose:
#   Run the project's backend and frontend CI validation using the same
#   component scripts that GitHub Actions can call.
#
# Why this file is intentionally small:
#   Backend-specific logic belongs in ci-backend.sh.
#   Frontend-specific logic belongs in ci-frontend.sh.
#
#   Keeping the top-level runner as an orchestrator makes it easier for other
#   team members to extend their area without repeatedly editing this file and
#   creating unnecessary merge conflicts.
#
# Usage:
#   ./scripts/ci-check.sh
#
# Exit behavior:
#   `set -e` causes this script to stop as soon as a component CI script fails.
#   A non-zero exit status therefore means the local CI run did not pass.
# =============================================================================

set -e


# -----------------------------------------------------------------------------
# Resolve the absolute directory containing this script.
#
# CDPATH is cleared so custom shell CDPATH settings do not change the output of
# `cd`. This makes path resolution more predictable across developer machines.
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"


echo "============================================================"
echo "Bet Project - Local CI"
echo "============================================================"
echo


# -----------------------------------------------------------------------------
# Run backend validation first.
#
# The backend script owns all backend-specific dependency, test, and future
# database/API validation logic.
# -----------------------------------------------------------------------------
"$SCRIPT_DIR/ci-backend.sh"


echo


# -----------------------------------------------------------------------------
# Run frontend validation after the backend succeeds.
#
# The frontend script owns linting, frontend tests, and the production build.
# -----------------------------------------------------------------------------
"$SCRIPT_DIR/ci-frontend.sh"


echo
echo "============================================================"
echo "All local CI checks passed."
echo "============================================================"
