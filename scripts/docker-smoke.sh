#!/usr/bin/env bash
# Builds the image and checks the container the way an operator runs it:
# health, auth (no demo tokens in production), one real audit, and state persisted across a restart.
set -euo pipefail
IMAGE="${IMAGE:-srp:ci}"
TOKEN="ci_admin_$(openssl rand -hex 12)"
NAME="srp-smoke-$$"
VOL="srp-smoke-data-$$"
PORT="${PORT:-18080}"
BASE="http://127.0.0.1:${PORT}"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; docker volume rm "$VOL" >/dev/null 2>&1 || true; }
trap cleanup EXIT

start() {
  docker run -d --name "$NAME" -p "${PORT}:8080" -e SRP_TOKENS="${TOKEN}:admin:ci" -v "${VOL}:/data" "$IMAGE" >/dev/null
  for _ in $(seq 1 30); do
    if curl -fsS "$BASE/api/health" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  docker logs "$NAME"; echo "container never became healthy"; exit 1
}

status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
expect() { if [ "$2" != "$3" ]; then echo "FAIL: $1 (expected $3, got $2)"; docker logs "$NAME"; exit 1; fi; echo "ok: $1"; }

docker build -t "$IMAGE" .
start
expect "health" "$(status "$BASE/api/health")" 200
expect "no token is 401" "$(status "$BASE/api/audits")" 401
expect "demo token rejected in production" "$(status -H 'authorization: Bearer srp_demo_admin_token' "$BASE/api/audits")" 401

BODY='{"name":"EtherStore","chain":"ethereum","documents":[],"sources":[{"path":"EtherStore.sol","language":"solidity","content":"contract EtherStore { mapping(address => uint256) public balances; function withdraw() public { uint256 bal = balances[msg.sender]; (bool sent, ) = msg.sender.call{value: bal}(\"\"); require(sent); balances[msg.sender] = 0; } }"}]}'
RESP="$(curl -fsS -X POST -H "authorization: Bearer ${TOKEN}" -H 'content-type: application/json' --data "$BODY" "$BASE/api/audits")"
node -e '
const r = JSON.parse(process.argv[1]);
if (r.schemaVersion !== "srp.audit/v1") throw new Error("bad schemaVersion " + r.schemaVersion);
if (!r.findings.some((f) => /reentran/i.test(f.title + " " + (f.category ?? "") + " " + (f.detector ?? "")))) throw new Error("reentrancy not found: " + JSON.stringify(r.findings.map((f) => f.title)));
console.log("ok: audit found reentrancy (" + r.findings.length + " findings)");
' "$RESP"

docker restart "$NAME" >/dev/null
for _ in $(seq 1 30); do curl -fsS "$BASE/api/health" >/dev/null 2>&1 && break; sleep 1; done
AUDITS="$(curl -fsS "$BASE/api/health" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).audits))')"
expect "audit persisted across restart" "$AUDITS" 1
echo "docker smoke passed"
