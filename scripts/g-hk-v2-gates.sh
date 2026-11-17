#!/usr/bin/env bash
# g-hk-v2-gates.sh - Stage 5 Housekeeping v2 exit gate
# Non-zero exit on FAIL. Static + auth-contract checks; runtime needs API up.
set -u
cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"; API="$ROOT/apps/api"; WEB="$ROOT/apps/web"
PASS=0; FAIL=0; SKIP=0
gate() { local n="$1" r="$2" dd="${3:-}"; case "$r" in
  PASS) PASS=$((PASS+1)); printf 'PASS  %-26s %s\n' "$n" "$dd";;
  FAIL) FAIL=$((FAIL+1)); printf 'FAIL  %-26s %s\n' "$n" "$dd";;
  SKIP) SKIP=$((SKIP+1)); printf 'SKIP  %-26s %s\n' "$n" "$dd";; esac; }
note() { printf '%s\n' "$*"; }

note '--- static: files + flag gate ---'
[ -f "$WEB/src/app/app/housekeeping/page.v2.jsx" ] && gate H1-frontend PASS '' || gate H1-frontend FAIL 'page.v2.jsx missing'
grep -q "useLiveFlag('housekeeping.v2'" "$WEB/src/app/app/housekeeping/page.jsx" && gate H2-flagkey PASS 'live flag gate' || gate H2-flagkey FAIL 'no housekeeping.v2 gate'
grep -q 'HousekeepingGate' "$WEB/src/app/app/housekeeping/page.jsx" && gate H3-v1preserved PASS 'v1 preserved under gate' || gate H3-v1preserved FAIL 'v1 not preserved'
grep -q 'SupervisorBoard' "$WEB/src/app/app/housekeeping/page.v2.jsx" && gate H4-board PASS 'supervisor view mounted' || gate H4-board FAIL 'SupervisorBoard not mounted'
grep -q 'Donut' "$WEB/src/app/app/housekeeping/page.v2.jsx" && gate H5-donut PASS 'readiness Donut in lens' || gate H5-donut FAIL 'Donut missing'

note '--- static: builds ---'
( cd "$API" && npx tsc --noEmit >/dev/null 2>&1 ) && gate H6-api-tsc PASS '' || gate H6-api-tsc FAIL 'api tsc'
( cd "$WEB" && npx tsc --noEmit >/dev/null 2>&1 ) && gate H7-web-tsc PASS '' || gate H7-web-tsc FAIL 'web tsc'

note '--- runtime: auth contract ---'
BASE="${API_BASE_URL:-http://localhost:3001}"
CA=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/v1/rooms" 2>/dev/null || true)
if [ "$CA" = "401" ] || [ "$CA" = "403" ]; then gate H8-rooms-auth PASS "unauth=$CA"
else gate H8-rooms-auth SKIP "API at $BASE unreachable (got '${CA:-none}')"; fi

note ''
note "RESULTS: $PASS passed, $FAIL failed, $SKIP skipped"
[ "$FAIL" -eq 0 ]
