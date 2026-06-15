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
#
# EMBEDDED DATABASE: when no external DATABASE_URL is configured (or it points at
# localhost, or EMBEDDED_DB=1), the container runs its OWN PostgreSQL 16 +
# pgvector on 127.0.0.1:5432 — so a single container is fully self-contained on
# platforms like Render with no separate database service. Mount a persistent
# disk at the PARENT of $PGDATA (default /var/lib/postgresql/data) so data
# survives deploys; $PGDATA itself is a subdirectory to avoid ext4 lost+found.
set -uo pipefail

PGDATA="${PGDATA:-/var/lib/postgresql/data/pgdata}"
EMBED_DB_NAME="${EMBED_DB_NAME:-bitecodes}"
EMBED_APP_USER="bitecodes_app"
EMBED_APP_PASSWORD="${EMBED_APP_PASSWORD:-bitecodes_app_secret}"
EMBEDDED_ACTIVE=0

# Use the bundled Postgres when there is no usable external database.
use_embedded_db() {
  [ "${EMBEDDED_DB:-}" = "1" ] && return 0
  [ -z "${DATABASE_URL:-}" ] && return 0
  printf '%s' "${DATABASE_URL:-}" | grep -qE '@(localhost|127\.0\.0\.1|\[::1\]|::1)[:/]' && return 0
  return 1
}

# Boot the in-container Postgres and export DATABASE_URL/DATABASE_SUPERUSER_URL.
# Superuser URL drives migrations; the app runs as the non-superuser bitecodes_app
# role (created by setup-rls.sql) so FORCE ROW LEVEL SECURITY still isolates tenants.
start_embedded_db() {
  local mount_root; mount_root="$(dirname "$PGDATA")"
  echo "[entrypoint] embedded Postgres: PGDATA=$PGDATA"
  mkdir -p "$PGDATA"
  # postgres must own/traverse PGDATA and traverse the disk mount root.
  chown postgres:postgres "$mount_root" 2>/dev/null || true
  chown -R postgres:postgres "$PGDATA" 2>/dev/null || true
  chmod 700 "$PGDATA" 2>/dev/null || true

  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "[entrypoint] initializing a new Postgres cluster…"
    # 5432 binds 127.0.0.1 only and is not EXPOSEd, so trust auth is safe in-container.
    su postgres -c "initdb --pgdata='$PGDATA' --auth-local=trust --auth-host=trust --username=postgres --encoding=UTF8" >/dev/null
  fi

  # An unclean shutdown (OOM/SIGKILL) can leave a stale pid that blocks startup.
  if [ -f "$PGDATA/postmaster.pid" ] && ! su postgres -c "pg_ctl --pgdata='$PGDATA' status" >/dev/null 2>&1; then
    echo "[entrypoint] removing stale postmaster.pid"
    rm -f "$PGDATA/postmaster.pid"
  fi

  echo "[entrypoint] starting Postgres on 127.0.0.1:5432…"
  su postgres -c "pg_ctl --pgdata='$PGDATA' -w -t 60 -o '-c listen_addresses=127.0.0.1 -p 5432' start" || true

  # Readiness gate — abort boot (so the platform restarts) if Postgres never comes up,
  # rather than running a DB-less API that 500s on every request.
  local i=0
  until su postgres -c "pg_isready -h 127.0.0.1 -p 5432 -q"; do
    i=$((i + 1))
    if [ "$i" -ge 30 ]; then
      echo "[entrypoint] FATAL: embedded Postgres did not become ready after 30s; exiting for restart."
      exit 1
    fi
    sleep 1
  done

  if ! su postgres -c "psql --username=postgres -tAc \"SELECT 1 FROM pg_database WHERE datname='$EMBED_DB_NAME'\"" | grep -q 1; then
    su postgres -c "createdb --username=postgres '$EMBED_DB_NAME'"
  fi

  export DATABASE_SUPERUSER_URL="postgres://postgres@127.0.0.1:5432/$EMBED_DB_NAME"
  export DATABASE_URL="postgres://$EMBED_APP_USER:$EMBED_APP_PASSWORD@127.0.0.1:5432/$EMBED_DB_NAME"
  EMBEDDED_ACTIVE=1
  echo "[entrypoint] embedded Postgres ready (db=$EMBED_DB_NAME)."
}

stop_embedded_db() {
  [ "$EMBEDDED_ACTIVE" = "1" ] || return 0
  echo "[entrypoint] stopping embedded Postgres…"
  su postgres -c "pg_ctl --pgdata='$PGDATA' -m fast stop" >/dev/null 2>&1 || true
}

# ── Migration steps (pgvector + schema + RLS). Subshell so `set -e` makes the
#    whole thing fail fast and return non-zero to the caller. ──────────────────
run_migrate() (
  set -e
  : "${DATABASE_SUPERUSER_URL:?DATABASE_SUPERUSER_URL is required for migrations}"
  echo "[entrypoint] migrate: enabling pgvector…"
  psql "$DATABASE_SUPERUSER_URL" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS vector;"
  echo "[entrypoint] migrate: pushing schema…"
  DATABASE_URL="$DATABASE_SUPERUSER_URL" pnpm --filter @bitecodes/db exec drizzle-kit push --force
  echo "[entrypoint] migrate: applying RLS + app role…"
  psql "$DATABASE_SUPERUSER_URL" -v ON_ERROR_STOP=1 -f packages/db/scripts/setup-rls.sql
  echo "[entrypoint] migrate: done."
)

# ── Startup self-heal. Runs migrate when the schema is missing — and, in
#    embedded mode, also when the app role is missing (schema and role can
#    diverge on a persisted disk). Fast no-op otherwise; never blocks boot. ─────
ensure_schema() {
  if [ "${SKIP_STARTUP_MIGRATE:-}" = "1" ]; then
    echo "[entrypoint] startup schema check skipped (SKIP_STARTUP_MIGRATE=1)"
    return 0
  fi
  if [ -z "${DATABASE_SUPERUSER_URL:-}" ]; then
    echo "[entrypoint] no DATABASE_SUPERUSER_URL set; skipping startup schema check."
    return 0
  fi
  local users_table need_migrate=0
  users_table=$(psql "$DATABASE_SUPERUSER_URL" -tAc "SELECT to_regclass('public.users')" 2>/dev/null || true)
  if [ -z "$users_table" ]; then
    need_migrate=1
  elif [ "$EMBEDDED_ACTIVE" = "1" ]; then
    # The app connects as bitecodes_app, so that role must also exist.
    local app_role
    app_role=$(psql "$DATABASE_SUPERUSER_URL" -tAc "SELECT 1 FROM pg_roles WHERE rolname='$EMBED_APP_USER'" 2>/dev/null || true)
    [ -z "$app_role" ] && need_migrate=1
  fi
  if [ "$need_migrate" = "0" ]; then
    echo "[entrypoint] schema present (found '$users_table'); skipping startup migrate."
    return 0
  fi
  echo "[entrypoint] schema/role missing — running one-time self-heal migrate…"
  if run_migrate; then
    echo "[entrypoint] self-heal migrate complete."
  else
    echo "[entrypoint] WARNING: self-heal migrate failed; continuing to boot. Check DB connectivity and logs."
  fi
}

case "${SERVICE:-app}" in
  migrate)
    set -e
    if use_embedded_db; then start_embedded_db; fi
    run_migrate
    ;;
  api)
    if use_embedded_db; then start_embedded_db; fi
    ensure_schema
    echo "[entrypoint] starting API on :${PORT:-4000}…"
    exec node -r ./infra/docker/api-dist-paths.cjs apps/api/dist/apps/api/src/main.js
    ;;
  web)
    echo "[entrypoint] starting web on :${PORT:-3000}…"
    exec pnpm --filter @bitecodes/web exec next start -p "${PORT:-3000}" -H 0.0.0.0
    ;;
  app | *)
    # Combined: API must listen on 4000 (the web build's baked proxy target);
    # web serves the public $PORT and proxies /v1, /api/auth, /socket.io to it.
    if use_embedded_db; then start_embedded_db; fi
    ensure_schema
    echo "[entrypoint] app: starting API (:4000) + web (:${PORT:-3000})…"
    PORT=4000 node -r ./infra/docker/api-dist-paths.cjs apps/api/dist/apps/api/src/main.js &
    api_pid=$!
    pnpm --filter @bitecodes/web exec next start -p "${PORT:-3000}" -H 0.0.0.0 &
    web_pid=$!
    # If either process exits, tear the container down so the orchestrator restarts it.
    wait -n
    code=$?
    echo "[entrypoint] a process exited (code $code); stopping the others."
    kill "$api_pid" "$web_pid" 2>/dev/null || true
    stop_embedded_db
    wait 2>/dev/null || true
    exit "$code"
    ;;
esac
