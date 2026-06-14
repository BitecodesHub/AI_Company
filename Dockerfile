# syntax=docker/dockerfile:1
# Bitecodes — single Dockerfile, single image, env-selectable service.
#
# The final image runs WEB by default; set SERVICE=api or SERVICE=migrate to run
# a different role from the SAME image. This is the reliable way to deploy a
# multi-service app from one Dockerfile on platforms (e.g. Render) that build a
# Dockerfile's final stage and run it as one service — a plain `docker build`
# (no --target) yields the web app, which is what those platforms deploy.
#
#   docker build -t bitecodes .            # → image that defaults to the web app
#   docker run -e SERVICE=api -p 4000:4000 bitecodes
#   docker run -e SERVICE=web -p 3000:3000 bitecodes
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

# ── runtime: one image, role chosen by $SERVICE (default web) ─────────────────
FROM build AS app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN chmod +x infra/docker/entrypoint.sh
# Default web port; api uses 4000 (both honour $PORT, which Render injects).
EXPOSE 3000 4000
HEALTHCHECK --interval=20s --timeout=10s --retries=5 --start-period=40s \
  CMD wget -qO- "http://localhost:${PORT:-3000}/" || wget -qO- "http://localhost:${PORT:-4000}/health" || exit 1
ENTRYPOINT ["sh", "infra/docker/entrypoint.sh"]
