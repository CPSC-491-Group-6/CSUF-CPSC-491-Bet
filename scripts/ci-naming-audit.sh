#!/usr/bin/env bash

# Bet Project - Advisory Naming Conventions Check
#
# Checks selected Git-tracked filenames against the established file case
# conventions without renaming files. Violations fail this script, but the
# GitHub Actions check remains optional and does not block merging.
# JavaScript identifier/function naming is intentionally excluded until
# the team agrees on a parser-backed, ownership-aware approach.

set -euo pipefail

# Resolve the repository root from the script path, not the caller's cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# If Git is unavailable, report a real tool error instead of falsely
# treating a skipped audit as successful validation.
if ! git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	echo "[Naming audit] ERROR: Expected to run inside a Git checkout." >&2
	exit 2
fi

checked=0
warnings=0

# Print a readable violation and a GitHub Actions warning annotation.
# A nonzero exit status below makes this a failing, but non-required, check.
# Escape characters that have special meaning inside workflow commands.
report_warning() {
	local file="$1"
	local message="$2"
	local escaped="$file"
	warnings=$((warnings + 1))

	printf '[Naming audit] VIOLATION: %s: %s\n' "$file" "$message"

	if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
		escaped="${escaped//'%'/'%25'}"
		escaped="${escaped//$'\r'/'%0D'}"
		escaped="${escaped//$'\n'/'%0A'}"
		escaped="${escaped//','/'%2C'}"
		printf '::warning file=%s,title=Naming conventions::%s\n' "$escaped" "$message"
	fi
}

# Examine tracked files only, with NUL separators to safely support spaces.
# Frontend is excluded because its naming conventions belong to its owners.
while IFS= read -r -d '' path; do
	case "$path" in
	frontend/* | */node_modules/* | */dist/*) continue ;;
	esac

	filename="${path##*/}"

	case "$filename" in
	*.js | *.mjs | *.cjs)
		# Audit backend and shared-script JS files; leave other areas untouched.
		case "$path" in backend/* | scripts/*) ;; *) continue ;; esac
		case "$filename" in
		# These filename structures are specified by common JS tooling.
		*.test.js | *.spec.js)
			stem="${filename%.js}"
			stem="${stem%.test}"
			stem="${stem%.spec}"
			;;
		*.config.js | *.config.mjs | *.config.cjs) continue ;;
		*) stem="${filename%.*}" ;;
		esac
		checked=$((checked + 1))

		# Ordinary JavaScript modules use camelCase filenames.
		if [[ "$stem" =~ ^[a-z][a-zA-Z0-9]*$ ]]; then
			continue
		fi

		# Class modules may instead use PascalCase, but only when a named
		# class declaration matches the filename (e.g., AppError.js declares
		# class AppError). This lightweight check avoids treating every
		# capitalized utility filename as a valid class exception.
		#
		# It intentionally recognizes common class declarations rather than
		# trying to parse every JavaScript syntax form without dependencies.
		if [[ "$stem" =~ ^[A-Z][a-zA-Z0-9]*$ ]] &&
			grep -Eq "^[[:space:]]*(export[[:space:]]+(default[[:space:]]+)?)?class[[:space:]]+${stem}([[:space:]{]|$)" "$REPO_ROOT/$path"; then
			continue
		fi

		report_warning "$path" 'JavaScript filename should use camelCase, except PascalCase files declaring a same-named class.'
		;;
	*.md)
		# Recognize established conventional docs/tool filename exceptions.
		case "$filename" in
		README.md | CHANGELOG.md | CONTRIBUTING.md | CODE_OF_CONDUCT.md | SECURITY.md | LICENSE.md) continue ;;
		esac
		stem="${filename%.md}"
		checked=$((checked + 1))
		[[ "$stem" =~ ^[a-z][a-z0-9]*(_[a-z0-9]+)*$ ]] ||
			report_warning "$path" 'Markdown filename should have a snake_case stem.'
		;;
	*.sh)
		# Only audit scripts owned by the shared/backend areas initially.
		case "$path" in backend/* | scripts/*) ;; *) continue ;; esac
		stem="${filename%.sh}"
		checked=$((checked + 1))
		[[ "$stem" =~ ^[a-z][a-z0-9]*(-[a-z0-9]+)*$ ]] ||
			report_warning "$path" 'Shell script filename should have a kebab-case stem.'
		;;
	esac
done < <(git -C "$REPO_ROOT" ls-files -z --cached)

printf '[Naming audit] Examined %d filenames; found %d violation(s).\n' "$checked" "$warnings"

# Publish a readable summary in GitHub Actions when the environment supports it.
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
	{
		printf '### Advisory naming check\n\n'
		printf '%d filenames inspected; %d violation(s).\n\n' "$checked" "$warnings"
		printf 'No files were changed. Violations fail this optional check, but it must not be required for merging.\n'
	} >>"$GITHUB_STEP_SUMMARY"
fi

# Return a failure if any tracked filename violates an approved convention.
# The separate GitHub check is intentionally NOT a required merge check.
if ((warnings > 0)); then
	echo "[Naming audit] FAIL: $warnings naming violation(s) need review." >&2
	exit 1
fi

echo "[Naming audit] PASS: all checked filenames follow the allowed conventions."
exit 0
