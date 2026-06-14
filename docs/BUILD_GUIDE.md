# Bitecodes — Build Guide (The Anti-Hallucination Handbook)

This is the handbook for whoever builds Bitecodes, whether a human team or an AI coding agent. Its job is to make the build **fast, consistent, and hallucination-free** by giving every canonical name in one place. If a name is not here or in `ARCHITECTURE.md`, it does not exist yet — and you must add it to the canonical list (a one-line change here) **before** you use it in code.

Read this file first. Then read `ARCHITECTURE.md`. Then work through `DEVELOPMENT_TASKS.md` top to bottom.

---

## 0. The golden rules

1. **Never invent a name.** Tables, columns, Inngest events, REST routes, WebSocket namespaces, environment variables, package names, and shared types must already appear in this guide or in `ARCHITECTURE.md`. If you need a new one, add it here in the same PR, then use it.
2. **Never invent a dependency.** Use only the libraries pinned in `ARCHITECTURE.md` §3. No "latest." No package you have not seen in a manifest. If a task seems to need a new library, stop and flag it.
3. **`ARCHITECTURE.md` is canonical.** On any conflict between documents, it wins. This guide is canonical for the catalogs it owns (events, routes, env vars, state machines, conventions, glossary).
4. **One task, one pull request, where possible.** Each task in `DEVELOPMENT_TASKS.md` has an ID, file paths, and an acceptance criterion. Do exactly that task. Do not scope-creep.
5. **Validate every type at the boundary.** Every request body, every external payload, and every tool argument is parsed with a Zod schema from `packages/shared` before use.
6. **Tenant context is mandatory.** Every tenant-scoped query runs inside a request transaction that has set `app.current_org` (and `app.current_workspace` where relevant). Never bypass it.
7. **No model or tool call in an HTTP handler.** Controllers enqueue Inngest events and return. All model and tool work happens inside durable steps.
8. **When unsure, stop and re-read the canonical source. Do not guess.** A wrong guess that compiles is worse than a question.

---

## 1. How to use the document set

| Document | When you read it | Authority |
|---|---|---|
| **BUILD_GUIDE.md** (this file) | First, and whenever you need a canonical name | Canonical for catalogs, conventions, glossary |
| **ARCHITECTURE.md** | Second, for how each subsystem works and the full schema | Canonical overall (wins on conflict) |
| **DEVELOPMENT_TASKS.md** | While building, top to bottom | The ordered, atomic plan |
| **README.md** | For orientation, quick start, and configuration | Onboarding |
| **Bitecodes_Development_Plan.docx** | For prose context and code examples per layer | Narrative reference |

**Definition of done (applies to every task):** the acceptance criterion is met; `pnpm lint && pnpm typecheck && pnpm test` pass; no new dependency outside §3; all new names were added to the canonical catalogs; tenant isolation holds; and any new endpoint, event, or type was added to the relevant catalog in this file.

---

## 2. Glossary (use these exact terms)

| Term | Meaning |
|---|---|
| **Instance** | One running deployment of Bitecodes. |
| **Organization** | The top-level tenant — a company. Owns branding, plan, settings, SSO. |
| **Workspace** | A sub-tenant inside an organization (for example, one client of an agency). |
| **User** | A person; may belong to many organizations and workspaces. |
| **Membership** | The join of a user to an organization or workspace, carrying a role. |
| **Role** | One of exactly four core roles: `owner`, `admin`, `member`, `viewer`. Custom roles are an enterprise feature. |
| **Agent** | A configured AI worker: role, goal, prompt, model, tools, memory, permissions. |
| **Agent version** | An immutable snapshot of an agent's prompt and configuration. |
| **Run** | One execution of an agent (`agent_runs`). |
| **Step** | One unit within a run (`run_steps`): a model call, tool call, handoff, wait, or log. |
| **Approval** | A paused run awaiting a human decision. |
| **Connector** | A typed adapter to an external service, exposing actions and triggers. |
| **MCP server** | An external Model Context Protocol server providing tools. |
| **Tool** | An action an agent can call: a connector action, an MCP tool, or a built-in. |
| **Knowledge base** | A collection of documents for retrieval. |
| **Brand voice** | A learned writing style derived from sample posts. |
| **Content item** | A planned or published piece of content; has per-network **content variants**. |
| **Inbox message** | An incoming comment, direct message, mention, or review. |
| **Workflow** | A graph of nodes compiled into a durable function. |
| **AI Controller** | The natural-language layer that drives the app via a closed **action registry**. |
| **Controller action** | One registered, schema-validated operation the Controller may perform. |
| **Template** | A shareable agent, workflow, brand voice, or prompt in the marketplace. |
| **Cost tier** | `fast`, `smart`, or `auto` — how a model is chosen for a run. |
| **Task credit** | The billing unit. See §9 for the conversion rule. |

---

## 3. Naming and namespacing conventions

These conventions are mandatory and are the main defense against drift.

- **Database tables:** `snake_case`, plural (`agent_runs`, `content_items`). Columns `snake_case`. Primary key `id` (uuid). Tenant columns `organization_id`, `workspace_id`.
- **TypeScript types and Zod schemas:** `PascalCase`; schema is the type name plus `Schema` (`AgentInput` / `AgentInputSchema`). Defined once in `packages/shared`.
- **Inngest events:** slash-namespaced, `domain/action` (`agent/run`, `content/generate`, `kb/ingest`). See the catalog in §6.
- **Controller actions:** dot-namespaced, `domain.action` (`agent.run`, `content.generateWeek`, `inbox.reply`). See `ARCHITECTURE.md` §14 and the registry. **Events use slashes; actions use dots. Do not mix them.**
- **REST routes:** versioned under `/v1`, resource-oriented, kebab-case plural resources (`/v1/agents`, `/v1/knowledge-bases`). See the catalog in §7.
- **WebSocket namespaces:** `/runs`, `/controller`, `/inbox`, and `/company` (the unified company-chat / inter-agent timeline, added in Phase G). One gateway class may host each. Clients join a room named `ws:<workspaceId>` so events never cross tenants; the server verifies the Better Auth session + workspace membership before honouring a join. See §8.
- **Webhook ingress:** `/hooks/:source`.
- **Workspace header:** the active workspace is sent as `x-bitecodes-workspace`. (This is the one canonical header name; do not use `x-workspace-id`.)
- **Idempotency:** mutating endpoints accept an `Idempotency-Key` header; the value is stored in `idempotency_keys`.
- **Packages:** imported as `@bitecodes/<name>` (`@bitecodes/shared`, `@bitecodes/db`, `@bitecodes/ai-core`, `@bitecodes/connectors`, `@bitecodes/mcp`, `@bitecodes/ai-controller`, `@bitecodes/seo`, `@bitecodes/ui`).
- **Files:** React components `PascalCase.tsx`; hooks `useThing.ts`; NestJS files `thing.controller.ts`, `thing.service.ts`, `thing.module.ts`; Inngest functions `domain.action.ts` under `apps/api/src/inngest/`.

---

## 4. Canonical port map

Use these ports everywhere (compose, docs, env defaults). They are chosen so nothing collides on one machine.

| Service | Port | URL |
|---|---|---|
| Web (Next.js) | 3000 | http://localhost:3000 |
| API (NestJS) + Swagger | 4000 | http://localhost:4000 (docs at /docs) |
| LiteLLM gateway | 4001 | http://localhost:4001 |
| Inngest dev server | 8288 | http://localhost:8288 |
| PostgreSQL | 5432 | — |
| Redis | 6379 | — |
| MinIO (S3 API / console) | 9000 / 9001 | http://localhost:9001 (console) |
| Langfuse (optional, self-host) | 3001 | http://localhost:3001 |

---

## 4b. Starting the stack — pick ONE AI path

The whole product runs on a single AI provider. Choose one of two zero-juggling setups, then validate with `pnpm setup:check` before starting.

**Common setup (both paths)**
```bash
cp .env.example .env          # then set POSTGRES_PASSWORD, AUTH_SECRET, ENCRYPTION_KEY
docker compose up postgres redis -d   # Postgres required; Redis recommended
pnpm --filter @bitecodes/db db:push   # apply schema
psql "$DATABASE_SUPERUSER_URL" -f packages/db/scripts/setup-rls.sql   # RLS + app role
```

**Path A — OpenRouter (cloud, one key; no LiteLLM/Docker AI service needed)**
```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
DEFAULT_MODEL=anthropic/claude-3.5-sonnet
EMBEDDING_PROVIDER=ollama     # OpenRouter doesn't serve embeddings; use ollama or none
```

**Path B — Ollama (fully local, no key)**
```bash
ollama serve
ollama pull llama3.1 && ollama pull nomic-embed-text
```
```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_MODEL=llama3.1
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text
```

**Validate + run**
```bash
pnpm setup:check                       # checks env, DB, Redis, provider; prints fixes
pnpm --filter @bitecodes/api dev       # :4000 (Swagger at /docs)
pnpm --filter @bitecodes/web dev       # :3002
```
For CI / offline development set `AI_GATEWAY_MODE=mock` — every AI call returns a deterministic stub and no provider/key is required (this is how the E2E suite runs).

---

## 5. Complete environment variable reference

Every variable the system reads at boot. Security-critical variables (marked **env-only**) can never be overridden from the UI. At minimum, set the three marked **required** plus one model provider key to boot the infrastructure.

### Core
| Variable | Purpose | Notes |
|---|---|---|
| `NODE_ENV` | `development` or `production` | |
| `APP_URL` | Public base URL of the web app | e.g. http://localhost:3000 |
| `API_URL` | Base URL of the API | e.g. http://localhost:4000 |
| _(no API URL for the browser)_ | The web app calls same-origin relative paths; the combined `app` image proxies `/v1`, `/api/auth`, `/socket.io` to the co-located API at `localhost:4000` | nothing to set per environment |
| `NEXT_PUBLIC_APP_URL` | Browser-visible app URL | exposed to the client |
| `NEXT_PUBLIC_BRAND_NAME` | White-label product/wordmark name | exposed to the client; default `Bitecodes` |
| `NEXT_PUBLIC_BRAND_PRIMARY_HSL` | Brand primary colour as bare HSL channels (`H S% L%`) | exposed to the client; default `221 83% 53%` |
| `NEXT_PUBLIC_DEFAULT_THEME` | Initial `next-themes` theme (`light` \| `dark` \| `system`) | exposed to the client; default `light` |
| `DATABASE_URL` | PostgreSQL connection string | **required** |
| `REDIS_URL` | Redis connection string | **required** |
| `AUTH_SECRET` | Session signing secret | **required**, **env-only** |
| `AUTH_URL` | Auth base URL | usually equals `API_URL` |
| `ENCRYPTION_KEY` | 32-byte base64 key for the secret vault (libsodium) | **env-only** |
| `SUPERADMIN_EMAILS` | Comma-separated instance super-admins | **env-only** |
| `ALLOWED_DOMAINS` | Domains permitted for the instance | |
| `LICENSE_KEY` | Enables `/ee` features | optional |

### Object storage (S3-compatible)
| Variable | Purpose |
|---|---|
| `S3_ENDPOINT` | Endpoint URL (MinIO or R2/S3) |
| `S3_REGION` | Region (e.g. `auto` for R2) |
| `S3_BUCKET` | Bucket name |
| `S3_ACCESS_KEY_ID` | Access key |
| `S3_SECRET_ACCESS_KEY` | Secret key (**env-only**) |
| `S3_PUBLIC_URL` | Optional public base URL for assets |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | MinIO container credentials (self-host) |

### AI provider gateway
Bitecodes runs on **one** provider selected by `AI_PROVIDER`. All AI traffic — agent runs, content, the Controller, and embeddings — flows through `ModelRouter` (`packages/ai-core`). No code calls a provider SDK directly.

| Variable | Purpose |
|---|---|
| `AI_PROVIDER` | Active provider: `openrouter` \| `ollama` \| `litellm` (default `openrouter`) |
| `DEFAULT_MODEL` | Chat model passed verbatim to the provider when no per-agent override is set (e.g. `anthropic/claude-3.5-sonnet` for OpenRouter, `llama3.1` for Ollama) |
| `AI_GATEWAY_MODE` | `mock` (deterministic stubs for CI/E2E, no key/network) or `live` (default) |
| `OPENROUTER_API_KEY` | OpenRouter key — **required** when `AI_PROVIDER=openrouter` |
| `OPENROUTER_BASE_URL` | OpenRouter API base (default `https://openrouter.ai/api/v1`) |
| `OLLAMA_BASE_URL` | Local Ollama base (default `http://localhost:11434`) — no key needed |
| `LITELLM_BASE_URL` | LiteLLM gateway URL (optional path, e.g. http://localhost:4001) |
| `LITELLM_MASTER_KEY` | LiteLLM master key (**env-only**, optional path) |
| `EMBEDDING_PROVIDER` | Embedding backend: `ollama` \| `openrouter` \| `none` (default `ollama`). `none` disables retrieval features without crashing |
| `EMBEDDING_MODEL` | Embedding model (default `nomic-embed-text` for ollama) |
| `OPENAI_API_KEY` | OpenAI key (optional — only used in the `litellm` path) |
| `ANTHROPIC_API_KEY` | Anthropic key (optional — only used in the `litellm` path) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google (Gemini) key (optional — only used in the `litellm` path) |

### Durable engine
| Variable | Purpose |
|---|---|
| `INNGEST_EVENT_KEY` | Event ingest key |
| `INNGEST_SIGNING_KEY` | Function signing key (**env-only**) |
| `INNGEST_DEV` | `1` to use the local dev server |

### Auth providers (OAuth)
| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in (and Drive) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub sign-in |

### Social and tool connectors (OAuth apps)
| Variable | Purpose |
|---|---|
| `X_CLIENT_ID` / `X_CLIENT_SECRET` | X (Twitter) |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn |
| `META_APP_ID` / `META_APP_SECRET` | Instagram + Facebook Pages |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` | Slack |
| `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` | Notion |

### Email, billing, observability, webhooks
| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Transactional email (**env-only**) |
| `EMAIL_FROM` | Default sender address |
| `APPROVAL_LINK_SECRET` | HMAC secret for signed email approve/reject links (**env-only**) |
| `APPROVAL_LINK_TTL_HOURS` | Validity window of an email approval link (default `72`) |
| `ORCHESTRATION_AUTODISPATCH_THRESHOLD` | Routing confidence ≥ this auto-dispatches (else proposes for confirmation); default `0.85` |
| `COMPANY_CHAT_MAX_HANDOFF_DEPTH` | Max recursive agent→agent handoff depth in a conversation; default `5` |
| `MEMORY_RETENTION_DAYS` | Thread-memory retention before consolidation/expiry; default `90` |
| `MEMORY_LONGTERM_TOPK` | How many long-term memories to inject into a prompt; default `5` |
| `CONVERSATION_WINDOW_MESSAGES` | Recent conversation turns kept in the working window; default `20` |
| `STRIPE_SECRET_KEY` | Stripe payments (**env-only**) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature (**env-only**) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe client key |
| `LAGO_API_URL` / `LAGO_API_KEY` | Metering/billing engine (key **env-only**) |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_HOST` | LLM tracing (secret **env-only**) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Optional OpenTelemetry collector |
| `WEBHOOK_SIGNING_SECRET` | Signs/validates inbound webhooks (**env-only**) |

> `.env.example` must contain every variable above, grouped and commented, with safe placeholder values. Self-host runs without Stripe, Lago, Langfuse, and the connector OAuth keys; those features simply stay inactive until configured.

---

## 6. Inngest event catalog (canonical)

These are the only event names. Add new ones here before emitting them. Payloads are the `data` object.

| Event | Emitted when | Payload |
|---|---|---|
| `agent/run` | An agent run is requested | `{ runId, organizationId, workspaceId }` |
| `run/finished` | A run completes (any terminal state) | `{ runId, status }` |
| `run/resumed` | A paused run is resumed by the user | `{ runId }` |
| `run/cancelled` | A run is cancelled by the user | `{ runId }` |
| `approval/decided` | A human approves or rejects | `{ runId, approvalId, decision }` |
| `workflow/run` | A workflow run is requested | `{ workflowRunId, organizationId, workspaceId, input }` |
| `content/generate` | Content generation is requested | `{ workspaceId, scope, platform?, brandVoiceId?, sourceUrl? }` where `scope` is `single` or `week` |
| `content/publish` | A scheduled content variant is due | `{ contentVariantId }` |
| `kb/ingest` | A document needs processing | `{ documentId, organizationId, workspaceId }` |
| `inbox/ingest` | Poll a social account for new messages | `{ socialAccountId, organizationId, workspaceId }` |
| `webhook/received` | An inbound webhook is verified and stored | `{ source, eventId, externalId, payload }` |
| `content/publish` | A scheduled content variant is due | `{ contentVariantId, organizationId, workspaceId }` |
| `controller/dispatch` | The Controller agent should plan a command | `{ sessionId, command }` |
| `billing/usage.recorded` | A usage record is written | `{ usageRecordId }` |
| `seo/generate` | A page or post needs SEO metadata | `{ kind, id }` where `kind` is `seo_page` or `blog_post` |
| `employee/input.provided` | A human answers a plan-mode / ask-user pause | `{ runId, input }` |
| `orchestration/route` | A request must be routed to the right employee | `{ routingDecisionId, organizationId, workspaceId }` |
| `orchestration/decided` | A routing decision is confirmed/diverted by a human | `{ routingDecisionId, agentId }` |
| `agent/handoff` | One employee hands work to another | `{ parentRunId, fromAgentId, toAgentId, organizationId, workspaceId }` |
| `company/message.posted` | A message is posted to the company timeline | `{ conversationId, messageId, organizationId, workspaceId }` |
| `company/handoff.requested` | An employee requests a handoff in a conversation | `{ conversationId, fromAgentId, toAgentId, depth }` |
| `company/message.learned` | A message is promoted to durable memory | `{ messageId, agentId }` |
| `memory/consolidate` | Periodic memory curation: dedup + promote to long_term | `{ organizationId, workspaceId }` |
| `onboarding/completed` | The onboarding checklist is fully completed | `{ organizationId, workspaceId }` |

Scheduled triggers (`agent_triggers` of type `schedule`) are fired by a single internal scheduler cron function (`scheduler/tick`, no event of its own) that scans due triggers, enforces per-agent daily run/cost caps, and emits `agent/run`. (Per B4: no `employee/scheduled-tick` event is added.)

---

## 7. REST API route catalog (canonical)

All routes are under `/v1`, require the guard chain, and infer the tenant from the session plus the `x-bitecodes-workspace` header. Bodies validate against `packages/shared` schemas. This is the canonical surface; add a route here before implementing it.

| Domain | Routes |
|---|---|
| Auth | Handled by Better Auth under `/api/auth/*` |
| Organizations | `POST /v1/orgs` · `GET /v1/orgs` · `GET /v1/orgs/:id` · `PATCH /v1/orgs/:id` |
| Workspaces | `POST /v1/workspaces` · `GET /v1/workspaces` · `PATCH /v1/workspaces/:id` |
| Session | `GET /v1/me` (current user, org, workspace, role, workspaces[]) |
| Members | `POST /v1/invitations` · `GET /v1/invitations` · `POST /v1/invitations/:token/accept` · `GET /v1/members` · `PATCH /v1/members/:id/role` · `DELETE /v1/members/:id` (soft-delete via `memberships.deactivated_at`) |
| Agents | `POST /v1/agents` · `POST /v1/agents/hire` (provision an employee from a role template) · `GET /v1/agents` · `GET /v1/agents/:id` · `PATCH /v1/agents/:id` · `DELETE /v1/agents/:id` · `GET /v1/agents/:id/versions` · `POST /v1/agents/:id/versions` · `POST /v1/agents/:id/activate/:versionId` |
| Employee controls | `GET /v1/agents/:id/controls` · `PATCH /v1/agents/:id/controls` · `POST /v1/agents/:id/controls/activate` · `POST /v1/agents/:id/controls/deactivate` (distinct from `:id/activate/:versionId`, which is version activation) |
| Agent triggers | `GET /v1/agents/:id/triggers` · `POST /v1/agents/:id/triggers` · `PATCH /v1/agents/:id/triggers/:triggerId` · `DELETE /v1/agents/:id/triggers/:triggerId` |
| Agent relationships | `GET /v1/agent-relationships` · `POST /v1/agent-relationships` · `DELETE /v1/agent-relationships/:id` (kinds: `supervises` \| `watches` \| `delegates_to`) |
| Orchestration | `POST /v1/orchestration/route` (classify a request → proposed routing decision) · `GET /v1/orchestration/decisions` · `POST /v1/orchestration/decisions/:id/confirm` (confirm/divert → emits `agent/run`) |
| Company chat | `GET /v1/conversations` · `POST /v1/conversations` · `GET /v1/conversations/:id` · `GET /v1/conversations/:id/messages` · `POST /v1/conversations/:id/messages` · `GET /v1/agent-handoffs` (inter-agent bus timeline) |
| Memory | `GET /v1/agents/:id/memories` · `DELETE /v1/agents/:id/memories/:memoryId` (agent_memories cols `kind`, `visibility`, `source_run_id`, `salience`) |
| Onboarding | `GET /v1/onboarding` (server-owned checklist state) · `POST /v1/onboarding/advance` (mark a step complete) — table `onboarding_states` |
| Runs | `POST /v1/agents/:id/runs` · `GET /v1/runs` · `GET /v1/runs/:id` · `POST /v1/runs/:id/pause` · `POST /v1/runs/:id/resume` · `POST /v1/runs/:id/cancel` · `POST /v1/runs/:id/replay` · `POST /v1/runs/:id/respond` (answer a plan-mode/ask-user pause) |
| Approvals | `GET /v1/approvals` · `POST /v1/approvals/:id/decide` · `GET /v1/approvals/:id/email-decision` (public, HMAC-signed approve/reject link) |
| Knowledge | `POST /v1/knowledge-bases` · `GET /v1/knowledge-bases` · `POST /v1/knowledge-bases/:id/documents` · `POST /v1/knowledge-bases/:id/urls` · `GET /v1/knowledge-bases/:id/documents` · `POST /v1/documents/:id/reindex` |
| Connectors | `GET /v1/connectors` · `POST /v1/connectors/:type/oauth/start` · `GET /v1/connectors/:type/oauth/callback` · `PATCH /v1/connectors/:id` · `DELETE /v1/connectors/:id` |
| MCP | `POST /v1/mcp-servers` · `GET /v1/mcp-servers` · `GET /v1/mcp-servers/:id/tools` · `PATCH /v1/mcp-tools/:id` |
| Workflows | `POST /v1/workflows` · `GET /v1/workflows` · `GET /v1/workflows/:id` · `PATCH /v1/workflows/:id` · `POST /v1/workflows/:id/run` · `GET /v1/workflow-runs` |
| Social | `GET /v1/social-accounts` · `POST /v1/brand-voices` · `GET /v1/brand-voices` · `POST /v1/content-items` · `GET /v1/content-items` · `PATCH /v1/content-items/:id` · `POST /v1/content/generate-week` · `POST /v1/content-items/:id/approve` |
| Inbox | `GET /v1/inbox` · `POST /v1/inbox/:id/reply` · `POST /v1/inbox/draft-all` |
| Controller | `POST /v1/controller/sessions` · `POST /v1/controller/sessions/:id/command` · `GET /v1/controller/sessions/:id/actions` |
| Blog & SEO | `POST /v1/blog-posts` · `GET /v1/blog-posts` · `PATCH /v1/blog-posts/:id` · `POST /v1/blog-posts/generate` · `POST /v1/blog-posts/:id/publish` · `GET /v1/seo-pages` · `PATCH /v1/seo-pages/:id` |
| Marketplace | `GET /v1/templates` · `POST /v1/templates` · `POST /v1/templates/:id/install` · `POST /v1/templates/:id/ratings` · `GET /v1/workflow-runs` (workflow run history) |
| Billing | `GET /v1/billing/subscription` · `POST /v1/billing/checkout` · `POST /v1/billing/portal` |
| Admin | `GET /v1/admin/settings` · `PATCH /v1/admin/settings` · `POST /v1/admin/kill-switch` · `GET /v1/admin/instance/*` (super-admin) |
| Contact | `POST /v1/contact` (public marketing contact form → EmailService, graceful when email disabled) |
| Webhooks ingress | `POST /hooks/:source` |
| Health | `GET /health` · `GET /ready` · `GET /v1/providers/health` (active AI provider chat + embeddings probe) · `GET /v1/system-health` |

---

## 8. WebSocket events (canonical)

One gateway hosts three namespaces. On connect, the client emits `join` with `{ workspaceId }` and the server adds it to room `ws:<workspaceId>`.

| Namespace | Server → client events | Payload |
|---|---|---|
| `/runs` | `run:step`, `run:status`, `approval:created`, `routing:proposed`, `routing:resolved` | `{ runId, step }` / `{ runId, status }` / `{ approvalId, runId }` / `{ routingDecisionId, agentId, confidence }` / `{ routingDecisionId, agentId, status }` |
| `/controller` | `controller:action`, `controller:trace` | `{ sessionId, name, args }` / `{ sessionId, entry }` |
| `/inbox` | `inbox:message` | `{ message }` |
| `/company` | `company:message`, `company:handoff` | `{ message }` (a conversation_messages or agent_messages row) / `{ fromAgentId, toAgentId, conversationId }` |

---

## 9. Billing unit rule (task credits)

A **task credit** is the user-facing unit. The conversion is fixed so usage is predictable: **1 task credit = 1,000 tokens billed at the fast tier**, and a smart-tier token costs **10 fast-tier-equivalent tokens**. Therefore one smart-tier call of 1,000 tokens consumes 10 credits. Each `usage_records` row stores raw tokens, the model, and the computed credits; `credit_wallets` decrement by credits. Bring-your-own-key workspaces are not charged credits for model tokens (only a platform fee), because the token cost falls to their own provider account.

---

## 10. State machines (enforce these transitions)

Reject any transition not listed. Persisting an invalid transition is a bug.

**`agent_runs.status` and `workflow_runs.status`**
```
queued -> running
running -> waiting_approval        (a risky tool needs approval)
waiting_approval -> running        (approved) | failed (rejected, if fatal) | cancelled
running -> paused                  (user pause)
paused -> running                  (resume) | cancelled
running -> succeeded | failed | cancelled   (terminal)
```

**`content_items.status`**
```
idea -> draft -> approval -> scheduled -> published
approval -> draft        (changes requested)
scheduled -> failed      (publish error; may retry -> scheduled)
```

**`approvals.status`**: `pending -> approved | rejected` (terminal).

**`documents.status`**: `pending -> processing -> ready | failed` (failed may retry -> processing).

**`agents.mode`**: `sandbox -> production` (promotion only; never auto).

**`controller_actions.status`**: `planned -> confirmed -> executed | failed`; `executed -> undone` (reversible actions only).

---

## 11. Canonical shared contracts (illustrative)

These live in `packages/shared` and are imported by both web and api. Shapes below are the contract; extend them there, never redefine them elsewhere.

```ts
// error envelope — every error response
export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),            // see §12
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

// pagination — every list endpoint
export const PageQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

// creating/updating an agent
export const AgentInputSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  goal: z.string().optional(),
  systemPrompt: z.string().default(''),
  defaultModel: z.string().optional(),
  costTier: z.enum(['fast', 'smart', 'auto']).default('auto'),
  mode: z.enum(['sandbox', 'production']).default('sandbox'),
  tools: z.array(z.string()).default([]),         // 'mcp:<id>:<tool>' | 'connector:<type>:<action>' | 'builtin:<name>'
  knowledgeBaseIds: z.array(z.string()).default([]),
  approvalRequiredFor: z.array(z.enum(['publish', 'send', 'destructive'])).default(['publish', 'send', 'destructive']),
  guardrails: z.object({
    piiMask: z.boolean().default(false),
    promptInjectionScan: z.boolean().default(true),
    maxCostUsdPerRun: z.number().positive().default(0.5),
  }).default({}),
});
export type AgentInput = z.infer<typeof AgentInputSchema>;

// starting a run
export const StartRunSchema = z.object({ input: z.unknown() });

// live run step event (server -> client on /runs)
export const RunStepEventSchema = z.object({
  runId: z.string(),
  step: z.object({
    index: z.number(),
    type: z.enum(['llm', 'tool', 'approval', 'handoff', 'wait', 'log']),
    name: z.string(),
    status: z.string(),
    costUsd: z.number().optional(),
  }),
});

// a Controller action call (server -> client on /controller)
export const ControllerActionCallSchema = z.object({
  sessionId: z.string(),
  name: z.string(),                 // must be a key in the action registry
  args: z.record(z.unknown()),
  riskClass: z.enum(['safe', 'confirm', 'destructive']),
});
```

---

## 12. Error codes (canonical)

Use exactly these codes in the error envelope. Never leak secrets or another tenant's data in `message` or `details`.

`UNAUTHENTICATED` · `FORBIDDEN` · `NOT_FOUND` · `VALIDATION_FAILED` · `CONFLICT` · `RATE_LIMITED` · `COST_LIMIT_EXCEEDED` · `KILL_SWITCH_ACTIVE` · `APPROVAL_REQUIRED` · `TENANT_MISMATCH` · `UPSTREAM_ERROR` · `NOT_LICENSED` (an `/ee` feature without a valid `LICENSE_KEY`).

---

## 13. Embedding and model dimension rule

`document_chunks.embedding` and `agent_memories.embedding` are `vector(1536)`. **1536 is the dimension of the default embedding model** (an OpenAI `text-embedding-3-small`-class model). If you change the embedding model to one with a different dimension, you must change the column dimension and rebuild the HNSW index, and existing rows must be re-embedded. Store the model name on `knowledge_bases.embedding_model` so a base is never queried with embeddings from a different model. Do not mix dimensions within a column.

---

## 14. Testing strategy

| Level | Tool | What it covers |
|---|---|---|
| Unit | Vitest | Pure logic in `packages/*` and service methods |
| Integration | Testcontainers (Postgres+pgvector, Redis) | Repositories, migrations, **row-level-security isolation**, RAG retrieval |
| End-to-end | Playwright | Signup → create agent → run; the 60-second onboarding; a Controller command |
| Contract | Vitest + OpenAPI snapshot | Shared Zod schemas and the generated OpenAPI surface |
| Security suite | Vitest/Playwright | Tenant isolation, secret non-leakage, approval gate, webhook idempotency, kill switch, cost limit (maps to task P14-04) |
| Agent evals | Custom harness (V2) | Golden-task scoring for agent quality and regressions |

**Required gate in CI:** `pnpm lint && pnpm typecheck && pnpm test` must pass; the tenant-isolation test (P1-07) is mandatory and must fail if RLS is removed.

---

## 15. Continuous integration (outline)

1. Install with a frozen lockfile (`pnpm install --frozen-lockfile`).
2. `pnpm lint`, `pnpm typecheck`.
3. `pnpm test` with Testcontainers-backed integration tests.
4. Build all apps (`pnpm build`).
5. Dependency and container vulnerability scan; secret scan on the diff (maps to P14-07).
6. On main, build and publish images; deploy to staging; run Playwright smoke tests.

---

## 16. When you are unsure (the protocol)

1. Re-read the relevant section of `ARCHITECTURE.md` and the catalogs here.
2. If the name or shape you need is missing, add it to the canonical catalog in this file **first**, in the same change, then implement against it.
3. If a task appears to require a dependency outside §3, stop and flag it rather than adding one.
4. Never invent a route, event, table, column, type, or environment variable to make code compile. A blocked task is recoverable; silent drift is not.

*End of BUILD_GUIDE.md.*
