#!/bin/sh
# Single-image entrypoint. The same built image runs any role, selected by
# $SERVICE — so one Dockerfile + one image deploys web, api, or the DB migrate
# (ideal for platforms like Render that build a Dockerfile's final stage and run
# it as one service). Default is `web`, so a target-less build serves the site.
set -e

case "${SERVICE:-web}" in
  migrate)
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
  web | *)
    echo "[entrypoint] starting web on :${PORT:-3000}…"
    exec pnpm --filter @bitecodes/web exec next start -p "${PORT:-3000}" -H 0.0.0.0
    ;;
esac
