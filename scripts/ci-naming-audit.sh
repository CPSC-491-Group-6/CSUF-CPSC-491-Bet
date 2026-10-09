
#!/usr/bin/env bash

# Bet Project - Informational Naming Conventions Audit
#
# Checks selected Git-tracked filenames against the established file case
# conventions without renaming files or blocking a pull request.
# JavaScript identifier/function naming is intentionally excluded until
# the team agrees on a parser-backed, ownership-aware approach.

set -euo pipefail

# Resolve the repository root from the script path, not the caller's cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# If this file is run outside Git, explain the skipped audit without failing CI.
if ! git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[Naming audit] No Git checkout found; skipping informational audit."
  exit 0
fi

checked=0
warnings=0

# Print both a readable log line and a GitHub Actions annotation (when in CI).
# Escape characters that have special meaning inside workflow commands.
report_warning() {
  local file="$1"
  local message="$2"
  local escaped="$file"
  warnings=$((warnings + 1))

  printf '[Naming audit] WARNING: %s: %s\n' "$file" "$message"

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
    frontend/*|*/node_modules/*|*/dist/*) continue ;;
  esac

  filename="${path##*/}"

  case "$filename" in
    *.js|*.mjs|*.cjs)
      # Audit backend and shared-script JS files; leave other areas untouched.
      case "$path" in backend/*|scripts/*) ;; *) continue ;; esac

      case "$filename" in
        # These filename structures are specified by common JS tooling.
        *.test.js|*.spec.js)
          stem="${filename%.js}"
          stem="${stem%.test}"
          stem="${stem%.spec}"
          ;;
        *.config.js|*.config.mjs|*.config.cjs)
          continue
          ;;
        *)
          stem="${filename%.*}"
          ;;
      esac

      checked=$((checked + 1))
      [[ "$stem" =~ ^[a-z][a-zA-Z0-9]*$ ]] ||
        report_warning "$path" 'JavaScript filename should have a camelCase stem.'
      ;;
    *.md)
      # Recognize established conventional docs/tool filename exceptions.
      case "$filename" in
        README.md|CHANGELOG.md|CONTRIBUTING.md|CODE_OF_CONDUCT.md|SECURITY.md|LICENSE.md)
          continue
          ;;
      esac

      stem="${filename%.md}"
      checked=$((checked + 1))
      [[ "$stem" =~ ^[a-z][a-z0-9]*(_[a-z0-9]+)*$ ]] ||
        report_warning "$path" 'Markdown filename should have a snake_case stem.'
      ;;
    *.sh)
      # Only audit scripts owned by the shared/backend areas initially.
      case "$path" in backend/*|scripts/*) ;; *) continue ;; esac

      stem="${filename%.sh}"
      checked=$((checked + 1))
      [[ "$stem" =~ ^[a-z][a-z0-9]*(-[a-z0-9]+)*$ ]] ||
        report_warning "$path" 'Shell script filename should have a kebab-case stem.'
      ;;
  esac
done < <(git -C "$REPO_ROOT" ls-files -z --cached)

printf '[Naming audit] Examined %d filenames; found %d advisory warning(s).\n' "$checked" "$warnings"

# Publish a readable summary in GitHub Actions when supported.
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    printf '### Informational naming audit\n\n'
    printf '%d filenames inspected; %d advisory warning(s).\n\n' "$checked" "$warnings"
    printf 'Existing files were not changed. This audit is **nonblocking**.\n'
  } >> "$GITHUB_STEP_SUMMARY"
fi

# Findings are advisory. Never fail CI for nonconforming names.
exit 0
