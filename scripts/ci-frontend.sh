#!/bin/sh

# =============================================================================
# Bet Project - Frontend Local CI
#
# Purpose:
#   Validate the React/Vite frontend using the same high-level sequence that
#   GitHub Actions should use.
#
# Current Sprint 2 checks:
#   1. Confirm the frontend project exists.
#   2. Install dependencies with `npm ci`.
#   3. Run ESLint.
#   4. Run frontend tests when a test script is present.
#   5. Produce a Vite production build.
#
# Extension point for other team members:
#   Component tests, route tests, UI integration tests, and future coverage
#   checks should be added here.
#
# Usage:
#   ./scripts/ci-frontend.sh
# =============================================================================

set -e


# -----------------------------------------------------------------------------
# Resolve the repository root relative to this script so the command works from
# any directory inside or outside the repository.
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$REPO_ROOT/frontend"


echo "============================================================"
echo "Frontend CI"
echo "============================================================"


# -----------------------------------------------------------------------------
# Verify the expected frontend files before attempting npm commands.
# -----------------------------------------------------------------------------
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "ERROR: Frontend directory not found: $FRONTEND_DIR"
    exit 1
fi

if [ ! -f "$FRONTEND_DIR/package.json" ]; then
    echo "ERROR: frontend/package.json was not found."
    exit 1
fi

if [ ! -f "$FRONTEND_DIR/package-lock.json" ]; then
    echo "ERROR: frontend/package-lock.json was not found."
    echo "CI expects a committed npm lockfile so installs are reproducible."
    exit 1
fi


cd "$FRONTEND_DIR"


# -----------------------------------------------------------------------------
# Install the dependency versions recorded in package-lock.json.
# -----------------------------------------------------------------------------
echo
echo "[Frontend] Installing dependencies..."
npm ci


# -----------------------------------------------------------------------------
# Run the project's existing ESLint command.
#
# Any lint error stops the script because `set -e` is enabled.
# -----------------------------------------------------------------------------
echo
echo "[Frontend] Running lint..."
npm run lint


# -----------------------------------------------------------------------------
# Run frontend tests when available.
#
# `--if-present` keeps the initial shared CI scaffolding usable while the
# frontend test owner builds the first automated test suite.
#
# IMPORTANT:
#   After the frontend test suite is merged, replace this command with:
#
#       npm test
#
#   so frontend tests become mandatory.
# -----------------------------------------------------------------------------
echo
echo "[Frontend] Running tests if configured..."
npm test --if-present


# -----------------------------------------------------------------------------
# Produce the Vite production build.
#
# A successful build should create frontend/dist. This check proves that the
# current frontend source can be compiled into a deployable artifact.
# -----------------------------------------------------------------------------
echo
echo "[Frontend] Building production bundle..."
npm run build


# -----------------------------------------------------------------------------
# Verify that the expected Vite output directory exists.
#
# This catches a misconfigured build script that exits successfully but writes
# output somewhere unexpected.
# -----------------------------------------------------------------------------
if [ ! -d "$FRONTEND_DIR/dist" ]; then
    echo "ERROR: Frontend build completed but frontend/dist was not found."
    exit 1
fi


echo
echo "[Frontend] Checks passed."
