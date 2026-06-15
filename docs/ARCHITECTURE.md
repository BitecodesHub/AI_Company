# Bitecodes — System Architecture

This is the canonical technical reference for Bitecodes. Every other document (README, task list, Word plan) is consistent with the names, schema, and flows defined here. If there is ever a conflict, **this document wins**.

> Before building, read **BUILD_GUIDE.md** — it carries the canonical catalogs you must not deviate from (Inngest events, REST routes, WebSocket namespaces, the complete environment-variable list, shared-type contracts, state machines, error codes, and the naming conventions). The rule is simple: if a name is not in this document or in BUILD_GUIDE, it does not exist yet — add it to the canonical list before using it.

**Design goals:** production-grade, multi-tenant, white-label, AI-first, self-hostable in one command, scalable without rewrites, and built so a small team (or an AI coding agent) can construct it piece by piece without anything falling apart.

---

## Table of contents

1. [Architectural overview](#1-architectural-overview)
2. [Why this stack (and what we rejected)](#2-why-this-stack-and-what-we-rejected)
3. [Dependency versions (canonical, pinned)](#3-dependency-versions-canonical-pinned)
4. [Layer-by-layer design](#4-layer-by-layer-design)
5. [Multi-tenancy model](#5-multi-tenancy-model)
6. [Complete database schema](#6-complete-database-schema)
7. [The agent runtime](#7-the-agent-runtime)
8. [The model gateway and routing](#8-the-model-gateway-and-routing)
9. [Knowledge base and RAG](#9-knowledge-base-and-rag)
10. [Connectors framework](#10-connectors-framework)
11. [MCP integration](#11-mcp-integration)
12. [Workflow engine](#12-workflow-engine)
13. [The social media subsystem](#13-the-social-media-subsystem)
14. [The AI Controller (the wow feature)](#14-the-ai-controller-the-wow-feature)
15. [The SEO engine](#15-the-seo-engine)
16. [The admin subsystem](#16-the-admin-subsystem)
17. [Billing and metering](#17-billing-and-metering)
18. [Security model](#18-security-model)
19. [Configuration and white-label](#19-configuration-and-white-label)
20. [Observability](#20-observability)
21. [Deployment topology](#21-deployment-topology)
22. [What breaks at scale and how we prevent it](#22-what-breaks-at-scale-and-how-we-prevent-it)
23. [API surface conventions](#23-api-surface-conventions)

---

## 1. Architectural overview

Bitecodes is a **modular monolith with a durable execution backbone**. Three deployable apps share one type-safe contract:

- **`apps/web`** — Next.js 15. Serves the authenticated app, the admin panel, and the public/marketing/SEO pages. Server components for SEO; client components for interactivity.
- **`apps/api`** — NestJS 11. REST + WebSocket. Owns the database, auth, billing, RBAC, audit, and hosts all Inngest functions (the durable agent/workflow logic).
- **`apps/worker`** — Python FastAPI. Optional. Handles embeddings, heavy RAG, and CPU/GPU-bound agent graphs. The system runs fully without it for V1 (Node handles light embeddings via the gateway).

Shared logic lives in `packages/*` and is imported by both `web` and `api`, so a type defined once is enforced everywhere.

```
                            ┌───────────────────────────────────────────────┐
                            │                  BROWSER                       │
                            │  Next.js app · Admin · Public SEO pages        │
                            │  Command palette · AI Controller overlay       │
                            └───────────────┬───────────────────────────────┘
                                            │ HTTPS (REST) + WSS (Socket.IO)
                            ┌───────────────▼───────────────────────────────┐
                            │                apps/api (NestJS)               │
                            │  Auth (Better Auth) · RBAC · Billing (Lago)    │
                            │  REST controllers · WebSocket gateway          │
                            │  Audit log · Settings · Webhooks ingress       │
                            └───┬───────────────┬──────────────────┬────────┘
            enqueue events       │               │ tool calls       │ model calls
                            ┌────▼─────────┐ ┌───▼──────────────┐ ┌─▼──────────────────┐
                            │   Inngest    │ │  MCP client/     │ │  LiteLLM gateway   │
                            │ durable runs │ │  server layer    │ │  (routing, BYO key,│
                            │ retries,     │ │  approval gate,  │ │  fallback, caching)│
                            │ replay,      │ │  signed tools    │ │                    │
                            │ pause/resume │ └──────────────────┘ └─┬──────────────────┘
                            └────┬─────────┘                         │ provider APIs
                                 │ spawns heavy work                 ▼
                            ┌────▼─────────────────────────┐   OpenAI · Anthropic ·
                            │  apps/worker (FastAPI)        │   Google · OpenRouter ·
                            │  embeddings · RAG · graphs    │   Ollama (local)
                            └────┬──────────────────────────┘
                                 │
        ┌────────────────────────▼─────────────────────────────────────────────┐
        │  PostgreSQL 16 + pgvector   (Row-Level Security per tenant)            │
        │  Redis 7 (BullMQ, cache, rate limits)   ·   S3-compatible blob store   │
        │  Langfuse (LLM traces)                                                 │
        └────────────────────────────────────────────────────────────────────────┘
```

**Key data flows** (detailed later):
- *User triggers an agent* → API validates + enqueues an Inngest event → Inngest function assembles the prompt (via `ai-core`), routes to the model (via LiteLLM), calls tools (via MCP/connectors), streams steps back over WebSocket, persists every step, pauses for approvals as needed.
- *A scheduled social post* → Inngest cron → content agent drafts → approval gate → connector publishes → result stored → inbox watches for engagement.
- *User talks to the AI Controller* → command goes to a special agent whose tools are the app's Action Registry → the agent calls actions → the Command Bus in the browser executes them (navigate, fill, mutate) → user sees a live trace.

---

## 2. Why this stack (and what we rejected)

**Rejected: Spring Boot + Python + TypeScript triple stack.** A small team cannot maintain three runtimes. The AI/agent ecosystem (Inngest, MCP SDKs, LiteLLM, LangGraph.js, Vercel AI SDK) lives in JS/Python. The JVM's memory footprint and image size hurt on a small VPS, and there is no shared-type benefit. **Decision:** TypeScript everywhere, with one optional Python service for genuinely Python-only work (embeddings/heavy graphs). If the founder loves Spring's structure, NestJS provides the same decorator/module/DI model in TypeScript.

**Rejected: microservices from day one.** Premature distribution multiplies operational cost. **Decision:** modular monolith; split a module into its own service only when a real bottleneck appears.

**Rejected: building our own durable execution engine, model abstraction, vector DB, or auth.** Each is a multi-month project on its own. **Decision:** integrate Inngest, LiteLLM, pgvector, and Better Auth. Keep each behind a thin interface so it can be swapped (e.g. Inngest → Temporal at very large scale).

**Rejected: Pinecone/Weaviate as a separate vector store for V1.** **Decision:** pgvector keeps everything in one database (cheaper, simpler, RLS-protected). Revisit at very large scale.

---

## 3. Dependency versions (canonical, pinned)

> Pin these exactly. Do not use `latest`. This list is the single source of truth; `package.json` files must match it. (Versions reflect the stable line at time of writing; bump deliberately, never implicitly.)

**Root / tooling**
- `node` 22.x LTS · `pnpm` 9.x · `turbo` 2.x · `typescript` 5.6.x

**apps/web**
- `next` 15.x · `react` 19.x · `react-dom` 19.x
- `tailwindcss` 4.x · `@radix-ui/react-*` · `lucide-react`
- shadcn/ui (copied components, not a dependency)
- `@tanstack/react-query` 5.x · `zustand` 5.x
- `react-hook-form` 7.x · `zod` 3.x · `@hookform/resolvers`
- `@xyflow/react` 12.x (React Flow) · `socket.io-client` 4.x
- `next-intl` (i18n) · `next-themes` (dark mode) · `cmdk` (command palette)
- `next-sitemap` · `schema-dts` (typed JSON-LD)
- In-house lightweight markdown renderer for agent chat messages (no external dependency)
- `sonner` (toasts)

**apps/web**
- `sonner` (toast notifications)

**apps/api**
- `@nestjs/core` / `@nestjs/common` 11.x · `@nestjs/platform-express`
- `@nestjs/websockets` + `@nestjs/platform-socket.io`
- `@nestjs/swagger` (OpenAPI) · `drizzle-orm` · `drizzle-kit`
- `pg` (node-postgres) · `ioredis` · `bullmq`
- `inngest` (SDK) · `better-auth` · `@aws-sdk/client-s3` (S3-compatible)
- `litellm` is run as a container (Python proxy); the API talks to it over HTTP using the OpenAI-compatible client `openai` (TS).
- `@modelcontextprotocol/sdk` (MCP client + server)
- `libsodium-wrappers` (secret sealing) · `langfuse` (tracing)
- `js-tiktoken` (token counting for chunking) · `pdf-parse` + `mammoth` (document parsing)
- `stripe` (Stripe SDK — billing)

**Testing**
- `vitest` · `@vitest/coverage-v8` (coverage) · `@nestjs/testing` · `supertest`
- `playwright` / `@playwright/test` (E2E)
- `unplugin-swc` + `@swc/core` (NestJS decorator metadata under Vitest)
- `@inngest/test` + `testcontainers` (durable function integration tests; Testcontainers starts a postgres container)

**apps/worker (optional, Python 3.12)**
- `fastapi` · `uvicorn` · `pydantic` 2.x
- `litellm` (as a library too, if needed) · `langfuse`
- `sentence-transformers` or provider embeddings · `pgvector` (psycopg) · `unstructured` (doc parsing)
- `langgraph` / `crewai` (only for advanced multi-agent graphs)

**Infrastructure (containers)**
- `postgres:16` with the `pgvector/pgvector:pg16` image · `redis:7` · `minio/minio` · `inngest/inngest` (dev server) · `ghcr.io/berriai/litellm` (gateway)

---

## 4. Layer-by-layer design

### 4.1 Frontend (`apps/web`)
- **App Router** with route groups:
  - `(public)` — marketing, pricing, blog, marketplace, public agent profiles. **Statically generated / server-rendered** for SEO.
  - `(auth)` — login, signup, SSO callbacks.
  - `(app)` — the authenticated product (agents, workflows, inbox, content, knowledge, analytics, settings).
  - `(admin)` — workspace admin and super-admin.
- **Server Components** fetch data directly for first paint and SEO; **Client Components** handle interactivity and subscribe to live run updates over Socket.IO.
- **Design system** in `packages/ui` (shadcn/ui based). All colors come from CSS variables so white-label theming is a variable swap.
- **AI Controller overlay** is a global client component mounted in the app shell; it holds a Socket.IO channel and the Command Bus (section 14).

### 4.2 Backend (`apps/api`)
- **NestJS modules** map 1:1 to domains: `auth`, `org`, `workspace`, `agent`, `run`, `knowledge`, `connector`, `mcp`, `workflow`, `social`, `inbox`, `controller`, `billing`, `marketplace`, `seo`, `admin`, `audit`, `settings`, `webhook`.
- **Controllers** expose REST; a **WebSocket gateway** streams run/step events and AI Controller traces.
- **Inngest functions** live in `apps/api/src/inngest/*` and are the only place long-running/agent logic executes. Controllers never call models synchronously; they enqueue events.
- **Guards**: `AuthGuard` (Better Auth session), `TenantGuard` (resolves org/workspace, sets RLS context), `RbacGuard` (permission check), `RateLimitGuard`, `CostLimitGuard`.

### 4.3 AI worker (`apps/worker`)
- A small FastAPI app exposing `/embed`, `/ingest`, `/graph/run`. Called by Inngest steps when work is Python-only. Stateless; reads/writes Postgres and blob store. Skippable in V1.

### 4.4 Shared packages
- `packages/shared` — Zod schemas + inferred TypeScript types for every entity and every API payload. **This is the contract.** Web and API both import it.
- `packages/db` — Drizzle schema, migrations, RLS policy SQL, seed.
- `packages/ai-core` — `PromptAssembler`, `ModelRouter` (LiteLLM client), `AgentExecutor` interface, `Guardrails`, `MemoryStore`.
- `packages/connectors` — `Connector` interface + registry + first-party connectors.
- `packages/mcp` — `McpClientManager`, `McpServerHost`, tool-approval and signing helpers.
- `packages/ai-controller` — `ActionRegistry`, `actionSchemas`, `CommandBus` types.
- `packages/seo` — sitemap builders, JSON-LD builders, metadata generators.

---

## 5. Multi-tenancy model

**Hierarchy:** `Instance` (one deployment) → `Organization` (a tenant/company) → `Workspace` (a sub-tenant, e.g. an agency's individual client) → `User` (belongs to org(s) and workspace(s) with roles).

**Isolation strategy: shared database, shared schema, Postgres Row-Level Security (RLS).**
- Every tenant-scoped table carries `organization_id` and (where applicable) `workspace_id`.
- Each such table has `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.
- Policies compare the row's tenant columns against session GUCs `app.current_org` and `app.current_workspace`.
- The `TenantGuard` sets these GUCs at the start of every request transaction: `SET LOCAL app.current_org = '<uuid>'`.
- Result: even if an application query forgets a `WHERE organization_id = ...`, the database refuses to return another tenant's rows. Cross-tenant leakage becomes structurally impossible, not merely "unlikely."

**Connection handling:** use a transaction-scoped client so `SET LOCAL` applies per request and never leaks across pooled connections. Drizzle executes `set_config('app.current_org', $1, true)` inside the request transaction.

---

## 6. Complete database schema

Drizzle/PostgreSQL. UUID primary keys (`gen_random_uuid()`), `created_at`/`updated_at` timestamptz on every table, soft-delete via `deleted_at` where useful. Tenant columns in **bold**. This schema covers V1→V3; build tables as their phase arrives (see DEVELOPMENT_TASKS.md), but the shape is fixed here so nothing conflicts later.

### Identity & tenancy
- **`organizations`** — `id, name, slug, plan, branding (jsonb), settings (jsonb), sso_enabled, created_at, updated_at`
- **`workspaces`** — `id, organization_id, name, slug, settings (jsonb), created_at, updated_at`
- `users` — `id, email (unique), name, image, locale, created_at, updated_at` (global; users can join many orgs)
- `accounts` / `sessions` / `verifications` — Better Auth tables (OAuth links, sessions, email verification)
- **`memberships`** — `id, user_id, organization_id, workspace_id (nullable), role (enum: owner|admin|member|viewer), created_at`
- `invitations` — `id, organization_id, workspace_id, email, role, token, expires_at, accepted_at`

### Agents
- **`agents`** — `id, organization_id, workspace_id, name, slug, role, goal, personality, status (draft|sandbox|production), default_model, cost_tier (fast|smart|auto), avatar, created_by, created_at, updated_at, deleted_at`
- **`agent_versions`** — `id, agent_id, version_number, system_prompt, config (jsonb: tools, kb_ids, memory, permissions, guardrails), created_by, created_at` (immutable; the live pointer is `agents.active_version_id`)
- **`agent_triggers`** — `id, agent_id, type (manual|schedule|webhook|event), config (jsonb: cron, event name, filter), enabled, created_at`

### Runs (execution history)
- **`agent_runs`** — `id, organization_id, workspace_id, agent_id, agent_version_id, trigger_type, status (queued|running|waiting_approval|paused|succeeded|failed|cancelled), input (jsonb), output (jsonb), cost_usd, tokens_in, tokens_out, started_at, finished_at, inngest_run_id`
- **`run_steps`** — `id, run_id (nullable), workflow_run_id (nullable), index, type (llm|tool|approval|handoff|wait|log), name, input (jsonb), output (jsonb), status, cost_usd, tokens_in, tokens_out, model, started_at, finished_at, error (jsonb)` — exactly one of `run_id` or `workflow_run_id` is set (a CHECK constraint enforces this)
- **`approvals`** — `id, organization_id, workspace_id, run_id, step_id, kind (tool_call|publish|send|custom), payload (jsonb), status (pending|approved|rejected), decided_by, decided_at, created_at`

### Knowledge & memory
- **`knowledge_bases`** — `id, organization_id, workspace_id, name, description, embedding_model, created_at`
- **`documents`** — `id, knowledge_base_id, organization_id, source_type (file|url|crawl|text), source_ref, title, status (pending|processing|ready|failed), bytes, created_at`
- **`document_chunks`** — `id, document_id, organization_id, content (text), embedding (vector(1536)), metadata (jsonb), token_count, created_at` — **HNSW index** on `embedding`. The dimension **1536** matches the default embedding model; if you change the model to a different dimension you must change the column and rebuild the index and re-embed (see BUILD_GUIDE §13). `knowledge_bases.embedding_model` records which model produced a base's vectors so the two never mix.
- **`agent_memories`** — `id, organization_id, workspace_id, agent_id, scope (thread|long_term), thread_id, content, embedding (vector), metadata (jsonb), created_at`

### Connectors & MCP
- **`connectors`** — `id, organization_id, workspace_id, type (slug e.g. 'slack'|'gmail'|'x'|'linkedin'...), name, status (connected|error|disabled), config (jsonb non-secret), created_at`
- **`connector_credentials`** — `id, connector_id, organization_id, encrypted_secret (bytea, libsodium sealed), token_expires_at, created_at` (secrets never stored in plaintext)
- **`mcp_servers`** — `id, organization_id, workspace_id, name, url, transport (http|stdio), auth_type (none|oauth|api_key), status, created_at`
- **`mcp_tools`** — `id, mcp_server_id, organization_id, name, description, input_schema (jsonb), description_hash (for tamper detection), risk_class (read|write|destructive), approval_required (bool), enabled, created_at`

### Workflows
- **`workflows`** — `id, organization_id, workspace_id, name, slug, status (draft|active), graph (jsonb: nodes+edges), active_version_id, created_at, updated_at`
- **`workflow_versions`** — `id, workflow_id, version_number, graph (jsonb), created_by, created_at`
- **`workflow_runs`** — `id, organization_id, workspace_id, workflow_id, status, input, output, cost_usd, started_at, finished_at, inngest_run_id`
- (workflow node steps reuse `run_steps` with a `workflow_run_id` nullable FK)

### Social subsystem
- **`social_accounts`** — `id, organization_id, workspace_id, platform (x|linkedin|instagram|facebook|youtube|tiktok|gbp|wordpress), handle, connector_id, status, created_at`
- **`brand_voices`** — `id, organization_id, workspace_id, name, description, derived_prompt, sample_posts (jsonb), tone (jsonb), created_at`
- **`content_items`** — `id, organization_id, workspace_id, type (post|thread|carousel|reel|blog), title, body, status (idea|draft|approval|scheduled|published|failed), brand_voice_id, created_by_agent_id, scheduled_for, published_at, created_at`
- **`content_variants`** — `id, content_item_id, organization_id, platform, body, media (jsonb), hashtags (jsonb), char_count, status, external_post_id, created_at`
- **`inbox_messages`** — `id, organization_id, workspace_id, social_account_id, platform, kind (comment|dm|mention|review), external_id, author, text, sentiment (jsonb), is_lead (bool), status (new|drafted|replied|escalated|ignored), draft_reply, replied_at, created_at`

### Marketplace & community
- **`templates`** — `id, kind (agent|workflow|brand_voice|prompt), title, slug, description, payload (jsonb sanitized), author_org_id, author_user_id, visibility (private|unlisted|public), price_cents (0=free), install_count, rating_avg, status (draft|published|removed), created_at`
- **`template_installs`** — `id, template_id, organization_id, workspace_id, installed_by, created_at`
- **`template_ratings`** — `id, template_id, organization_id, user_id, stars (1-5), comment, created_at`
- **`profiles`** — `id, subject_type (user|org), subject_id, handle (unique), display_name, bio, avatar, links (jsonb), is_public, created_at`
- **`follows`** — `id, follower_user_id, subject_type, subject_id, created_at`

### AI Controller
- **`controller_sessions`** — `id, organization_id, workspace_id, user_id, status (active|ended), started_at, ended_at`
- **`controller_actions`** — `id, session_id, organization_id, user_id, action_name, args (jsonb), result (jsonb), status (planned|confirmed|executed|failed|undone), required_confirmation (bool), created_at`

### SEO
- **`seo_pages`** — `id, organization_id (nullable for instance pages), path (unique), kind (marketing|blog|template|profile|integration|use_case), title, meta_description, og_image, json_ld (jsonb), canonical, noindex (bool), last_generated_at, created_at`
- **`blog_posts`** — `id, organization_id, workspace_id, title, slug, body_md, excerpt, cover_image, status (draft|scheduled|published), author_user_id, generated_by_agent_id, seo (jsonb: meta, jsonld, keywords), published_at, created_at`

### Billing & usage
- **`subscriptions`** — `id, organization_id, plan (free|pro|team|enterprise), seats, status, lago_subscription_id, stripe_customer_id, current_period_end, created_at`
- **`usage_records`** — `id, organization_id, workspace_id, kind (llm_tokens|task_credit|storage), quantity, cost_usd, model, run_id, recorded_at` (also pushed to Lago as metered events)
- **`credit_wallets`** — `id, organization_id, balance_credits, monthly_grant, resets_at, updated_at`

### Platform & security
- `api_keys` — `id, organization_id, workspace_id, name, hashed_key, scopes (jsonb), last_used_at, created_at`
- **`audit_logs`** — `id, organization_id, workspace_id, actor_type (user|agent|system), actor_id, action, target_type, target_id, metadata (jsonb), ip, created_at` (append-only; export is an `/ee` feature)
- **`settings`** — `id, organization_id (nullable=instance), workspace_id (nullable), key, value (jsonb), updated_by, updated_at`
- `webhook_events` — `id, source, external_id, payload (jsonb), processed (bool), received_at` (idempotency for inbound webhooks)
- `idempotency_keys` — `id, organization_id, key (unique per org), method, path, response (jsonb), status_code, created_at` (backs the `Idempotency-Key` header on mutating endpoints)
- `oauth_states` — `id, organization_id, workspace_id, connector_type, state (unique), code_verifier, redirect_uri, expires_at, created_at` (CSRF/PKCE state for connector OAuth start/callback)
- `notifications` — `id, organization_id, workspace_id, user_id (nullable=workspace-wide), kind (approval|run_failed|escalation|publish_failed|system), title, body, link, channels (jsonb: in_app|email), read_at, created_at` (drives the in-app bell and optional email)
- `feature_flags` — `id, organization_id (nullable), key, enabled, rollout (jsonb), updated_at`

**Indexes that matter:** every tenant column; `document_chunks.embedding` (HNSW, cosine); `agent_runs (organization_id, status, started_at)`; `inbox_messages (workspace_id, status)`; `content_items (workspace_id, scheduled_for)`; `webhook_events (source, external_id)` unique for idempotency.

---

## 7. The agent runtime

An agent is a row in `agents` pointing to an active `agent_versions` row holding the system prompt and a config blob:

```jsonc
// agent_versions.config
{
  "tools": ["mcp:<serverId>:<toolName>", "connector:slack:postMessage", "builtin:web_search"],
  "knowledgeBaseIds": ["<uuid>"],
  "memory": { "type": "thread", "store": "pgvector" },
  "permissions": { "approvalRequiredFor": ["publish", "send", "destructive"] },
  "guardrails": { "piiMask": true, "promptInjectionScan": true, "maxCostUsdPerRun": 0.50 }
}
```

**Execution lifecycle (all inside an Inngest function `agent/run`):**
1. **Resolve** agent + active version; create `agent_runs` row (`queued`→`running`); set RLS tenant context.
2. **Assemble prompt** via `ai-core/PromptAssembler`: system prompt (with cache markers) + memory + retrieved KB chunks (with citations) + tool catalog + user input.
3. **Model call** via `ModelRouter` → LiteLLM. Each call is an Inngest `step` (so it's retried and replayed deterministically). Persist a `run_steps` row.
4. **Tool calls**: if the model requests a tool, check `mcp_tools.approval_required`/risk class. If approval needed → create `approvals` row, set run to `waiting_approval`, `step.waitForEvent('approval/decided')`. Otherwise execute via MCP/connector, persist step, feed result back.
5. **Handoff**: an agent can call `step.invoke('agent/run', { agentId, context })` to delegate to another agent. The handoff graph is recorded as steps.
6. **Loop** until the model returns a final answer, a cost/step limit is hit, or it's cancelled/paused.
7. **Finish**: persist output, totals (cost, tokens), emit `run/finished` over WebSocket, write `audit_logs`, push `usage_records` to Lago.

**Long-running & scheduled:** schedules are Inngest crons created from `agent_triggers`. "Watch and act" agents use `step.waitForEvent` / `step.sleep` and survive restarts for days/weeks. Event triggers come from inbound webhooks → `webhook/received` events → matched against `agent_triggers`.

**Controls:** workspace/instance **kill switch** sets a flag checked at the top of every step (running agents stop at the next step boundary). **Cost limits** (`CostLimitGuard` + per-run `maxCostUsdPerRun`) hard-stop execution. **Sandbox mode** disables destructive tools until an agent is promoted to `production`.

---

## 8. The model gateway and routing

All model traffic goes through **LiteLLM** (self-hosted container, OpenAI-compatible API). The API/worker never call provider SDKs directly.

- **Provider keys**: instance default keys via env; **per-workspace BYO keys** stored encrypted in `connector_credentials` and registered as LiteLLM virtual keys. BYO-key flips token cost to the customer.
- **Cost tiers** (`agents.cost_tier`):
  - `fast` → cheapest capable models (e.g. small/flash/haiku-class) for drafts and high-volume tasks.
  - `smart` → frontier models for hard reasoning.
  - `auto` → route by a complexity/confidence heuristic (input length, tool depth, prior failure) — start cheap, escalate only when needed.
- **Fallback chain**: each tier defines an ordered list; on provider error/timeout, LiteLLM fails over.
- **Prompt caching**: `PromptAssembler` places cache markers around the stable system-prompt prefix and large KB context. Cache reads are dramatically cheaper than fresh input on supported providers, which is the difference between healthy and negative margins at scale. (See research report for measured savings.)
- **Local models**: Ollama is a supported provider for fully offline/self-host deployments.

`ai-core/ModelRouter` exposes one method: `route({ messages, tools, costTier, workspaceId })` → returns a normalized completion plus usage; it records cost into `usage_records` and traces to Langfuse.

---

## 9. Knowledge base and RAG

- **Ingestion** (Inngest function `kb/ingest`): file upload or URL/crawl → parse (Node for common types; FastAPI `unstructured` for complex PDFs) → chunk (token-aware, overlap) → embed (via gateway or worker) → insert `document_chunks` with `embedding`.
- **Retrieval**: cosine similarity over `document_chunks.embedding` (HNSW index), scoped by `knowledge_base_id` and tenant (RLS). Optional hybrid search (pgvector + Postgres full-text `tsvector`) for better recall.
- **Citations**: each retrieved chunk carries `document_id` + `source_ref`; the assembler injects `[n]` markers so answers cite sources, and the UI renders clickable citations.
- **Website crawler**: a bounded crawler (depth/page limits, robots-respecting) feeds the same pipeline.

---

## 10. Connectors framework

A connector is a class implementing a single interface in `packages/connectors`:

```ts
interface Connector {
  type: string;                         // 'slack', 'gmail', 'x', ...
  authKind: 'oauth2' | 'apiKey' | 'none';
  actions: Record<string, ConnectorAction>;  // each with a Zod input/output schema + handler
  triggers?: Record<string, ConnectorTrigger>; // webhook/poll definitions
  riskClass(action: string): 'read' | 'write' | 'destructive';
}
```

- Actions become **tools** an agent can call, and **steps** a workflow can use — one implementation, two consumers.
- OAuth handled centrally (`connector/oauth` routes); tokens sealed into `connector_credentials`.
- `riskClass` drives the approval gate (write/destructive default to requiring approval).
- **V1 connectors**: X/Twitter, LinkedIn, Instagram (Meta), Facebook Pages, Gmail, Slack, Notion, Google Drive, Webhook, HTTP.
- **Later**: Outlook, OneDrive, Teams, GitHub, Jira, WordPress, Xero, Meta Ads, Google Business Profile, CRM, database, browser automation.

Connectors are the extension point the community contributes to most; the contract is intentionally tiny.

---

## 11. MCP integration

Bitecodes is **MCP-native** using the official SDK.

- **Client** (`McpClientManager`): connects to any HTTP-streamable MCP server registered in `mcp_servers`; lists tools into `mcp_tools`; exposes them to agents as tools.
- **Server** (`McpServerHost`, V2): Bitecodes exposes its own connectors/agents as an MCP server so external agents can use Bitecodes.
- **Security (mandatory):**
  - **Signed/hashed tool descriptions**: store `description_hash` on install; if a server changes a tool's description later, flag it and require re-approval (mitigates tool-poisoning).
  - **OAuth Resource Server pattern** for authenticated MCP servers; scoped, short-lived tokens.
  - **Approval gate** for write/destructive tools (`mcp_tools.approval_required`).
  - **Per-tool enable/disable** and risk classification surfaced in the UI.
- **MCP marketplace** (browse/connect): a curated directory in V2; connecting is one click, but every tool still passes the approval and signing checks.

---

## 12. Workflow engine

- **Definition**: a `workflows.graph` JSON of nodes + edges (React Flow shape). Node types: `trigger`, `agent`, `connectorAction`, `condition`, `approval`, `delay`, `loop`, `branch`, `errorHandler`, `escalation`, `transform`, `httpRequest`.
- **Compilation**: the graph compiles to an Inngest function. Each node = a step; edges define control flow; conditions/branches use `step.run` returns; loops use bounded iteration; approvals/delays use `waitForEvent`/`sleep`.
- **Visual builder** (`apps/web`, React Flow): drag nodes, connect, configure each node's params in a side panel, validate (no cycles except explicit loops, all required params set), save → creates a `workflow_versions` row.
- **Testing mode**: run with sample input against sandbox connectors; full step trace and replay.
- **Why not visual-only:** complex agent logic outgrows a canvas, so Bitecodes leads with templates + natural-language configuration and uses the canvas for orchestration, not for expressing every branch by hand.

---

## 13. The social media subsystem

This is the flagship and the wedge. It is "just" a set of agents, connectors, and a tailored UI on top of the core — which is exactly why it stays maintainable.

- **Connect** social accounts via OAuth → `social_accounts`.
- **Brand voice**: paste/import past posts → an agent derives a `brand_voices.derived_prompt` + tone profile. Reused by every content agent.
- **Content generation**: a content agent produces a `content_items` row plus per-platform `content_variants` (length/style adapted per network, hashtags, suggested media).
- **Calendar & kanban**: `content_items` rendered as a calendar (by `scheduled_for`) and a kanban (by `status`). Drag to reschedule.
- **Approval → publish**: scheduled items hit an approval gate (configurable: manual, one-click-all, or auto). Inngest cron publishes via the platform connector at `scheduled_for`; result and `external_post_id` stored.
- **Unified inbox**: connectors poll/stream comments, DMs, mentions, reviews into `inbox_messages`. A reply agent drafts responses in brand voice; sentiment + lead detection tag each message; complaints/negative sentiment can auto-escalate to a human. Approve → connector sends.
- **Repurpose**: one source (blog/podcast/video transcript) → an agent fans out to N posts + a newsletter + clip briefs.
- **Listening & crisis alerts** (V2): keyword/brand monitoring with sentiment thresholds firing alerts.

---

## 14. The AI Controller (the wow feature)

> "Say it, and the app does it." Talk or type, and Bitecodes navigates pages, fills forms, creates and runs agents, schedules posts, replies to customers, changes settings — across the entire product, with a live trace and confirmation for anything destructive.

This is **not** pixel-based "computer use." It is a **structured action layer**, which is far more reliable and effectively eliminates a whole class of hallucination: the AI can only invoke actions that actually exist, with arguments validated by Zod.

### Components
1. **Action Registry** (`packages/ai-controller`): a typed catalog of every operation the app can perform. Each action has:
   - a unique `name` (e.g. `navigate`, `agent.create`, `agent.run`, `content.generateWeek`, `inbox.reply`, `settings.open`, `billing.open`, `table.filter`, `blog.generateAndPublish`, `connector.start`);
   - a **Zod schema** for arguments;
   - a `riskClass` (`safe` | `confirm` | `destructive`);
   - a **handler** that runs either in the browser (navigation/UI) or on the server (mutations), or both.
2. **The Controller agent** (server, Inngest): a normal Bitecodes agent whose **tools are the Action Registry**. The user's natural-language command is the input. The agent plans and emits a sequence of action calls.
3. **The Command Bus** (`apps/web`): a browser-side dispatcher subscribed over Socket.IO. It receives action calls, validates args against the same Zod schema, and:
   - executes UI actions immediately (Next.js router navigation, opening panels, filling React Hook Form fields, applying table filters);
   - for `confirm`/`destructive` actions, renders an inline confirmation card and waits for the user;
   - reports each result back so the agent can decide the next step.
4. **Live trace & undo**: every dispatched action is written to `controller_actions` and shown in a trace panel ("Navigated to Content → Drafted 7 posts → Awaiting your approval"). Reversible actions offer **Undo**; destructive ones always require explicit confirmation.
5. **Voice**: optional Web Speech API for spoken commands; falls back to text.

### Why this is safe and non-hallucinatory
- The agent's action space is a **closed set** defined in code. It cannot invent a route or a mutation that doesn't exist.
- Arguments are **schema-validated twice** (server emit + browser dispatch).
- **RBAC and tenant context apply**: the Controller can only do what the current user is allowed to do.
- **Confirmation gates** stop irreversible actions from happening without consent.
- Full **audit trail** in `controller_actions` + `audit_logs`.

### Example end-to-end
User says: *"Draft next week's LinkedIn posts in my brand voice, reply to the angry Instagram comment, then take me to billing."*
1. Controller agent calls `content.generateWeek({ platform: 'linkedin', brandVoiceId })` → server runs the content agent → 7 drafts created → Command Bus navigates to the calendar and highlights them.
2. Calls `inbox.findNegative({ platform: 'instagram' })` → returns the message → calls `inbox.reply({ messageId, draft })` (risk `confirm`) → browser shows the draft for approval.
3. Calls `navigate({ to: '/settings/billing' })` (risk `safe`) → router navigates.
The trace panel shows all three steps; the reply waited for confirmation.

---

## 15. The SEO engine

SEO is a first-class subsystem so that "auto-SEO on launch" is real, not a checkbox.

- **Rendering**: every public page is server-rendered or statically generated by Next.js — fast first paint, fully crawlable. Core Web Vitals optimized via `next/image`, font optimization, and edge caching.
- **Metadata**: Next.js `generateMetadata` produces titles, descriptions, canonical URLs, Open Graph, and Twitter cards per page. For blog/marketplace/profile pages, **AI generates** the meta on publish (stored in `blog_posts.seo` / `seo_pages`) and a human can override.
- **Structured data (JSON-LD)** via `packages/seo` typed builders (`schema-dts`): `Organization` + `WebSite` site-wide; `Article`/`BlogPosting` on posts; `SoftwareApplication` on product pages; `BreadcrumbList`, `FAQPage`, `Product`/`Offer` on marketplace items; `ProfilePage` on public profiles.
- **Sitemaps & robots**: `next-sitemap` generates `sitemap.xml` (split by section) and `robots.txt` at build and on a schedule as content grows; new public entities are added automatically.
- **Programmatic SEO**: auto-generate indexed landing pages for **each integration** ("Bitecodes + Slack"), **each template**, and **each use case** — a large, compounding long-tail surface, generated from data with AI-written copy and unique structured data.
- **Auto internal linking**: a job links related blog posts, integrations, and templates to spread link equity.
- **Image alt text**: AI-generated for uploaded media.
- **i18n SEO**: `next-intl` + `hreflang` tags for localized pages.
- **Admin SEO controls**: per-page noindex toggle, canonical override, meta editor with an "AI rewrite" button, and a sitemap/health view.

---

## 16. The admin subsystem

Two scopes:

- **Workspace/Org admin** (`(admin)` routes): users & roles, invitations, connectors & MCP servers, model controls (which models are allowed, cost tiers, BYO keys), cost & usage limits, kill switch, branding/white-label, billing, audit log view, SEO controls, **AI blog publishing**, **AI inbox replies**.
- **Super-admin** (instance-level, env-gated by `SUPERADMIN_EMAILS`): tenant management, license key, global feature flags, instance kill switch, health.

**AI-first admin rules:** every admin creation form (blog post, reply, agent, workflow, connector description, SEO meta) has an **"AI fill"** action; every list/inbox supports **bulk AI actions** (e.g. "draft replies to all new messages"); auto-modes exist for blog scheduling, reply sending, and SEO generation. **Every one of these is toggleable** — manual is always available and nothing AI is compulsory.

---

## 17. Billing and metering

- **Lago** (self-host) is the metering/billing engine; **Stripe** is the payment collector on managed cloud.
- **Plans**: free / pro / team / enterprise (see README + Word plan for prices). Seats + included **task credits** + overage.
- **Metering**: every `usage_records` row (LLM tokens, task credits, storage) is pushed to Lago as a metered event. `credit_wallets` track included monthly credits with spending caps **on by default** to prevent bill shock.
- **BYO-key**: when a workspace uses its own provider keys, token cost bypasses our billing; we charge a thin platform fee.
- **Self-host**: billing is optional; the open core runs without Lago/Stripe.

---

## 18. Security model

- **Tenant isolation**: Postgres RLS (`FORCE`) on every tenant table; GUCs set per request transaction (section 5).
- **Secrets**: provider keys and connector tokens sealed with libsodium (`crypto_secretbox`) using `ENCRYPTION_KEY`; never logged, never returned to the client. Enterprise can plug external Vault/Doppler.
- **AuthN**: Better Auth (email + OAuth); **SSO (SAML/OIDC) + SCIM** is an `/ee` feature.
- **AuthZ**: role-based (`owner|admin|member|viewer`) in core; **custom roles + tool-scope permissions** in `/ee`. Agent permissions are intersected with the caller's permissions — an agent can never exceed its owner's rights.
- **Prompt injection**: external/ingested content passes a guardrail (lightweight classifier) before reaching the model; suspicious tool descriptions are flagged via description hashing.
- **PII masking**: optional detector strips emails/phones/IDs before sending to non-trusted models.
- **Rate & cost limits**: per-workspace daily/monthly token + USD caps with hard stops; per-run cost ceilings.
- **Kill switch**: instance (env) and workspace (UI) — halts all running agents at the next step boundary.
- **MCP**: signed tool descriptions, scoped OAuth, approval gates (section 11).
- **Audit**: append-only `audit_logs` for every sensitive action (auth, connector changes, publishes, sends, role changes, controller actions). Export/SIEM forwarding is `/ee`.
- **Inbound webhooks**: idempotent via `webhook_events (source, external_id)` unique constraint; signature verification per provider.

---

## 19. Configuration and white-label

- **Two-source config** (env vs DB) with the precedence rule from the README (UI wins except security-critical = env-only).
- **Branding**: `organizations.branding` JSON drives CSS variables (logo, favicon, primary/accent colors). Custom domains via a reverse proxy (Caddy/Traefik). "Powered by Bitecodes" footer is removable only on paid tiers (kept in OSS for distribution).
- **Feature flags**: `feature_flags` table + env overrides gate experimental features per org.
- **Everything an operator touches** (default model, allowed connectors, prompt templates, approval policy, SEO defaults) is editable in the admin UI and stored in `settings`.

---

## 20. Observability

- **LLM traces**: Langfuse captures every model call, prompt, tokens, cost, and latency, linked to `agent_runs`/`run_steps`.
- **App telemetry**: OpenTelemetry traces/metrics/logs → Grafana + Loki + Tempo (self-host) or any OTLP backend.
- **Product analytics surfaced in-app**: per-agent success/failure rate, cost per task, response time, most-used agents/tools/models, human-intervention rate, time-saved and cost-saved estimates, ROI dashboards.
- **Health**: `/health` (liveness) and `/ready` (DB/Redis/gateway checks) on the API.

---

## 21. Deployment topology

- **Local / "single Docker"**: `docker compose up` runs web, api, worker, Postgres(+pgvector), Redis, MinIO, Inngest dev server, LiteLLM. One command, one machine.
- **Managed cloud (MVP)**: Fly.io or Hetzner + Coolify. Postgres managed (Neon/Supabase/RDS) with pgvector; Redis managed (Upstash); blobs on Cloudflare R2/S3; Inngest Cloud or self-hosted; LiteLLM as a service. Caddy/Traefik for TLS + custom domains.
- **Scale-out (V2+)**: multiple stateless API/worker replicas behind a load balancer; Postgres read replicas; move long-tail run history/analytics to ClickHouse; Inngest concurrency tuned (swap to Temporal only if state-transition volume demands it).
- **Enterprise (V3)**: single-tenant VPC / on-prem via Helm chart; bring-your-own object store, Vault, and IdP.

---

## 22. What breaks at scale and how we prevent it

| Failure mode | Prevention (built in from day one) |
|---|---|
| Synchronous LLM calls in HTTP handlers time out and blow budgets | All model/tool work runs inside Inngest steps; controllers only enqueue |
| A query missing `organization_id` leaks cross-tenant data | RLS `FORCE` on every tenant table; GUC set per request; tested with a tenant-isolation test suite |
| Token costs destroy margins | Prompt caching markers on stable prefixes; cheap-model `auto` routing; BYO-key default on paid tiers; per-run cost ceilings |
| MCP tool poisoning / prompt injection | Signed tool descriptions + change alerts; approval gates for write/destructive; injection guardrail on ingested content |
| One Postgres for everything contends | Redis caching; read replicas; ClickHouse for analytics/run history at V2; HNSW index tuning for vectors |
| Durable engine hits a ceiling | Agent executor sits behind an interface; Inngest → Temporal swap is isolated to one package |
| Webhook duplicates double-trigger agents | Idempotency via unique `(source, external_id)` on `webhook_events` |
| Long agent memory grows unbounded | Memory summarization + TTL on `agent_memories`; vector index maintenance jobs |

---

## 23. API surface conventions

- **REST** under `/v1/*`, resource-oriented, tenant inferred from session + active workspace header `x-bitecodes-workspace`.
- **WebSocket** — a single gateway hosts three namespaces: `/runs` (run/step events), `/controller` (AI Controller actions + trace), `/inbox` (live messages). Clients join room `ws:<workspaceId>` so events never cross tenants. See BUILD_GUIDE §8 for the exact event names.
- **Naming:** Inngest events are slash-namespaced (`agent/run`); AI Controller actions are dot-namespaced (`agent.run`). They are different surfaces — never interchange the separators. Canonical lists live in BUILD_GUIDE §6 (events) and §7 (routes).
- **Webhooks ingress** under `/hooks/:source` with signature verification and idempotency.
- **OpenAPI** auto-generated by NestJS Swagger at `/docs`; `packages/shared` Zod schemas are the source of truth and are mirrored into OpenAPI.
- **Errors** use a consistent envelope `{ error: { code, message, details } }`; never leak secrets or other tenants' data.
- **Idempotency-Key** header supported on all mutating endpoints.

---

*End of ARCHITECTURE.md. Build order and atomic tasks are in DEVELOPMENT_TASKS.md; code-context and rationale are in Bitecodes_Development_Plan.docx.*
