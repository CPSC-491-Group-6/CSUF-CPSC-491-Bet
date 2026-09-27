#!/bin/sh

# =============================================================================
# Bet Project - Build Information Generator
#
# Purpose:
#   Create a BUILD_INFO.txt file that identifies the source revision and build
#   execution that produced a frontend artifact.
#
# CI behavior:
#   When GitHub Actions environment variables are available, the version is:
#
#       ci-<run-number>.<attempt>-<short-sha>
#
#   Example:
#
#       ci-42.1-a12bc34
#
# Local behavior:
#   When the script is run outside GitHub Actions, it generates:
#
#       local-<UTC timestamp>-<short-sha>
#
#   Example:
#
#       local-20260921T231500Z-a12bc34
#
# Usage:
#   ./scripts/generate-build-info.sh frontend/dist
#
# The destination directory is optional. If omitted, frontend/dist is used.
# =============================================================================

set -e


# -----------------------------------------------------------------------------
# Resolve repository paths.
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Use the first argument as the artifact directory when provided.
# Otherwise default to the Vite production output directory.
OUTPUT_DIR="${1:-$REPO_ROOT/frontend/dist}"


# -----------------------------------------------------------------------------
# Convert a relative output directory into a repository-relative absolute path.
#
# This allows both of the following to work:
#
#   ./scripts/generate-build-info.sh frontend/dist
#   ./scripts/generate-build-info.sh /absolute/path/to/dist
# -----------------------------------------------------------------------------
case "$OUTPUT_DIR" in
    /*)
        ;;
    *)
        OUTPUT_DIR="$REPO_ROOT/$OUTPUT_DIR"
        ;;
esac


# -----------------------------------------------------------------------------
# Confirm that the build output exists before writing metadata.
#
# Build information should only be attached to an artifact that was actually
# generated. This prevents a missing/failed frontend build from being mistaken
# for a successfully versioned artifact.
# -----------------------------------------------------------------------------
if [ ! -d "$OUTPUT_DIR" ]; then
    echo "ERROR: Build output directory does not exist: $OUTPUT_DIR"
    echo "Run the frontend production build before generating build metadata."
    exit 1
fi


# -----------------------------------------------------------------------------
# Determine the Git commit.
#
# In GitHub Actions, GITHUB_SHA identifies the exact commit checked out for the
# workflow. Locally, use the current repository HEAD instead.
# -----------------------------------------------------------------------------
if [ -n "${GITHUB_SHA:-}" ]; then
    FULL_SHA="$GITHUB_SHA"
else
    FULL_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || true)"
fi


if [ -z "$FULL_SHA" ]; then
    echo "ERROR: Unable to determine the Git commit SHA."
    echo "Run this script from a Git checkout or provide GITHUB_SHA."
    exit 1
fi


SHORT_SHA="$(printf '%s' "$FULL_SHA" | cut -c1-7)"


# -----------------------------------------------------------------------------
# Select a build version format.
#
# GitHub Actions builds use the workflow run and attempt numbers so reruns are
# still distinguishable.
#
# Local builds use a UTC timestamp because GitHub workflow numbers do not exist
# outside GitHub Actions.
# -----------------------------------------------------------------------------
if [ -n "${GITHUB_RUN_NUMBER:-}" ] && [ -n "${GITHUB_RUN_ATTEMPT:-}" ]; then
    BUILD_SOURCE="github-actions"
    BUILD_VERSION="ci-${GITHUB_RUN_NUMBER}.${GITHUB_RUN_ATTEMPT}-${SHORT_SHA}"
else
    BUILD_SOURCE="local"
    UTC_TIMESTAMP="$(date -u '+%Y%m%dT%H%M%SZ')"
    BUILD_VERSION="local-${UTC_TIMESTAMP}-${SHORT_SHA}"
fi


BUILD_INFO_FILE="$OUTPUT_DIR/BUILD_INFO.txt"


# -----------------------------------------------------------------------------
# Write the common metadata shared by local and GitHub Actions builds.
# -----------------------------------------------------------------------------
{
    echo "Build Version: $BUILD_VERSION"
    echo "Commit SHA: $FULL_SHA"
    echo "Build Source: $BUILD_SOURCE"

    # GitHub-specific values are only written when they exist. This keeps the
    # local BUILD_INFO.txt readable while preserving workflow traceability in
    # CI artifacts.
    if [ -n "${GITHUB_RUN_NUMBER:-}" ]; then
        echo "Workflow Run: $GITHUB_RUN_NUMBER"
    fi

    if [ -n "${GITHUB_RUN_ATTEMPT:-}" ]; then
        echo "Workflow Attempt: $GITHUB_RUN_ATTEMPT"
    fi
} > "$BUILD_INFO_FILE"


echo "Generated build metadata:"
echo "  Version: $BUILD_VERSION"
echo "  File:    $BUILD_INFO_FILE"
