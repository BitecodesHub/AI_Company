# Bitecodes — Codex Reference

Bitecodes is a production-grade, multi-tenant, white-label Agentic AI platform (Apache 2.0 open-core). Brand: **Bitecodes**. No "PRISM" strings in code.

## Critical rules (from BUILD_GUIDE)

1. **Never invent a name.** Tables, columns, Inngest events, REST routes, WebSocket namespaces, env vars, packages, shared types must be in `docs/BUILD_GUIDE.md`. Add there first, then use.
2. **Never invent a dependency.** Only use libraries in `ARCHITECTURE.md §3`.
3. **No model/tool calls in HTTP handlers.** Controllers enqueue Inngest events; models only run inside `step.*` calls.
4. **Tenant context is mandatory.** Every DB query runs inside `withTenant(orgId, wsId, fn)`.
5. **Inngest events** = slash-namespaced (`agent/run`). **AI Controller actions** = dot-namespaced (`agent.run`). **Never mix.**
6. **Workspace header** = `x-bitecodes-workspace` (not `x-prism-workspace`).
7. **Package namespace** = `@bitecodes/*` (not `@prism/*`).

## Monorepo layout

```
apps/web          — Next.js 15 (App Router, Tailwind v4, shadcn/ui)
apps/api          — NestJS 11 (REST + WebSocket + Inngest)
apps/worker       — Python FastAPI (optional, Phase 3+)
packages/shared   — Zod schemas + TS types (THE contract)
packages/db       — Drizzle ORM schema, migrations, RLS
packages/ui       — Shared React components (@bitecodes/ui)
packages/ai-core  — ModelRouter, PromptAssembler, Guardrails
packages/connectors — Connector interface + vault
packages/mcp      — MCP client/server helpers
packages/ai-controller — Action registry + command bus types
packages/seo      — JSON-LD builders + metadata helpers
packages/config   — Shared tsconfig, eslint, prettier, Tailwind theme
ee/               — Enterprise features (license-key gated)
```

## Running tests

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
pnpm --filter @bitecodes/shared test        # 33 tests
pnpm --filter @bitecodes/api test           # 5 tests
pnpm --filter @bitecodes/ai-core test       # 11 tests
pnpm --filter @bitecodes/ai-controller test # 9 tests
pnpm --filter @bitecodes/seo test           # 6 tests
pnpm --filter @bitecodes/ui test            # 5 tests
```

## Starting the stack

```bash
docker compose up postgres redis minio inngest litellm -d
cp .env.example .env  # fill POSTGRES_PASSWORD, AUTH_SECRET, ENCRYPTION_KEY
pnpm --filter @bitecodes/api dev   # http://localhost:4000, Swagger at /docs
pnpm --filter @bitecodes/web dev   # http://localhost:3000
```

## Key canonical catalogs

| Catalog | Location |
|---|---|
| Inngest events | `docs/BUILD_GUIDE.md §6` |
| REST routes | `docs/BUILD_GUIDE.md §7` |
| WebSocket namespaces | `docs/BUILD_GUIDE.md §8` |
| Env vars | `docs/BUILD_GUIDE.md §5` + `.env.example` |
| Error codes | `docs/BUILD_GUIDE.md §12` |
| State machines | `docs/BUILD_GUIDE.md §10` |
| AI Controller actions | `packages/ai-controller/src/registry.ts` |

## Ports

| Service | Port |
|---|---|
| Web (Next.js) | 3000 |
| API (NestJS) | 4000 |
| LiteLLM gateway | 4001 |
| Inngest dev | 8288 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| MinIO API / Console | 9000 / 9001 |

## Build phases completed

- ✅ Phase 0: Monorepo, docker-compose, shared contracts, NestJS + Next.js shells
- ✅ Phase 1: Drizzle schema (30+ tables), RLS policies, auth, guards
- ✅ Phase 2: ModelRouter, PromptAssembler, Guardrails, Inngest agent executor
- ✅ Phase 3: KB ingest pipeline, knowledge REST
- ✅ Phase 4: Connector interface, vault, OAuth controller
- ✅ Phase 5-6: Workflow + Social + Inbox REST + Inngest events
- ✅ Phase 7-8: AI Controller action registry, command bus, controller dispatch
- ✅ Phase 9-10: Admin, Blog, Billing, Webhook ingress, SEO JSON-LD builders
- ✅ Phase 11-12: Marketplace templates, billing REST stubs
- ⏳ Phase 13: Enterprise SSO/RBAC/Audit (ee/ directory, license-gated)
- ⏳ Phase 14: Langfuse + OpenTelemetry observability, security hardening
- ⏳ Phase 15: Launch polish, product tour, public marketing pages
