#!/usr/bin/env bash
# Bet Project - Repository-Wide Formatting
# Usage: ci-format-audit.sh [check|write] [repository-relative-file]
# Prettier handles supported source/config/docs; shfmt handles shell scripts.
# Check mode never changes files. Write mode is disabled in CI.

set -euo pipefail

mode="${1:-check}"
case "$mode" in
check | write) ;;
-h | --help)
	echo 'Usage: ./scripts/ci-format-audit.sh [check|write] [optional-file]'
	exit 0
	;;
*)
	echo 'ERROR: Expected check or write.' >&2
	exit 2
	;;
esac

if (($# > 2)); then
	echo 'ERROR: Expected [check|write] [optional-file].' >&2
	exit 2
fi

target_file="${2:-}"
target_file="${target_file#./}"

# Only allow repository-relative paths; never write outside the checkout.
if [[ "$target_file" == /* || "$target_file" == '..' || "$target_file" == ../* || "$target_file" == */../* ]]; then
	echo 'ERROR: File must be inside the repository.' >&2
	exit 2
fi

if [[ "$mode" == 'write' && ("${CI:-}" == 'true' || "${GITHUB_ACTIONS:-}" == 'true') ]]; then
	echo 'ERROR: write mode is disabled in CI.' >&2
	exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null)" || {
	echo 'ERROR: Git repository not found.' >&2
	exit 2
}
cd "$repo_root"

# Check explicit inputs outside the discovery loop so errors are not swallowed.
if [[ -n "$target_file" && ! -f "$target_file" ]]; then
	echo "ERROR: File not found: $target_file" >&2
	exit 2
fi
if [[ -n "$target_file" && -L "$target_file" ]]; then
	echo "ERROR: Refusing to format symbolic link: $target_file" >&2
	exit 2
fi

prettier_files=()
shell_files=()

while IFS= read -r -d '' path; do
	[[ -f "$path" && ! -L "$path" ]] || continue

	# Retain only the explicitly requested file, when provided.
	if [[ -n "$target_file" && "$path" != "$target_file" ]]; then
		continue
	fi

	# Skip generated output, dependency folders, required Markdown templates,
	# and lockfiles maintained by npm.
	case "$path" in
	node_modules/* | */node_modules/* | dist/* | */dist/* | build/* | */build/* | coverage/* | */coverage/* | artifacts/* | */artifacts/* | data/* | */data/*)
		continue
		;;
	.github/pull_request_template.md | .github/ISSUE_TEMPLATE/*.md | docs/templates/*.md | templates/*.md)
		continue
		;;
	package-lock.json | */package-lock.json | npm-shrinkwrap.json | */npm-shrinkwrap.json)
		continue
		;;
	esac

	# Route each file to exactly one formatter based on its extension.
	case "$path" in
	*.sh | *.bash)
		shell_files+=("$path")
		;;
	*.js | *.jsx | *.mjs | *.cjs | *.ts | *.tsx | *.json | *.jsonc | *.md | *.mdx | *.css | *.scss | *.less | *.html | *.yaml | *.yml)
		prettier_files+=("$path")
		;;
	esac
done < <(
	if [[ -n "$target_file" ]]; then
		printf '%s\0' "$target_file"
	else
		git ls-files --cached --others --exclude-standard -z
	fi
)

# Do this after discovery, not on every iteration: the arrays start empty.
if [[ -n "$target_file" ]] && ((${#prettier_files[@]} + ${#shell_files[@]} == 0)); then
	echo "ERROR: No eligible formatting target: $target_file" >&2
	exit 2
fi

# Locate an already-installed Prettier binary; never install packages here.
prettier_bin=''
if ((${#prettier_files[@]} > 0)); then
	for candidate in "$repo_root/node_modules/.bin/prettier" "$repo_root/backend/node_modules/.bin/prettier" "$repo_root/frontend/node_modules/.bin/prettier"; do
		if [[ -x "$candidate" ]]; then
			prettier_bin="$candidate"
			break
		fi
	done
	if [[ -z "$prettier_bin" ]] && command -v prettier >/dev/null 2>&1; then
		prettier_bin="$(command -v prettier)"
	fi
	if [[ -z "$prettier_bin" ]]; then
		echo 'ERROR: Prettier is not installed.' >&2
		exit 2
	fi
fi

# Verify shfmt before any possible modifications (no partial write).
if ((${#shell_files[@]} > 0)) && ! command -v shfmt >/dev/null 2>&1; then
	echo 'ERROR: shfmt is not installed.' >&2
	exit 2
fi

prettier_options=()
for ignore_file in .gitignore .prettierignore backend/.prettierignore frontend/.prettierignore; do
	if [[ -f "$ignore_file" ]]; then
		prettier_options+=(--ignore-path "$ignore_file")
	fi
done

echo "[Format] Mode: $mode"
echo "[Format] Prettier files: ${#prettier_files[@]}"
echo "[Format] Shell files: ${#shell_files[@]}"
failed=0

if ((${#prettier_files[@]} > 0)); then
	echo '[Format] Running Prettier...'
	if [[ "$mode" == 'check' ]]; then
		"$prettier_bin" "${prettier_options[@]}" --check "${prettier_files[@]}" || failed=1
	else
		"$prettier_bin" "${prettier_options[@]}" --write "${prettier_files[@]}" || failed=1
	fi
fi

if ((${#shell_files[@]} > 0)); then
	echo '[Format] Running shfmt...'
	if [[ "$mode" == 'check' ]]; then
		shfmt -d "${shell_files[@]}" || failed=1
	else
		shfmt -w "${shell_files[@]}" || failed=1
	fi
fi

if ((failed != 0)); then
	echo '[Format] Formatting problems detected.' >&2
	exit 1
fi

echo "[Format] $mode completed successfully."
