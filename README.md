# Bitecodes

A production-grade, multi-tenant, white-label **agentic AI platform** — hire AI employees that do real work, with the controls, memory, and oversight a real team needs. Open-core (Apache 2.0).

## Run the whole project with one command

```bash
cp .env.example .env     # set POSTGRES_PASSWORD, MINIO_ROOT_PASSWORD, AUTH_SECRET, ENCRYPTION_KEY
docker compose up        # builds + starts everything
```

`docker compose up` starts the **entire stack**:

| Service | Port | Role |
|---|---|---|
| `web` (Next.js) | 3000 | Marketing site + app UI |
| `api` (NestJS) | 4000 | REST + WebSocket + Inngest (Swagger at `/docs`) |
| `migrate` | — | One-shot: enables pgvector, pushes the schema, applies RLS + the `bitecodes_app` role, then exits |
| `postgres` (pgvector) | 5432 | Database |
| `redis` | 6379 | Cache / queues |
| `minio` | 9000 / 9001 | S3-compatible storage |
| `inngest` | 8288 | Durable execution dev server |

Startup order is handled automatically: `migrate` runs after Postgres is healthy, and `api` waits for `migrate` to finish before booting. Open **http://localhost:3000**.

Out of the box the API runs in `AI_GATEWAY_MODE=mock` — no provider key required. To use a real provider, set in `.env`:

```env
AI_GATEWAY_MODE=          # leave blank for live
AI_PROVIDER=openrouter    # or: ollama | litellm
OPENROUTER_API_KEY=sk-or-...
DEFAULT_MODEL=anthropic/claude-3.5-sonnet
```

### Optional services

```bash
docker compose --profile litellm up   # also start the LiteLLM gateway (AI_PROVIDER=litellm)
docker compose --profile worker up     # also start the Python AI worker (Phase 3+)
```

### Validate your setup

```bash
pnpm setup:check         # checks env, DB, Redis, and the AI provider; prints fixes
```

## Local development (without Docker for the apps)

Run just the infrastructure in Docker and the apps with hot reload:

```bash
docker compose up postgres redis minio inngest -d
pnpm --filter @bitecodes/db db:push
psql "$DATABASE_SUPERUSER_URL" -f packages/db/scripts/setup-rls.sql
pnpm --filter @bitecodes/api dev    # :4000
pnpm --filter @bitecodes/web dev    # :3000
```

See `docs/BUILD_GUIDE.md` for the full architecture, canonical catalogs, and the two single-provider setup paths.

## Tests

```bash
pnpm -r typecheck
pnpm --filter @bitecodes/api test
pnpm --filter @bitecodes/web test
AI_GATEWAY_MODE=mock pnpm --filter @bitecodes/web exec playwright test
```
