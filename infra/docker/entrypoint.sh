#!/usr/bin/env bash
# Single-image entrypoint. $SERVICE selects the role; the same built image runs
# any role. The DEFAULT role `app` runs the WHOLE product (API + web) in one
# container, so the web app proxies the API same-origin at localhost:4000 — no
# API URL is configured anywhere, and one `docker run` starts everything.
#
#   (default)      → app: API on :4000 + web on :$PORT (combined, recommended)
#   SERVICE=api    → API only, on :$PORT (split deployments)
#   SERVICE=web    → web only (expects an API reachable at localhost:4000)
#   SERVICE=migrate→ one-shot: pgvector + schema push + RLS + app role
set -uo pipefail

case "${SERVICE:-app}" in
  migrate)
    set -e
    : "${DATABASE_SUPERUSER_URL:?DATABASE_SUPERUSER_URL is required for migrations}"
    echo "[entrypoint] migrate: enabling pgvector…"
    psql "$DATABASE_SUPERUSER_URL" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS vector;"
    echo "[entrypoint] migrate: pushing schema…"
    DATABASE_URL="$DATABASE_SUPERUSER_URL" pnpm --filter @bitecodes/db exec drizzle-kit push --force
    echo "[entrypoint] migrate: applying RLS + app role…"
    psql "$DATABASE_SUPERUSER_URL" -v ON_ERROR_STOP=1 -f packages/db/scripts/setup-rls.sql
    echo "[entrypoint] migrate: done."
    ;;
  api)
    echo "[entrypoint] starting API on :${PORT:-4000}…"
    exec node --import tsx apps/api/src/main.ts
    ;;
  web)
    echo "[entrypoint] starting web on :${PORT:-3000}…"
    exec pnpm --filter @bitecodes/web exec next start -p "${PORT:-3000}" -H 0.0.0.0
    ;;
  app | *)
    # Combined: API must listen on 4000 (the web build's baked proxy target);
    # web serves the public $PORT and proxies /v1, /api/auth, /socket.io to it.
    echo "[entrypoint] app: starting API (:4000) + web (:${PORT:-3000})…"
    PORT=4000 node --import tsx apps/api/src/main.ts &
    api_pid=$!
    pnpm --filter @bitecodes/web exec next start -p "${PORT:-3000}" -H 0.0.0.0 &
    web_pid=$!
    # If either process exits, tear the container down so the orchestrator restarts it.
    wait -n
    code=$?
    echo "[entrypoint] a process exited (code $code); stopping the other."
    kill "$api_pid" "$web_pid" 2>/dev/null || true
    wait 2>/dev/null || true
    exit "$code"
    ;;
esac
