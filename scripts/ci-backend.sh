#!/bin/sh

# =============================================================================
# Bet Project - Backend Local CI
#
# Purpose:
#   Validate the backend from a clean dependency installation and provide a
#   stable location for future backend/API/database automated checks.
#
# Current Sprint 2 checks:
#   1. Confirm the backend project exists.
#   2. Install dependencies with `npm ci`.
#   3. Run backend tests when a test script is present.
#
# Extension point for other team members:
#   Backend authentication tests, API integration tests, SQLite initialization
#   tests, seed/reset tests, and future coverage commands should be added here.
#
# Usage:
#   ./scripts/ci-backend.sh
# =============================================================================

set -e


# -----------------------------------------------------------------------------
# Resolve the repository root relative to this script.
#
# This lets the script work regardless of the directory from which the
# developer launches it.
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$REPO_ROOT/backend"


echo "============================================================"
echo "Backend CI"
echo "============================================================"


# -----------------------------------------------------------------------------
# Fail with a clear message if the expected backend project is missing.
#
# This is easier to diagnose than allowing `cd` or npm to fail later with a
# less specific error.
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
    echo "CI expects a committed npm lockfile so installs are reproducible."
    exit 1
fi


cd "$BACKEND_DIR"


# -----------------------------------------------------------------------------
# Install the exact dependency versions recorded in package-lock.json.
#
# `npm ci` is preferred for CI because it starts from a clean node_modules
# state and fails if package.json and package-lock.json disagree.
# -----------------------------------------------------------------------------
echo
echo "[Backend] Installing dependencies..."
npm ci


# -----------------------------------------------------------------------------
# Run backend tests when available.
#
# `--if-present` is temporary scaffolding for the initial CI foundation. It
# allows this shared script to be merged before the backend test owner finishes
# the automated test suite.
#
# IMPORTANT:
#   Once backend tests are merged during Sprint 2, replace this command with:
#
#       npm test
#
#   That change makes a missing test script a CI failure instead of silently
#   skipping backend tests.
# -----------------------------------------------------------------------------
echo
echo "[Backend] Running tests if configured..."
npm test --if-present


echo
echo "[Backend] Checks passed."
