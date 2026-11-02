#!/bin/sh

# CC67-TC01 / CC67-TC02: Verify the transport configuration of a deployed
# Bet application. This is an opt-in deployment check, not a local CI gate.
# Only an unauthenticated GET /health request is sent to each entry point.
set -eu

usage() {
	cat <<'USAGE'
Usage: check-transport-security.sh https://hostname[:port]

Checks HTTPS certificate trust, TLS 1.2+ negotiation, GET /health,
and HTTP-to-HTTPS redirect/rejection for the same hostname on port 80.
No credentials or session cookies are sent.

Exit codes: 0 = observed checks pass; 1 = failed security check;
            2 = invalid input/prerequisite; 3 = inconclusive HTTP check.
USAGE
}

# Require an explicit HTTPS origin, not a credential-bearing URL.
if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
	usage
	exit 0
fi

if [ "$#" -ne 1 ]; then
	usage >&2
	exit 2
fi

HTTPS_ORIGIN=${1%/}

case "$HTTPS_ORIGIN" in
https://*) ;;
*)
	printf '%s\n' 'ERROR: Provide an https:// origin.' >&2
	exit 2
	;;
esac

AUTHORITY=${HTTPS_ORIGIN#https://}

# Accept DNS or IPv4 with optional HTTPS port.
# Reject paths, queries, credentials, and IPv6 in this version.
if ! printf '%s\n' "$AUTHORITY" |
	grep -Eq '^[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?$'; then
	printf '%s\n' \
		'ERROR: Expected https://hostname[:port] without a path or credentials.' >&2
	exit 2
fi

if ! command -v curl >/dev/null 2>&1; then
	printf '%s\n' 'ERROR: curl is required.' >&2
	exit 2
fi

HTTP_HOST=${AUTHORITY%%:*}
HTTPS_HEALTH="$HTTPS_ORIGIN/health"
HTTP_HEALTH="http://$HTTP_HOST/health"

# CC67-TC01:
# Validate the certificate and hostname using curl's normal trust store.
# Permit TLS 1.2 and newer; never disable certificate verification.
printf '%s\n' '[CC67-TC01] Checking trusted HTTPS and TLS 1.2+ ...'

if HTTPS_STATUS=$(curl --silent --show-error \
	--connect-timeout 5 \
	--max-time 15 \
	--proto '=https' \
	--tlsv1.2 \
	--output /dev/null \
	--write-out '%{http_code}' \
	"$HTTPS_HEALTH"); then
	:
else
	printf '%s\n' \
		'FAIL: HTTPS handshake, certificate validation, or request failed.' >&2
	exit 1
fi

if [ "$HTTPS_STATUS" != '200' ]; then
	printf 'FAIL: HTTPS /health returned HTTP %s (expected 200).\n' \
		"$HTTPS_STATUS" >&2
	exit 1
fi

printf '%s\n' \
	'PASS: Trusted HTTPS /health returned 200 using TLS 1.2 or newer.'

# CC67-TC02:
# Check the public HTTP entry point without sending credentials.
# An unreachable endpoint is inconclusive until network rules are checked.
HEADERS_FILE=$(mktemp)
trap 'rm -f "$HEADERS_FILE"' 0
trap 'exit 3' 1 2 3 15

printf '%s\n' \
	'[CC67-TC02] Checking HTTP redirect/rejection on port 80 ...'

if HTTP_STATUS=$(curl --silent --show-error \
	--connect-timeout 5 \
	--max-time 15 \
	--max-redirs 0 \
	--dump-header "$HEADERS_FILE" \
	--output /dev/null \
	--write-out '%{http_code}' \
	"$HTTP_HEALTH"); then
	:
else
	printf '%s\n' \
		'INCONCLUSIVE: HTTP entry point unreachable; verify external port exposure separately.' >&2
	exit 3
fi

case "$HTTP_STATUS" in
301 | 302 | 303 | 307 | 308)
	# Reject redirects to HTTP or a different origin.
	LOCATION=$(awk '
            tolower($1) == "location:" {
                sub(/\r$/, "", $2)
                value = $2
            }
            END { print value }
        ' "$HEADERS_FILE")

	case "$LOCATION" in
	"$HTTPS_ORIGIN" | "$HTTPS_ORIGIN"/*)
		printf 'PASS: HTTP redirects to HTTPS (%s).\n' \
			"$HTTP_STATUS"
		;;
	*)
		printf 'FAIL: Redirect did not target the HTTPS origin (%s).\n' \
			"$HTTP_STATUS" >&2
		exit 1
		;;
	esac
	;;
400 | 403 | 426)
	printf 'PASS: HTTP /health rejected the request (%s).\n' \
		"$HTTP_STATUS"
	;;
000)
	printf '%s\n' \
		'INCONCLUSIVE: HTTP request produced no response status.' >&2
	exit 3
	;;
*)
	printf 'FAIL: HTTP /health was not redirected or rejected (%s).\n' \
		"$HTTP_STATUS" >&2
	exit 1
	;;
esac

printf '%s\n' \
	'PASS: Sampled transport checks passed; deployment-wide verification remains required.'
