#!/usr/bin/env sh
# Bitecodes — one-shot DB bootstrap for `docker compose up`.
# Runs as the Postgres SUPERUSER (DATABASE_SUPERUSER_URL): enables pgvector,
# pushes the Drizzle schema (creates every table), then applies RLS policies +
# the unprivileged bitecodes_app role the API runs as. Idempotent + safe to rerun.
set -e

: "${DATABASE_SUPERUSER_URL:?DATABASE_SUPERUSER_URL is required for migrations}"

echo "[migrate] enabling pgvector extension…"
psql "$DATABASE_SUPERUSER_URL" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS vector;"

echo "[migrate] pushing Drizzle schema (as superuser)…"
cd /app
DATABASE_URL="$DATABASE_SUPERUSER_URL" pnpm --filter @bitecodes/db exec drizzle-kit push --force

echo "[migrate] applying RLS policies + app role…"
psql "$DATABASE_SUPERUSER_URL" -v ON_ERROR_STOP=1 -f packages/db/scripts/setup-rls.sql

echo "[migrate] complete."
