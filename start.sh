#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Bitecodes — one-command startup + test account creation
# Usage: bash start.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
cd "$(dirname "$0")"

BLUE='\033[0;34m'; GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

log()  { echo -e "${BLUE}▶${NC} $*"; }
ok()   { echo -e "${GREEN}✅${NC} $*"; }
warn() { echo -e "${YELLOW}⚠️${NC}  $*"; }
fail() { echo -e "${RED}❌${NC} $*"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║       BITECODES — STARTUP SCRIPT             ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. Docker check ──────────────────────────────────────────────────────────
log "Checking Docker..."
if ! docker ps &>/dev/null 2>&1; then
  warn "Docker is not running."
  echo ""
  echo "  Please:"
  echo "  1. Open Docker Desktop from your Dock or Applications folder"
  echo "  2. Wait for the green 'Docker Desktop is running' icon"
  echo "  3. Run this script again: bash start.sh"
  echo ""
  exit 1
fi
ok "Docker running ($(docker version --format '{{.Server.Version}}' 2>/dev/null))"

# ── 2. Start infra containers ────────────────────────────────────────────────
log "Starting infra (postgres, redis, minio, inngest, litellm)..."
echo "Using local Homebrew Postgres" # docker compose up postgres redis minio inngest litellm -d 2>&1 | grep -E "Started|Running|Pulled|Created" || true

# ── 3. Wait for Postgres to be healthy ──────────────────────────────────────
log "Waiting for Postgres..."
for i in $(seq 1 30); do
  docker exec bitecodes-postgres pg_isready -U bitecodes -d bitecodes &>/dev/null 2>&1 && break
  sleep 2
  [ $i -eq 30 ] && fail "Postgres didn't become healthy after 60s"
done
ok "Postgres healthy"

# ── 4. Push DB schema ────────────────────────────────────────────────────────
log "Pushing database schema..."
pnpm db:push 2>&1 | tail -3
ok "Schema applied"

# ── 5. Kill any old dev servers ──────────────────────────────────────────────
kill $(lsof -ti:4000) 2>/dev/null || true
kill $(lsof -ti:3002) 2>/dev/null || true
pkill -f "nest start" 2>/dev/null || true
sleep 2

# ── 6. Start API ─────────────────────────────────────────────────────────────
log "Starting API (http://localhost:4000)..."
pnpm --filter @bitecodes/api dev > /tmp/bitecodes-api.log 2>&1 &
API_PID=$!

for i in $(seq 1 25); do
  sleep 2
  grep -q "successfully started" /tmp/bitecodes-api.log 2>/dev/null && break
  [ $i -eq 25 ] && { tail -5 /tmp/bitecodes-api.log; fail "API failed to start"; }
done
ok "API running (PID $API_PID)"

# ── 7. Start Web ─────────────────────────────────────────────────────────────
log "Starting Web (http://localhost:3002)..."
PORT=3002 pnpm --filter @bitecodes/web dev > /tmp/bitecodes-web.log 2>&1 &
WEB_PID=$!

for i in $(seq 1 25); do
  sleep 2
  grep -q "Ready in\|Local:" /tmp/bitecodes-web.log 2>/dev/null && break
  [ $i -eq 25 ] && warn "Web server slow to start — check http://localhost:3002 in a moment"
done
ok "Web running (PID $WEB_PID)"

# ── 8. Create test account ───────────────────────────────────────────────────
log "Creating test account..."
sleep 3

SIGNUP_RESP=$(curl -s -X POST http://localhost:4000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@bitecodes.com","password":"Test1234!","name":"Test User"}' 2>/dev/null)

if echo "$SIGNUP_RESP" | grep -q '"token"\|"user"'; then
  ok "Test account created!"
elif echo "$SIGNUP_RESP" | grep -q "already exists\|CONFLICT"; then
  ok "Test account already exists"
else
  warn "Could not auto-create account via API. Run manually:"
  echo "  pnpm tsx scripts/create-test-user.ts"
  echo "  Response was: $SIGNUP_RESP"
fi

# ── 9. Final status ──────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║         ✅  BITECODES IS RUNNING             ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Web:    http://localhost:3002               ║"
echo "║  API:    http://localhost:4000               ║"
echo "║  Docs:   http://localhost:4000/docs          ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Test account:                               ║"
echo "║  Email:    test@bitecodes.com                ║"
echo "║  Password: Test1234!                         ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Open browser
open http://localhost:3002 2>/dev/null || true
