#!/usr/bin/env bash

# Bet Project - Advisory Naming Conventions Check
#
# Checks the current local filenames against the established file case
# conventions without renaming files. Violations fail this script, but the
# GitHub Actions check remains optional and does not block merging.
# JavaScript identifier/function naming is intentionally excluded until
# the team agrees on a parser-backed, ownership-aware approach.

set -euo pipefail

# Resolve the repository root from the script path, not the caller's cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Treat a missing Git checkout as an error rather than a successful audit.
if ! git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	echo "[Naming audit] ERROR: Expected to run inside a Git checkout." >&2
	exit 2
fi

checked=0
warnings=0

# Report violations locally and as GitHub Actions annotations when applicable.
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
		escaped="${escaped//':'/'%3A'}"
		escaped="${escaped//','/'%2C'}"
		printf '::warning file=%s,title=Naming conventions::%s\n' "$escaped" "$message"
	fi
}

# Rebuild the candidate list on every run from:
#   --cached: Git-tracked filenames, including staged renames.
#   --others --exclude-standard: new, non-ignored local filenames, including
#                               destinations of unstaged `mv` renames.
# Skip candidates missing from the working tree: they are deleted or were
# renamed locally and their old paths must not be checked.
# NUL separators preserve spaces and other special characters in paths.
while IFS= read -r -d '' path; do
	[[ -f "$REPO_ROOT/$path" ]] || continue

	# Frontend naming conventions remain under frontend ownership.
	case "$path" in
	frontend/* | */node_modules/* | */dist/*) continue ;;
	esac

	filename="${path##*/}"

	case "$filename" in
	*.js | *.mjs | *.cjs)
		# Audit backend and shared-script JS files only.
		case "$path" in
		backend/* | scripts/*) ;;
		*) continue ;;
		esac

		case "$filename" in
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

		# PascalCase is allowed only for a matching named class declaration.
		if [[ "$stem" =~ ^[A-Z][a-zA-Z0-9]*$ ]] &&
			grep -Eq "^[[:space:]]*(export[[:space:]]+(default[[:space:]]+)?)?class[[:space:]]+${stem}([[:space:]{]|$)" "$REPO_ROOT/$path"; then
			continue
		fi

		report_warning "$path" 'JavaScript filename should use camelCase, except PascalCase files declaring a same-named class.'
		;;

	*.md)
		# Retain established conventional documentation/tool exceptions.
		case "$filename" in
		README.md | CHANGELOG.md | CONTRIBUTING.md | CODE_OF_CONDUCT.md | SECURITY.md | LICENSE.md) continue ;;
		esac

		stem="${filename%.md}"
		checked=$((checked + 1))

		[[ "$stem" =~ ^[a-z][a-z0-9]*(_[a-z0-9]+)*$ ]] ||
			report_warning "$path" 'Markdown filename should have a snake_case stem.'
		;;

	*.sh)
		# Audit backend and shared scripts, not frontend-owned scripts.
		case "$path" in
		backend/* | scripts/*) ;;
		*) continue ;;
		esac

		stem="${filename%.sh}"
		checked=$((checked + 1))

		[[ "$stem" =~ ^[a-z][a-z0-9]*(-[a-z0-9]+)*$ ]] ||
			report_warning "$path" 'Shell script filename should have a kebab-case stem.'
		;;
	esac
done < <(git -C "$REPO_ROOT" ls-files -z --cached --others --exclude-standard)

printf '[Naming audit] Examined %d filenames; found %d violation(s).\n' "$checked" "$warnings"

# Publish the summary when GitHub Actions provides a summary file.
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
	{
		printf '### Advisory naming check\n\n'
		printf '%d filenames inspected; %d violation(s).\n\n' "$checked" "$warnings"
		printf 'No project files were changed. Violations fail this optional check, but it must not be required for merging.\n'
	} >>"$GITHUB_STEP_SUMMARY"
fi

# Fail the audit when naming violations are detected.
if ((warnings > 0)); then
	echo "[Naming audit] FAIL: $warnings naming violation(s) need review." >&2
	exit 1
fi

echo "[Naming audit] PASS: all checked filenames follow the allowed conventions."
exit 0
