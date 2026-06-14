# Bitecodes — Development Tasks (Atomic Build Plan)

This is the executable build plan. Tasks are ordered, atomic, and written so an AI coding agent (or a human) can complete them one at a time without ambiguity. Each task has a stable ID, a checkbox, the **files** it touches, and an **acceptance criterion** (AC) that defines "done."

**How to use this file**
- **Read `BUILD_GUIDE.md` before starting.** It holds the canonical catalogs (events, routes, WebSocket namespaces, environment variables, contracts, state machines, error codes) and the naming conventions every task assumes.
- Build top to bottom. Later phases assume earlier ones are complete.
- Do one task per commit/PR where possible. Sign commits (`-s`) for DCO.
- After each task, run `pnpm lint && pnpm typecheck && pnpm test`.
- Names, schema, and architecture come from `ARCHITECTURE.md` and `BUILD_GUIDE.md` — do not deviate.
- **No invented names.** Every table, column, Inngest event, REST route, WebSocket event, environment variable, and shared type must already exist in `BUILD_GUIDE.md` or `ARCHITECTURE.md`. If you need a new one, add it to the canonical list there in the same change, then use it.
- **No invented dependencies.** Only use libraries listed in `ARCHITECTURE.md` §3, pinned to exact versions.

**Legend:** `[FE]` frontend · `[BE]` backend · `[DB]` database · `[AI]` ai/agent · `[INFRA]` infra/devops · `[SEO]` seo · `[EE]` enterprise

**Phase index**
- Phase 0 — Foundations & Monorepo
- Phase 1 — Database, Multi-tenancy, Auth
- Phase 2 — Model Gateway & Agent Runtime
- Phase 3 — Knowledge Base & RAG
- Phase 4 — Connectors & MCP
- Phase 5 — Workflow Engine & Visual Builder
- Phase 6 — Social Media Flagship
- Phase 7 — Unified Inbox & AI Replies
- Phase 8 — AI Controller (wow feature)
- Phase 9 — Admin Panel & AI Blog Publishing
- Phase 10 — SEO Engine
- Phase 11 — Community & Marketplace
- Phase 12 — Billing & Subscriptions
- Phase 13 — Enterprise (SSO, RBAC, Audit)
- Phase 14 — Observability & Security Hardening
- Phase 15 — Polish, Onboarding & Launch

---

## Phase 0 — Foundations & Monorepo

### 0.1 Repo & tooling
- [ ] **P0-01 [INFRA]** Initialize git repo, add `LICENSE` (Apache 2.0) and `ee/LICENSE` (proprietary stub). **AC:** repo builds; both license files present.
- [ ] **P0-02 [INFRA]** Set up pnpm workspace + Turborepo: `pnpm-workspace.yaml`, `turbo.json`, root `package.json` with scripts (`dev`, `build`, `lint`, `typecheck`, `test`). **AC:** `pnpm install` succeeds with empty workspaces.
- [ ] **P0-03 [INFRA]** Create `packages/config`: shared `tsconfig.base.json`, `eslint` config, `prettier`, `tailwind` preset. **AC:** other packages can extend these.
- [ ] **P0-04 [INFRA]** Scaffold empty apps/packages directories per `ARCHITECTURE.md` layout with placeholder `package.json` + `index.ts`. **AC:** `turbo run build` runs across all (no-op).

### 0.2 Shared contract
- [ ] **P0-05 [BE/FE]** In `packages/shared`, add `zod` and create base schemas: `Id`, `Timestamps`, `Role` enum, `Plan` enum, pagination params, error envelope. Export inferred types. **AC:** importable from web and api.
- [ ] **P0-06 [BE/FE]** Define enums shared across the system (run status, step type, connector risk class, content status, etc.) in `packages/shared/enums.ts`. **AC:** single source of truth, no duplicate enums elsewhere.

### 0.3 Single-Docker baseline
- [ ] **P0-07 [INFRA]** Write `docker-compose.yml` with services: `postgres` (pgvector image), `redis`, `minio`, `inngest`, `litellm`. Healthchecks + named volumes. **AC:** `docker compose up postgres redis minio inngest litellm` brings all up healthy.
- [ ] **P0-08 [INFRA]** Write `.env.example` documenting every variable (DB, Redis, MinIO, AUTH_SECRET, ENCRYPTION_KEY, provider keys, gateway URL, SUPERADMIN_EMAILS, base URLs). **AC:** copying to `.env` + filling 3 required values is enough to boot infra.
- [ ] **P0-09 [INFRA]** Add Dockerfiles for `web`, `api`, `worker` under `infra/docker/`; wire into compose (profiles: `full`). **AC:** `docker compose --profile full up` builds and starts all apps.

### 0.4 App skeletons
- [ ] **P0-10 [FE]** Scaffold `apps/web` with Next.js 15 (App Router, TS, Tailwind v4). Add route groups `(public)`, `(auth)`, `(app)`, `(admin)`. **AC:** `pnpm --filter web dev` serves a placeholder home.
- [ ] **P0-11 [FE]** Install shadcn/ui into `packages/ui`; add base components (button, input, card, dialog, dropdown, table, tabs, toast, sheet). Expose CSS variables for theming. **AC:** web renders a styled button from `packages/ui`.
- [ ] **P0-12 [BE]** Scaffold `apps/api` with NestJS 11 + Swagger at `/docs` + a `/health` and `/ready` endpoint. **AC:** `pnpm --filter api dev` serves health 200 and Swagger.
- [ ] **P0-13 [BE]** Add global exception filter producing the shared error envelope (using the canonical error codes in BUILD_GUIDE §12); add request-id middleware. **AC:** an error returns `{ error: { code, message } }` with a request id header.
- [ ] **P0-14 [INFRA]** Integrate Resend for transactional email behind a thin `EmailService` (verification, invitations, notifications). Config from `RESEND_API_KEY` + `EMAIL_FROM`; no SMTP server. **AC:** a test email sends; the service is a no-op with a clear log when the key is absent (self-host friendly).
- [ ] **P0-15 [FE/BE]** Base internationalisation with `next-intl`: locale routing, a default `en` message catalogue, and a `useTranslations` setup. **AC:** the app renders through the i18n layer; adding a locale needs only a new message file.

---

## Phase 1 — Database, Multi-tenancy, Auth

### 1.1 Drizzle setup
- [ ] **P1-01 [DB]** In `packages/db`, install `drizzle-orm` + `drizzle-kit` + `pg`. Configure `drizzle.config.ts` and a db client factory that supports a per-request transaction with tenant GUCs. **AC:** `pnpm db:generate` produces an empty migration.
- [ ] **P1-02 [DB]** Define identity/tenancy tables (`organizations`, `workspaces`, `users`, `memberships`, `invitations`) per schema §6. **AC:** migration applies; `pnpm db:studio` shows tables.
- [ ] **P1-03 [DB]** Add Better Auth tables (`accounts`, `sessions`, `verifications`). **AC:** tables exist and match Better Auth's expected shape.
- [ ] **P1-04 [DB]** Write a `tenant-columns` helper and add `organization_id`/`workspace_id` to all tenant tables as they are created (start with the ones above). **AC:** helper reused; columns indexed.

### 1.2 Row-Level Security
- [ ] **P1-05 [DB]** Write RLS policy SQL: `ENABLE`+`FORCE ROW LEVEL SECURITY` and `USING`/`WITH CHECK` policies comparing `organization_id`/`workspace_id` to `current_setting('app.current_org')`/`app.current_workspace`. Store under `packages/db/rls/`. **AC:** policies applied via migration.
- [ ] **P1-06 [DB]** Implement `withTenant(orgId, workspaceId, fn)` that opens a transaction, runs `select set_config('app.current_org', $1, true)` (+ workspace), executes `fn`, commits. **AC:** queries inside see only the tenant's rows.
- [ ] **P1-07 [DB/TEST]** Write a tenant-isolation test: seed two orgs, attempt cross-tenant read, assert zero rows. **AC:** test passes; would fail if RLS removed.

### 1.3 Auth
- [ ] **P1-08 [BE]** Integrate Better Auth in `apps/api`: email/password + Google + GitHub OAuth; session cookies; mount handler. **AC:** can sign up, log in, log out; session persists.
- [ ] **P1-09 [BE]** Implement `AuthGuard` (validates session) and attach `user` to request. **AC:** protected route returns 401 without session.
- [ ] **P1-10 [BE]** Implement `TenantGuard`: read `x-bitecodes-workspace` header (or default), resolve membership, set tenant context via `withTenant`, attach `org`/`workspace`/`role`. **AC:** requests scoped to the resolved tenant; 403 if not a member.
- [ ] **P1-11 [BE]** Implement `RbacGuard` + `@RequireRole()`/`@RequirePermission()` decorators (core roles: owner/admin/member/viewer). **AC:** member blocked from admin-only route.
- [ ] **P1-12 [BE]** Org/workspace/membership/invitation REST endpoints (create org, create workspace, invite, accept invite, switch workspace, list members, change role). **AC:** full lifecycle works; covered by tests.

### 1.4 Auth UI
- [ ] **P1-13 [FE]** Build `(auth)` pages: login, signup, forgot/reset, OAuth buttons, invite-accept. **AC:** end-to-end signup→app works.
- [ ] **P1-14 [FE]** App shell in `(app)`: sidebar nav (Home, Agents, Workflows, Inbox, Content, Knowledge, Analytics, Settings), workspace switcher, user menu, theme toggle, command palette mount, AI Controller mount placeholder. **AC:** authenticated user sees shell; switching workspace re-scopes data.
- [ ] **P1-15 [FE]** First-run wizard: create first org + workspace + admin profile on fresh install. **AC:** new instance lands a brand-new user in a usable workspace.
- [ ] **P1-16 [FE]** Wire TanStack Query + a typed API client generated from `packages/shared`. **AC:** all data fetching goes through the typed client.
- [ ] **P1-17 [BE/DB]** Add the `idempotency_keys` table and an `Idempotency-Key` interceptor: for a mutating request carrying the header, return the stored response if the key was seen, otherwise execute and store it (scoped per organization). **AC:** replaying a POST with the same key returns the original result and does not double-execute.

---

## Phase 2 — Model Gateway & Agent Runtime

### 2.1 Gateway
- [ ] **P2-01 [INFRA]** Configure the LiteLLM container with a `litellm.config.yaml` defining model groups for `fast`, `smart`, and provider fallbacks; expose virtual-key admin. **AC:** `curl` to gateway returns a completion using the instance key.
- [ ] **P2-02 [AI]** In `packages/ai-core`, implement `ModelRouter.route({ messages, tools, costTier, workspaceId })` using the OpenAI-compatible client pointed at LiteLLM. Normalize response + usage. **AC:** unit test returns a completion and token usage.
- [ ] **P2-03 [AI]** Implement per-workspace BYO-key registration: read encrypted key from `connector_credentials`, register as a LiteLLM virtual key, route workspace traffic through it. **AC:** a workspace with its own key bills to that key.
- [ ] **P2-04 [AI]** Implement `auto` routing heuristic (input length + tool depth + prior-failure signal → fast vs smart). **AC:** short prompts route to fast; long/complex route to smart (covered by test).
- [ ] **P2-05 [AI]** Implement prompt caching markers in `PromptAssembler` for the stable system prefix + large KB context. **AC:** cache markers present on supported providers; verified in a trace.

### 2.2 Prompt assembly & guardrails
- [ ] **P2-06 [AI]** `PromptAssembler.build({ agentVersion, memory, retrievedChunks, tools, userInput })` → message array with system prompt, citations `[n]`, tool catalog. **AC:** snapshot test of assembled messages.
- [ ] **P2-07 [AI]** `Guardrails`: PII masking (regex + optional classifier) and prompt-injection scan on ingested/external content. Togglable via agent config. **AC:** injected "ignore previous instructions" content is flagged; emails masked when enabled.

### 2.3 Durable agent executor (Inngest)
- [ ] **P2-08 [BE]** Mount Inngest in `apps/api`; create the `inngest` client + serve endpoint. **AC:** Inngest dev dashboard shows the app.
- [ ] **P2-09 [DB]** Add `agents`, `agent_versions`, `agent_triggers`, `agent_runs`, `run_steps`, `approvals` tables. **AC:** migration applies with indexes.
- [ ] **P2-10 [AI]** Implement the `agent/run` Inngest function: resolve agent+version, create run, assemble prompt, loop of model→tool steps, persist each `run_steps`, finalize totals. Each model/tool call is a discrete `step`. **AC:** a trivial agent ("echo with a tool") runs end-to-end and persists steps.
- [ ] **P2-11 [AI]** Approval gate: when a tool's `approval_required` is true, create `approvals`, set run `waiting_approval`, `step.waitForEvent('approval/decided')`; resume on decision. **AC:** run pauses, an approval appears, approving resumes and completes.
- [ ] **P2-12 [AI]** Multi-agent handoff via `step.invoke('agent/run', …)`; record handoff as a step. **AC:** Agent A delegates to Agent B; both runs linked.
- [ ] **P2-13 [AI]** Cost/step ceilings + workspace/instance kill-switch check at each step boundary. **AC:** exceeding `maxCostUsdPerRun` stops the run; kill switch halts running agents.
- [ ] **P2-14 [BE]** Triggers: register Inngest crons from `agent_triggers` (schedule); webhook + event trigger matching. **AC:** a scheduled agent fires on cron; a webhook fires the matching agent.
- [ ] **P2-15 [BE]** Pause/resume/cancel endpoints mapping to Inngest controls + run status. **AC:** a long run can be paused, resumed, cancelled from the API.

### 2.4 Agent UI
- [ ] **P2-16 [FE]** Agents list + create flow (templates first, AI-assist second, blank third). **AC:** can create an agent from a template in <1 min.
- [ ] **P2-17 [FE]** Agent builder form: name, role, goal, personality, system prompt (with version history), model + cost-tier selector, tool picker, KB attach, memory + guardrail toggles, triggers. Uses React Hook Form + Zod from `packages/shared`. **AC:** saving creates a new `agent_versions` row; switching versions works.
- [ ] **P2-18 [FE]** Playground: run an agent with test input; stream steps live over Socket.IO. **AC:** steps appear in real time with cost meter.
- [ ] **P2-19 [BE/FE]** WebSocket `/runs` namespace: emit run/step events; client subscribes in playground + run timeline. **AC:** live updates with reconnection.
- [ ] **P2-20 [FE]** Run timeline + step inspector + **replay** (re-run from a step). **AC:** every step's input/output/cost visible; replay works.

---

## Phase 3 — Knowledge Base & RAG

- [ ] **P3-01 [DB]** Add `knowledge_bases`, `documents`, `document_chunks` (vector(1536) + HNSW index), `agent_memories`. **AC:** migration applies; HNSW index present.
- [ ] **P3-02 [BE]** Blob upload endpoint to MinIO/S3 (presigned). **AC:** a file uploads and a key is stored.
- [ ] **P3-03 [AI]** `kb/ingest` Inngest function: parse → token-aware chunk (overlap) → embed (via gateway; complex PDFs via worker) → insert chunks. **AC:** uploading a PDF produces ready chunks with embeddings.
- [ ] **P3-04 [AI]** URL ingestion + bounded website crawler (depth/page limits, robots-respecting) feeding the same pipeline. **AC:** crawling a small site ingests pages.
- [ ] **P3-05 [AI]** Retrieval: cosine top-k over `document_chunks` scoped by KB + tenant; optional hybrid with Postgres FTS. **AC:** relevant chunks returned with scores.
- [ ] **P3-06 [AI]** Citations: attach `document_id`/`source_ref` to retrieved chunks; assembler injects `[n]`. **AC:** agent answers include working citations.
- [ ] **P3-07 [AI]** Thread + long-term memory store with summarization + TTL. **AC:** an agent recalls prior thread context; long-term memory persists across runs.
- [ ] **P3-08 [FE]** Knowledge UI: KBs, upload, URL/crawl, document status, re-index, source viewer. **AC:** full KB lifecycle in UI.
- [ ] **P3-09 [PY]** (Optional) Worker `/embed` and `/ingest` endpoints using `unstructured` + embeddings for complex docs. **AC:** worker handles a scanned PDF the Node path can't.

---

## Phase 4 — Connectors & MCP

### 4.1 Connector framework
- [ ] **P4-01 [BE]** Define the `Connector` interface + registry in `packages/connectors` (actions/triggers with Zod schemas, `riskClass`). **AC:** a "hello" connector registers and lists its actions.
- [ ] **P4-02 [DB]** Add `connectors`, `connector_credentials` (sealed secrets). **AC:** migration applies.
- [ ] **P4-03 [BE]** Central OAuth2 flow (`/connector/:type/oauth/start` + `/callback`); seal tokens with libsodium into `connector_credentials`. **AC:** a generic OAuth connector connects and stores a sealed token.
- [ ] **P4-04 [BE]** Secret vault helpers: `seal`/`open` using `ENCRYPTION_KEY`; never log/return plaintext. **AC:** secrets round-trip; plaintext never appears in responses/logs.
- [ ] **P4-05 [AI]** Expose connector actions as agent tools and as workflow steps (single implementation, two consumers). **AC:** an agent calls `connector:slack:postMessage`.

### 4.2 First-party connectors (V1 set)
- [ ] **P4-06 [BE]** Slack connector (postMessage, listChannels; events trigger). **AC:** agent posts to Slack; an inbound message can trigger an agent.
- [ ] **P4-07 [BE]** Gmail connector (send, search, read; risk-classed). **AC:** send gated by approval by default.
- [ ] **P4-08 [BE]** HTTP + Webhook connectors (generic request action; inbound webhook trigger with signature + idempotency). **AC:** a workflow makes an HTTP call; an inbound webhook fires a trigger once (idempotent).
- [ ] **P4-09 [BE]** Notion connector (create/append page, query DB). **AC:** agent writes a Notion page.
- [ ] **P4-10 [BE]** Google Drive connector (list, read, upload). **AC:** agent reads a Drive file into a KB.
- [ ] **P4-11 [BE]** X/Twitter connector (post, reply, read mentions/DMs). **AC:** scheduled post publishes to X.
- [ ] **P4-12 [BE]** LinkedIn connector (post, comment). **AC:** post publishes to LinkedIn.
- [ ] **P4-13 [BE]** Meta connector (Instagram + Facebook Pages: post, fetch comments/DMs). **AC:** post publishes to Instagram; comments ingest to inbox.
- [ ] **P4-14 [FE]** Connectors admin UI: connect/disconnect, status, per-action risk display, re-auth. **AC:** full connector management in UI.

### 4.3 MCP
- [ ] **P4-15 [DB]** Add `mcp_servers`, `mcp_tools` (with `description_hash`, `risk_class`, `approval_required`). **AC:** migration applies.
- [ ] **P4-16 [AI]** `McpClientManager` (official SDK): connect to an HTTP-streamable MCP server, list tools, persist with `description_hash`. **AC:** connecting a sample MCP server lists its tools.
- [ ] **P4-17 [AI]** Tamper detection: on reconnect, compare description hashes; flag + require re-approval on change. **AC:** changing a tool description triggers a re-approval flag.
- [ ] **P4-18 [AI]** Expose MCP tools to agents as tools; enforce approval/risk gates. **AC:** an agent uses an MCP tool; a write tool requires approval.
- [ ] **P4-19 [BE]** OAuth Resource Server support for authenticated MCP servers (scoped, short-lived tokens). **AC:** an OAuth-protected MCP server connects securely.
- [ ] **P4-20 [FE]** MCP UI: add server, view tools, enable/disable, set approval, view tamper flags. **AC:** full MCP management in UI.
- [ ] **P4-21 [BE/DB]** Add the `oauth_states` table and harden the connector OAuth flow with CSRF state and PKCE: store `state` + `code_verifier` on start, verify and consume on callback, expire stale states. **AC:** a tampered or replayed callback is rejected; a valid one exchanges and seals the token.

---

## Phase 5 — Workflow Engine & Visual Builder

- [ ] **P5-01 [DB]** Add `workflows`, `workflow_versions`, `workflow_runs`; link `run_steps` to `workflow_run_id`. **AC:** migration applies.
- [ ] **P5-02 [BE]** Define node-type registry (`trigger`, `agent`, `connectorAction`, `condition`, `approval`, `delay`, `loop`, `branch`, `errorHandler`, `escalation`, `transform`, `httpRequest`) with Zod param schemas. **AC:** each node type validated independently.
- [ ] **P5-03 [BE]** Graph compiler: `workflows.graph` → an Inngest function (steps per node, edges → control flow, loops bounded, approvals/delays via waitForEvent/sleep). **AC:** a 3-node workflow (trigger → agent → Slack) compiles and runs.
- [ ] **P5-04 [BE]** Graph validation (no illegal cycles, all required params set, reachable terminal). **AC:** invalid graphs rejected with clear errors.
- [ ] **P5-05 [FE]** Visual builder with React Flow: node palette, drag/connect, side-panel param editor, validation surface, save → `workflow_versions`. **AC:** build + save the 3-node workflow visually.
- [ ] **P5-06 [FE]** Workflow testing mode: run with sample input on sandbox connectors; live step trace + replay. **AC:** test run shows every step.
- [ ] **P5-07 [BE/FE]** Workflow run history, schedule list, enable/disable, export/import (JSON). **AC:** workflows can be scheduled, exported, re-imported.

*(Phases 6–15 continue in the second half of this file.)*

---

## Phase 6 — Social Media Flagship

### 6.1 Accounts & brand voice
- [ ] **P6-01 [DB]** Add `social_accounts`, `brand_voices`, `content_items`, `content_variants`. **AC:** migration applies with indexes on `(workspace_id, scheduled_for)`.
- [ ] **P6-02 [BE]** Connect social account flow reusing connector OAuth → create `social_accounts`. **AC:** connecting X/LinkedIn/Instagram creates an account row.
- [ ] **P6-03 [AI]** Brand-voice extraction agent: paste/import 3–20 past posts → derive `derived_prompt` + tone profile. **AC:** pasting samples produces a reusable brand voice.
- [ ] **P6-04 [FE]** Brand voice UI: create/edit, sample posts, preview generated tone. **AC:** brand voice manageable in UI.

### 6.2 Content generation & calendar
- [ ] **P6-05 [AI]** Content-generation agent: topic + brand voice → `content_items` + per-platform `content_variants` (length/style adapted, hashtags, media suggestions, 3 variants). **AC:** one topic yields platform-tailored variants.
- [ ] **P6-06 [AI]** "Generate a week" action: produce 5–7 scheduled drafts across selected platforms. **AC:** a week of drafts appears on the calendar.
- [ ] **P6-07 [FE]** Content calendar (calendar view by `scheduled_for`) + kanban (by `status`) with drag-to-reschedule. **AC:** dragging an item updates its schedule.
- [ ] **P6-08 [FE]** Composer: edit a content item + variants, attach media, preview per platform, character counts. **AC:** edits persist; previews match platform limits.

### 6.3 Approval & publishing
- [ ] **P6-09 [BE]** Approval policy per workspace (manual / one-click-all / auto). **AC:** policy respected at publish time.
- [ ] **P6-10 [AI]** Publishing Inngest cron: at `scheduled_for`, run the approval gate, publish via the platform connector, store `external_post_id`, handle failures with retry/escalation. **AC:** a scheduled post publishes and records its external id.
- [ ] **P6-11 [FE]** Approval queue UI (kanban) with one-click approve/edit/reject. **AC:** approving publishes per policy.

### 6.4 Repurpose
- [ ] **P6-12 [AI]** Repurpose agent: one source (blog/transcript/URL) → N posts + newsletter draft + clip briefs. **AC:** a blog URL fans out to multiple drafts.
- [ ] **P6-13 [FE]** Repurpose UI: pick source, choose outputs, review fan-out. **AC:** full repurpose flow in UI.

---

## Phase 7 — Unified Inbox & AI Replies

- [ ] **P7-01 [DB]** Add `inbox_messages` (comment/dm/mention/review, sentiment, is_lead, status, draft_reply). **AC:** migration applies with `(workspace_id, status)` index.
- [ ] **P7-02 [BE]** Connector pollers/streams ingest comments, DMs, mentions, reviews into `inbox_messages` (idempotent). **AC:** Instagram/X comments appear in the inbox once each.
- [ ] **P7-03 [AI]** Reply agent: draft a response in brand voice per message; store `draft_reply`. **AC:** new messages get drafts.
- [ ] **P7-04 [AI]** Sentiment + lead detection tagging; auto-escalate complaints/negative sentiment to a human. **AC:** a negative message is flagged and escalated.
- [ ] **P7-05 [FE]** Unified inbox UI: all platforms in one list, filters (status/sentiment/lead), draft preview, one-click send or edit, bulk "draft all" + "send approved". **AC:** triage + reply across platforms from one screen.
- [ ] **P7-06 [BE/FE]** WebSocket `/inbox` live updates. **AC:** new messages appear without refresh.
- [ ] **P7-07 [BE]** Send replies via platform connector with approval gating. **AC:** approved replies post back to the platform.
- [ ] **P7-08 [BE/FE/DB]** Notifications system: add the `notifications` table and emit notifications for pending approvals, run failures, publish failures, and inbox escalations. Surface an in-app bell with unread counts over the `/inbox` namespace, and an optional email channel via `EmailService`. **AC:** an approval request and a failed run each raise an in-app notification; enabling the email channel also sends an email.

---

## Phase 8 — AI Controller (the wow feature)

### 8.1 Action registry & schemas
- [ ] **P8-01 [FE/BE]** In `packages/ai-controller`, define the `Action` type (`name`, Zod `args`, `riskClass`, `target: 'browser' | 'server' | 'both'`) and the registry. **AC:** registry lists actions with schemas.
- [ ] **P8-02 [FE/BE]** Implement the V1 action set: `navigate`, `agent.create`, `agent.run`, `agent.open`, `content.generateWeek`, `content.open`, `inbox.findNegative`, `inbox.reply`, `settings.open`, `billing.open`, `table.filter`, `knowledge.upload`, `connector.start`, `blog.generateAndPublish`, `workflow.open`. Each with schema + handler stub. **AC:** every action validates args and has a handler.
- [ ] **P8-03 [BE]** Risk classification + RBAC/tenant enforcement on every action (Controller can only do what the user may do). **AC:** a viewer cannot trigger admin actions via the Controller.

### 8.2 Controller agent
- [ ] **P8-04 [AI]** Implement the Controller as an Inngest agent whose tools are the Action Registry; input = natural-language command; output = ordered action calls with rationale. **AC:** "open billing" yields a `navigate` action.
- [ ] **P8-05 [DB]** Add `controller_sessions`, `controller_actions`. **AC:** migration applies.
- [ ] **P8-06 [AI]** Multi-step planning: the agent issues actions sequentially, awaiting each result before the next. **AC:** a 3-part command executes in order.

### 8.3 Command bus (browser)
- [ ] **P8-07 [FE]** Implement the `CommandBus` subscribed to WebSocket `/controller`: receive action calls, re-validate args (same Zod), dispatch. **AC:** browser executes a `navigate` action from the agent.
- [ ] **P8-08 [FE]** UI action handlers: Next.js router navigation, open panels/sheets, fill React Hook Form fields, apply table filters. **AC:** the Controller can navigate and pre-fill a form.
- [ ] **P8-09 [FE]** Confirmation cards for `confirm`/`destructive` actions; wait for user consent before executing. **AC:** a reply-send shows a confirm card first.
- [ ] **P8-10 [FE]** Live trace panel + per-action **Undo** for reversible actions; persist to `controller_actions`. **AC:** user sees each step; undo reverts a reversible action.
- [ ] **P8-11 [FE]** Voice input via Web Speech API (push-to-talk), graceful fallback to text. **AC:** spoken command runs; text always works.
- [ ] **P8-12 [FE]** Controller overlay UX: launch from command palette (`⌘K`) or a floating button; transcript history. **AC:** discoverable, fast, non-intrusive.

---

## Phase 9 — Admin Panel & AI Blog Publishing

### 9.1 Admin core
- [ ] **P9-01 [FE]** Workspace/Org admin shell with sections: Members & Roles, Connectors, MCP, Models & Cost, Limits & Kill Switch, Branding, Billing, Audit, SEO, Blog, Inbox Automation. **AC:** admin nav renders, gated by role.
- [ ] **P9-02 [BE]** Super-admin module gated by `SUPERADMIN_EMAILS`: tenant list, license, global flags, instance kill switch, health. **AC:** only superadmins access it.
- [ ] **P9-03 [FE]** Model & cost controls: allow/deny models per role, set cost tiers, manage BYO keys, view spend. **AC:** disabling a model hides it from agent builders.
- [ ] **P9-04 [FE]** Limits & kill switch UI: daily/monthly token+USD caps, per-run ceilings, workspace kill switch. **AC:** setting a cap enforces it; kill switch halts agents.

### 9.2 AI-first everywhere
- [ ] **P9-05 [FE]** Reusable "AI fill" affordance: any form field/section can request an AI-generated value (with accept/edit). **AC:** a blog title field can be AI-filled.
- [ ] **P9-06 [FE]** Bulk AI actions on lists/inboxes ("draft replies to all", "generate meta for all pages"). **AC:** bulk action processes a list.
- [ ] **P9-07 [BE]** Settings model: every operator-facing setting stored in `settings`, UI-editable, with env override precedence per `ARCHITECTURE.md` §19. **AC:** UI setting persists and overrides default; security settings remain env-only.

### 9.3 AI blog publishing
- [ ] **P9-08 [DB]** Add `blog_posts` (body_md, seo jsonb, status, generated_by_agent_id). **AC:** migration applies.
- [ ] **P9-09 [AI]** Blog-writer agent: topic/keywords → full article (markdown) + excerpt + cover image prompt + SEO meta + JSON-LD + suggested internal links. **AC:** a topic yields a complete, structured draft.
- [ ] **P9-10 [FE]** Blog admin: list, AI-generate, edit (markdown), schedule/publish, SEO panel with "AI rewrite". **AC:** generate → review → publish in a few clicks.
- [ ] **P9-11 [BE]** Publish pipeline: render blog post as a public SSR page, register a `seo_pages` row, add to sitemap, ping search engines. **AC:** a published post is live, indexed-ready, and in the sitemap.
- [ ] **P9-12 [AI]** Auto-mode (optional, off by default): schedule recurring AI blog posts on chosen topics/cadence with approval. **AC:** enabling auto-mode queues scheduled drafts for approval.
- [ ] **P9-13 [BE]** (Optional) WordPress connector publishing path for users whose blog lives on WordPress. **AC:** a post can publish to WordPress instead of the built-in blog.

---

## Phase 10 — SEO Engine

- [ ] **P10-01 [DB]** Add `seo_pages`. **AC:** migration applies with unique `path`.
- [ ] **P10-02 [SEO]** `packages/seo` JSON-LD builders (typed via `schema-dts`): Organization, WebSite, Article/BlogPosting, SoftwareApplication, BreadcrumbList, FAQPage, Product/Offer, ProfilePage. **AC:** builders output valid JSON-LD (validated).
- [ ] **P10-03 [SEO]** Next.js `generateMetadata` per public route: title, description, canonical, Open Graph, Twitter cards. **AC:** every public page has correct meta tags.
- [ ] **P10-04 [SEO]** `next-sitemap` config generating split `sitemap.xml` + `robots.txt` at build and on a refresh job as content grows. **AC:** sitemap includes blog, marketplace, profiles, integration pages.
- [ ] **P10-05 [AI/SEO]** AI metadata generation on publish for blog/marketplace/profile (stored in `seo_pages`/`blog_posts.seo`), human-overridable. **AC:** publishing auto-writes meta; admin can override.
- [ ] **P10-06 [SEO]** Programmatic SEO pages: generate an indexed landing page for each integration, each public template, each use case, with unique copy + structured data. **AC:** visiting `/integrations/slack` renders a unique SSR page in the sitemap.
- [ ] **P10-07 [SEO]** Auto internal-linking job across blog/integration/template pages. **AC:** related links appear and update as content grows.
- [ ] **P10-08 [AI/SEO]** AI image alt-text generation for uploaded media. **AC:** uploaded images get alt text.
- [ ] **P10-09 [SEO]** Core Web Vitals pass: `next/image`, font optimization, edge caching, route-level prefetch. **AC:** Lighthouse SEO + performance green on public pages.
- [ ] **P10-10 [FE]** Admin SEO controls: per-page noindex, canonical override, meta editor with "AI rewrite", sitemap/health view. **AC:** operator can manage SEO without code.
- [ ] **P10-11 [SEO]** i18n SEO: `next-intl` + `hreflang` on localized pages. **AC:** localized pages emit correct hreflang.

---

## Phase 11 — Community & Marketplace

- [ ] **P11-01 [DB]** Add `templates`, `template_installs`, `template_ratings`, `profiles`, `follows`. **AC:** migration applies.
- [ ] **P11-02 [BE]** Publish flow: export an agent/workflow/brand-voice/prompt to a **sanitized** `templates.payload` (strip secrets, tenant ids). **AC:** publishing strips all secrets (verified by test).
- [ ] **P11-03 [BE]** Install/clone flow: import a template into the current workspace as a new agent/workflow. **AC:** cloning a public agent creates a working copy.
- [ ] **P11-04 [BE]** Remix/fork: clone with edit + attribution lineage. **AC:** a forked template records its parent.
- [ ] **P11-05 [FE]** Marketplace browse/search/filter, template detail, install/clone/remix, ratings + comments. **AC:** discover → install in a few clicks.
- [ ] **P11-06 [FE]** Public profile pages (user/org) — server-rendered for SEO — listing published templates, follow button. **AC:** `/@handle` renders an indexed profile.
- [ ] **P11-07 [BE]** Moderation: report content, admin review/remove, quality gating for new publishers. **AC:** reported content can be removed; low-quality publishers curated.
- [ ] **P11-08 [FE]** Community surfaces: feature-request board, public roadmap, changelog, "template of the week". **AC:** these pages render and are linkable.
- [ ] **P11-09 [BE]** (V2.5) Monetization: paid templates with Stripe Connect 70/30 split + payout tracking. **AC:** a paid template purchase splits revenue correctly.

---

## Phase 12 — Billing & Subscriptions

- [ ] **P12-01 [DB]** Add `subscriptions`, `usage_records`, `credit_wallets`. **AC:** migration applies.
- [ ] **P12-02 [INFRA]** Add Lago to compose (self-host) + configure plans (free/pro/team/enterprise) and metered events. **AC:** Lago up; plans created.
- [ ] **P12-03 [BE]** Push every `usage_records` row to Lago as a metered event (tokens, task credits, storage). **AC:** usage appears in Lago.
- [ ] **P12-04 [BE]** Credit wallets: monthly grant per plan, decrement on usage, spending caps **on by default**, hard-stop at limit. **AC:** exhausting credits halts paid LLM use with a clear message.
- [ ] **P12-05 [BE]** Stripe (managed cloud): checkout, customer portal, webhook → update `subscriptions`. **AC:** upgrading a plan updates entitlements.
- [ ] **P12-06 [FE]** Billing UI: plan, seats, usage meters, invoices, upgrade/downgrade, BYO-key toggle (no token surcharge for BYO). **AC:** full billing self-service.
- [ ] **P12-07 [BE]** Entitlement checks gate paid features + seat counts; self-host bypasses billing. **AC:** Team-only feature blocked on Free; self-host unrestricted.

---

## Phase 13 — Enterprise (`/ee`, license-gated)

- [ ] **P13-01 [EE]** License-key validation gating the `/ee` modules. **AC:** `/ee` features inert without a valid key.
- [ ] **P13-02 [EE]** SSO: SAML 2.0 + OIDC via Better Auth SSO plugin (self-host) / WorkOS (cloud). **AC:** an org logs in via SAML.
- [ ] **P13-03 [EE]** SCIM directory sync (provision/deprovision users + roles). **AC:** IdP user changes sync to Bitecodes.
- [ ] **P13-04 [EE]** Advanced RBAC: custom roles + tool-scope permissions; agent permissions intersect caller permissions. **AC:** a custom role limits which tools an agent may call.
- [ ] **P13-05 [EE]** Audit export + SIEM forwarding + indefinite retention. **AC:** audit logs export to a SIEM endpoint.
- [ ] **P13-06 [EE]** IP allowlist, session policies, enforced 2FA. **AC:** off-allowlist requests blocked.
- [ ] **P13-07 [EE]** Sandbox vs production environments with promotion. **AC:** an agent promoted from sandbox to prod gains its production toolset.
- [ ] **P13-08 [EE]** Guardrails-pro: premium prompt-injection classifier + PII vault. **AC:** premium guardrail catches attacks the basic one misses (eval).
- [ ] **P13-09 [EE]** White-label "Powered by" removal + custom domain. **AC:** paid org hides the badge and serves a custom domain.

---

## Phase 14 — Observability & Security Hardening

- [ ] **P14-01 [BE]** Integrate Langfuse: trace every model call/run/step with cost + latency. **AC:** runs visible in Langfuse, linked to `agent_runs`.
- [ ] **P14-02 [INFRA]** OpenTelemetry traces/metrics/logs → OTLP backend (Grafana/Loki/Tempo). **AC:** API requests traced end-to-end.
- [ ] **P14-03 [FE]** Analytics dashboards: agent success/failure, cost per task, response time, most-used agents/tools/models, human-intervention rate, time/cost saved, ROI. **AC:** dashboards populate from real data.
- [ ] **P14-04 [BE/TEST]** Security test suite: tenant isolation (RLS), secret non-leakage, approval-gate enforcement, webhook idempotency, kill-switch, cost-limit. **AC:** all pass in CI.
- [ ] **P14-05 [BE]** Rate limiting (per workspace/IP) + abuse protection on auth and public endpoints. **AC:** brute-force and flooding throttled.
- [ ] **P14-06 [INFRA]** Backups + restore runbook for Postgres + blobs; data export + workspace deletion (GDPR). **AC:** restore tested; user data export works.
- [ ] **P14-07 [BE]** Dependency + container scanning in CI; secret scanning on commits. **AC:** CI fails on known-critical CVEs or committed secrets.

---

## Phase 15 — Polish, Onboarding & Launch

- [ ] **P15-01 [FE]** Command palette (`⌘K`, `cmdk`): global search + run-anything (create agent, schedule post, find run, switch workspace, open Controller). **AC:** all primary actions reachable from `⌘K`.
- [ ] **P15-02 [FE]** Dark/light mode (`next-themes`) + full responsive pass + accessibility (focus, ARIA, contrast). **AC:** WCAG AA on core screens; mobile usable.
- [ ] **P15-03 [FE]** Empty states + product tour (`driver.js`) gated to first login. **AC:** new users are guided, not dropped on blank screens.
- [ ] **P15-04 [FE]** The 60-second onboarding wow path: goal picker → connect account (or demo) → paste posts → week of drafts → meet the agent. **AC:** a brand-new user reaches a working AI social manager in ~60s.
- [ ] **P15-05 [FE/SEO]** Public marketing pages (home, features, pricing, integrations index, use cases, blog, marketplace) — all SSR + structured data. **AC:** Lighthouse SEO green; pages indexed-ready.
- [ ] **P15-06 [INFRA]** One-line deploy guides + buttons for Fly.io, Railway, Hetzner+Coolify; production `docker-compose` + reverse proxy (Caddy/Traefik) with TLS. **AC:** a fresh VPS is live via a documented one-liner.
- [ ] **P15-07 [DB]** Seed pack: starter agent templates, brand-voice examples, workflow templates, demo workspace. **AC:** `pnpm db:seed` produces an instantly-explorable instance.
- [ ] **P15-08 [DOCS]** Finalize docs site (self-host guide, connector contract, MCP security, API reference from OpenAPI). **AC:** a new developer can self-host and build a connector from the docs alone.
- [ ] **P15-09 [INFRA]** Launch checklist: health checks, status page, error tracking, rate limits, backups verified, kill switch tested. **AC:** all green before public launch (Show HN / Product Hunt / X / LinkedIn).

---

## Build-order summary (critical path)

1. **Phases 0–2** are the non-negotiable backbone: monorepo, multi-tenant DB + RLS, auth, model gateway, durable agent runtime. Nothing else works without these.
2. **Phases 3–5** make agents genuinely capable: knowledge, tools/MCP, workflows.
3. **Phase 6–7** deliver the wedge (social + inbox) that gets users.
4. **Phase 8** delivers the differentiator (AI Controller).
5. **Phases 9–10** make it admin-complete and SEO-automatic.
6. **Phases 11–12** add network effects + revenue.
7. **Phases 13–14** make it enterprise- and production-hardened.
8. **Phase 15** is the launch polish.

A solo/tiny team can ship a compelling public V1 by completing **Phases 0–10 + 15** (deferring marketplace monetization, enterprise SSO, and advanced observability to fast-follows).

*End of DEVELOPMENT_TASKS.md.*
