# syntax=docker/dockerfile:1
# Bitecodes — single multi-stage Dockerfile for the whole stack.
#
# One file, three build targets selected by docker-compose:
#   --target migrate  → one-shot DB bootstrap (pgvector + schema + RLS)
#   --target api      → NestJS API (run from source via tsx)
#   --target web      → Next.js web app (standalone production server)
#
# Build a single image manually with, e.g.:
#   docker build --target api -t bitecodes-api .
#
# Requires BuildKit (default in modern Docker) for the inlined heredoc script.

ARG NODE_VERSION=22

# ── base: Node + pnpm ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends wget ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# ── manifests: just the package manifests (cache the install layer) ───────────
FROM base AS manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/ai-core/package.json ./packages/ai-core/
COPY packages/connectors/package.json ./packages/connectors/
COPY packages/mcp/package.json ./packages/mcp/
COPY packages/ai-controller/package.json ./packages/ai-controller/
COPY packages/seo/package.json ./packages/seo/
COPY packages/ui/package.json ./packages/ui/

# ── migrate: pgvector + drizzle push + RLS, then exit ─────────────────────────
FROM base AS migrate
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client \
  && rm -rf /var/lib/apt/lists/*
COPY --from=manifests /app ./
RUN pnpm install --frozen-lockfile --filter @bitecodes/db...
COPY packages ./packages
RUN <<'EOF'
cat > /usr/local/bin/migrate.sh <<'SCRIPT'
#!/bin/sh
# Runs as the Postgres superuser (DATABASE_SUPERUSER_URL): enable pgvector,
# push the Drizzle schema (creates every table), then apply RLS + the
# unprivileged bitecodes_app role. Idempotent + safe to rerun.
set -e
: "${DATABASE_SUPERUSER_URL:?DATABASE_SUPERUSER_URL is required for migrations}"
echo "[migrate] enabling pgvector…"
psql "$DATABASE_SUPERUSER_URL" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS vector;"
echo "[migrate] pushing Drizzle schema (as superuser)…"
DATABASE_URL="$DATABASE_SUPERUSER_URL" pnpm --filter @bitecodes/db exec drizzle-kit push --force
echo "[migrate] applying RLS + app role…"
psql "$DATABASE_SUPERUSER_URL" -v ON_ERROR_STOP=1 -f packages/db/scripts/setup-rls.sql
echo "[migrate] complete."
SCRIPT
chmod +x /usr/local/bin/migrate.sh
EOF
CMD ["/usr/local/bin/migrate.sh"]

# ── api: NestJS, run FROM SOURCE via tsx ──────────────────────────────────────
# Workspace packages export TS source ("main": "src/index.ts"), so a compiled
# dist cannot resolve them with plain node. tsx transpiles everything on the fly.
FROM base AS api
COPY --from=manifests /app ./
RUN pnpm install --frozen-lockfile --filter @bitecodes/api... --filter @bitecodes/db
COPY . .
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "--import", "tsx", "apps/api/src/main.ts"]

# ── web-build: produce the Next.js standalone bundle ──────────────────────────
FROM base AS web-build
COPY --from=manifests /app ./
RUN pnpm install --frozen-lockfile --filter @bitecodes/web...
COPY . .
# NODE_ENV=production is required: next.config gates `output: standalone` on it,
# and the web runtime target copies that bundle.
ENV NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
RUN pnpm --filter @bitecodes/web build

# ── web: minimal standalone runner ────────────────────────────────────────────
FROM base AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=web-build /app/apps/web/public ./apps/web/public
COPY --from=web-build /app/apps/web/.next/standalone ./
COPY --from=web-build /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# ── worker: optional Python FastAPI AI worker (Phase 3+) ──────────────────────
# A multi-stage Dockerfile may mix base images; this target uses Python so the
# whole project still builds from one file.
FROM python:3.12-slim AS worker
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
  && rm -rf /var/lib/apt/lists/*
COPY apps/worker/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/worker/ ./
ENV PYTHONUNBUFFERED=1
EXPOSE 4002
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "4002"]
