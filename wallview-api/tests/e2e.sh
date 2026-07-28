#!/usr/bin/env bash
# End-to-end verification for the WallView API auth + multi-tenancy foundation.
# Usage:  BASE=http://127.0.0.1:8099 bash tests/e2e.sh
# Requires the dev server running and a fresh (or reusable) wallview_dev schema.
set -u
BASE="${BASE:-http://127.0.0.1:8099}"
PHP="${PHP:-D:/xampp/php/php.exe}"
PASS=0; FAIL=0

# Extract a dotted JSON field from stdin.
jx() { "$PHP" -r '$d=json_decode(stream_get_contents(STDIN),true);$k=$argv[1];foreach(explode(".",$k) as $p){$d=is_array($d)?($d[$p]??null):null;}echo is_scalar($d)?$d:json_encode($d);' "$1"; }
ok()   { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }
# assert http code: check <desc> <expected> <actual>
check() { if [ "$2" = "$3" ]; then ok "$1 ($3)"; else bad "$1 (expected $2, got $3)"; fi; }

# unique-ish suffix so reruns don't collide on subdomain/email
SFX=$(date +%s)

echo "== 1. Health =="
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/v1/health")
check "health 200" 200 "$CODE"

provision() { # $1=label -> echoes "accessToken refreshToken subdomain"
  local label="$1" tag; tag=$(echo "$1" | tr 'A-Z' 'a-z')
  local email="user_${tag}_${SFX}@ex.com" sub="ws-${tag}-${SFX}"   # slug must be lowercase
  local dev code inv setup at rt
  dev=$(curl -s -X POST "$BASE/api/v1/register" -H 'Content-Type: application/json' -d "{\"email\":\"$email\",\"mobile\":\"123\"}")
  code=$(echo "$dev" | jx devCode)
  inv=$(curl -s -X POST "$BASE/api/v1/verify" -H 'Content-Type: application/json' -d "{\"email\":\"$email\",\"code\":\"$code\"}" | jx inviteCode)
  setup=$(curl -s -X POST "$BASE/api/v1/workspace/setup" -H 'Content-Type: application/json' \
    -d "{\"inviteCode\":\"$inv\",\"email\":\"$email\",\"subdomain\":\"$sub\",\"businessName\":\"Biz $label\",\"password\":\"secret12\",\"adminName\":\"Admin $label\"}")
  at=$(echo "$setup" | jx accessToken); rt=$(echo "$setup" | jx refreshToken)
  echo "$at|$rt|$sub|$email"
}

echo "== 2. Funnel + provision tenant A =="
A=$(provision A); AT_A=$(echo "$A"|cut -d'|' -f1); RT_A=$(echo "$A"|cut -d'|' -f2); SUB_A=$(echo "$A"|cut -d'|' -f3); EMAIL_A=$(echo "$A"|cut -d'|' -f4)
[ -n "$AT_A" ] && ok "tenant A provisioned + auto-login (got JWT)" || bad "tenant A provisioning"

echo "== 3. Provision tenant B =="
B=$(provision B); AT_B=$(echo "$B"|cut -d'|' -f1); RT_B=$(echo "$B"|cut -d'|' -f2); SUB_B=$(echo "$B"|cut -d'|' -f3)
[ -n "$AT_B" ] && ok "tenant B provisioned" || bad "tenant B provisioning"

echo "== 4. /me reflects the authenticated tenant =="
ME_A=$(curl -s "$BASE/api/v1/me" -H "Authorization: Bearer $AT_A")
[ "$(echo "$ME_A"|jx subdomain)" = "$SUB_A" ] && ok "/me subdomain = $SUB_A" || bad "/me subdomain mismatch: $ME_A"

echo "== 5. Auth required =="
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/v1/me")
check "no token -> 401" 401 "$CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/v1/me" -H "Authorization: Bearer not.a.token")
check "bad token -> 401" 401 "$CODE"

echo "== 6. Tenant config (own tenant) =="
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/v1/$SUB_A/config" -H "Authorization: Bearer $AT_A")
check "own config -> 200" 200 "$CODE"

echo "== 7. IDOR guard (tenant B's slug with tenant A's token) =="
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/v1/$SUB_B/config" -H "Authorization: Bearer $AT_A")
check "cross-tenant config -> 403" 403 "$CODE"

echo "== 8. Refresh rotation =="
NEW=$(curl -s -X POST "$BASE/api/v1/refresh" -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$RT_A\"}")
[ -n "$(echo "$NEW"|jx accessToken)" ] && ok "refresh issued new token" || bad "refresh failed: $NEW"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/refresh" -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$RT_A\"}")
check "reused (rotated) refresh -> 401" 401 "$CODE"

echo "== 9. Login =="
LOGIN=$(curl -s -X POST "$BASE/api/v1/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL_A\",\"subdomain\":\"$SUB_A\",\"password\":\"secret12\"}")
[ -n "$(echo "$LOGIN"|jx accessToken)" ] && ok "login returns JWT" || bad "login failed: $LOGIN"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL_A\",\"subdomain\":\"$SUB_A\",\"password\":\"WRONG\"}")
check "wrong password -> 401" 401 "$CODE"

echo "== 10. Projects: CRUD + per-tenant isolation =="
PID=$(curl -s -X POST "$BASE/api/v1/$SUB_A/projects" -H "Authorization: Bearer $AT_A" -H 'Content-Type: application/json' \
  -d '{"name":"Kitchen","design":{"name":"Job 1","modules":[{"name":"Base"}],"active":0}}' | jx id)
[ -n "$PID" ] && ok "create project" || bad "create project"
GOT=$(curl -s "$BASE/api/v1/$SUB_A/projects/$PID" -H "Authorization: Bearer $AT_A" | jx design.modules.0.name)
[ "$GOT" = "Base" ] && ok "design round-trips" || bad "design round-trip ($GOT)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/v1/$SUB_B/projects/$PID" -H "Authorization: Bearer $AT_B")
check "B reads A's id via own slug -> 404" 404 "$CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/v1/$SUB_A/projects/$PID" -H "Authorization: Bearer $AT_B")
check "B via A's slug (IDOR) -> 403" 403 "$CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/v1/$SUB_A/projects/$PID" -H "Authorization: Bearer $AT_A")
check "owner deletes -> 204" 204 "$CODE"

echo ""
echo "== RESULT: $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ]
