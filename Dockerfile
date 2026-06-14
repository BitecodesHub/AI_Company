# syntax=docker/dockerfile:1
# Bitecodes — single Dockerfile, single image, env-selectable service.
#
# The final image runs the WHOLE product (API + web) by default (SERVICE=app):
# the web app proxies the API same-origin at localhost:4000, so no API URL is
# configured anywhere and one container serves everything. Set SERVICE=api/web/
# migrate to run a single role from the SAME image. A plain `docker build`
# (no --target) yields this combined app, which single-service platforms
# (e.g. Render) deploy.
#
#   docker build -t bitecodes .            # → combined app (API + web)
#   docker run -p 3000:3000 bitecodes      # → everything; web :3000, API :4000
#   docker run -e SERVICE=migrate ... bitecodes        # one-shot DB migrate
ARG NODE_VERSION=22

# ── base: Node + pnpm + psql client (psql needed by the migrate role) ─────────
FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends wget ca-certificates postgresql-client \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# ── build: install the full workspace, copy source, build the web app ─────────
FROM base AS build
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
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
RUN pnpm --filter @bitecodes/web build

# ── runtime: one image, role chosen by $SERVICE (default app = API + web) ─────
FROM build AS app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN chmod +x infra/docker/entrypoint.sh
# Web on $PORT (default 3000, Render injects $PORT); API on 4000 (combined role).
EXPOSE 3000 4000
HEALTHCHECK --interval=20s --timeout=10s --retries=5 --start-period=40s \
  CMD wget -qO- "http://localhost:${PORT:-3000}/" || wget -qO- "http://localhost:${PORT:-4000}/health" || exit 1
# bash (not sh) — the combined `app` role uses `wait -n` for process supervision.
ENTRYPOINT ["bash", "infra/docker/entrypoint.sh"]
