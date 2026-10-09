#!/usr/bin/env bash

# Bet Project - Repository-Wide Formatting
#
# Usage:
#   ./scripts/ci-format-audit.sh check
#   ./scripts/ci-format-audit.sh write
#
# Prettier handles source, configuration, and Markdown files.
# shfmt handles shell scripts.
# CI should only execute the read-only check mode.

set -euo pipefail

# Default to the safe, read-only mode.
mode="${1:-check}"

case "$mode" in
check | write) ;;
-h | --help)
	echo "Usage: ./scripts/ci-format-audit.sh [check|write]"
	exit 0
	;;
*)
	echo "ERROR: Expected check or write." >&2
	exit 2
	;;
esac

if (($# > 1)); then
	echo "ERROR: Too many arguments." >&2
	exit 2
fi

# Never rewrite repository files inside GitHub Actions.
if [[ "$mode" == "write" &&
	("${CI:-}" == "true" || "${GITHUB_ACTIONS:-}" == "true") ]]; then
	echo "ERROR: write mode is disabled in CI." >&2
	exit 2
fi

# Locate the actual repository root regardless of the
# directory from which this script is invoked.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

repo_root="$(git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null)" || {
	echo "ERROR: Git repository not found." >&2
	exit 2
}

cd "$repo_root"

prettier_files=()
shell_files=()

# Include existing tracked files and new nonignored files.
# NUL separators support paths containing spaces.
while IFS= read -r -d '' path; do
	[[ -f "$path" ]] || continue

	# Skip generated files and dependencies.
	case "$path" in
	node_modules/* | */node_modules/* | dist/* | */dist/* | build/* | */build/* | coverage/* | */coverage/* | artifacts/* | */artifacts/* | data/* | */data/*)
		continue
		;;
	# Preserve exact project and GitHub Markdown templates.
	.github/pull_request_template.md | .github/ISSUE_TEMPLATE/*.md | docs/templates/*.md | templates/*.md)
		continue
		;;
	# Lockfiles are maintained by the package manager.
	package-lock.json | */package-lock.json | npm-shrinkwrap.json | */npm-shrinkwrap.json)
		continue
		;;
	esac

	# Delegate each supported extension to one formatter.
	case "$path" in
	*.sh | *.bash)
		shell_files+=("$path")
		;;
	*.js | *.jsx | *.mjs | *.cjs | *.ts | *.tsx | *.json | *.jsonc | *.md | *.mdx | *.css | *.scss | *.less | *.html | *.yaml | *.yml)
		prettier_files+=("$path")
		;;
	esac
done < <(git ls-files --cached --others --exclude-standard -z)

# Reuse an existing Prettier dependency instead of downloading
# or introducing another package installation.
prettier_bin=""

if ((${#prettier_files[@]} > 0)); then
	for candidate in \
		"$repo_root/node_modules/.bin/prettier" \
		"$repo_root/backend/node_modules/.bin/prettier" \
		"$repo_root/frontend/node_modules/.bin/prettier"; do

		if [[ -x "$candidate" ]]; then
			prettier_bin="$candidate"
			break
		fi
	done

	# Also permit an existing system-level Prettier installation.
	if [[ -z "$prettier_bin" ]] &&
		command -v prettier >/dev/null 2>&1; then
		prettier_bin="$(command -v prettier)"
	fi

	if [[ -z "$prettier_bin" ]]; then
		echo "ERROR: Prettier is not installed." >&2
		echo "Install the existing workspace dependencies first." >&2
		exit 2
	fi
fi

# Verify shfmt exists before formatting anything.
# This prevents partially formatted projects in write mode.
if ((${#shell_files[@]} > 0)) &&
	! command -v shfmt >/dev/null 2>&1; then
	echo "ERROR: shfmt is not installed." >&2
	exit 2
fi

# Respect existing Prettier ignore files at both root and
# component levels without changing formatting policies.
prettier_options=()

for ignore_file in \
	.gitignore \
	.prettierignore \
	backend/.prettierignore \
	frontend/.prettierignore; do

	if [[ -f "$ignore_file" ]]; then
		prettier_options+=(--ignore-path "$ignore_file")
	fi
done

echo "[Format] Mode: $mode"
echo "[Format] Prettier files: ${#prettier_files[@]}"
echo "[Format] Shell files: ${#shell_files[@]}"

failed=0

# Run Prettier against all eligible project files.
if ((${#prettier_files[@]} > 0)); then
	echo "[Format] Running Prettier..."

	if [[ "$mode" == "check" ]]; then
		"$prettier_bin" \
			"${prettier_options[@]}" \
			--check "${prettier_files[@]}" || failed=1
	else
		"$prettier_bin" \
			"${prettier_options[@]}" \
			--write "${prettier_files[@]}" || failed=1
	fi
fi

# shfmt checks or formats shell scripts independently.
# It uses EditorConfig when available, otherwise its defaults.
if ((${#shell_files[@]} > 0)); then
	echo "[Format] Running shfmt..."

	if [[ "$mode" == "check" ]]; then
		shfmt -d "${shell_files[@]}" || failed=1
	else
		shfmt -w "${shell_files[@]}" || failed=1
	fi
fi

# Return failure if either formatter detected a problem.
# Running both gives more complete feedback to developers.
if ((failed != 0)); then
	echo "[Format] Formatting problems detected." >&2
	exit 1
fi

echo "[Format] $mode completed successfully."
