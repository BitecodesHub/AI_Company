# Bitecodes — BUILD_GUIDE Catalog Additions (AI Company Redesign)
_Generated 2026-06-13 · v1. Merge these into docs/BUILD_GUIDE.md BEFORE using the names._

## BUILD_GUIDE.md Additions — "AI Company" Redesign (de-duplicated, collision-flagged)

**Executive summary:** This is the complete, single set of canonical names to register in `docs/BUILD_GUIDE.md` **before** any code uses them, merged from all six subsystem designs. Overlapping names across designs were unified to one canonical name each (noted under Collisions). "Employees" is a UI label only — every name below stays in the `agent`/`agents` domain. All new DB objects key on `organization_id` (orgId, NOT NULL) + `workspace_id` (wsId, nullable) via `...tenantColumns()`, require RLS in **both** `packages/db/src/rls/policies.sql` and `packages/db/scripts/setup-rls.sql`, and must be mirrored into the inline `appSchema` in `apps/api/src/drizzle/drizzle.service.ts`.

---

### 1. New DB tables & columns

**New tables** (all carry orgId + wsId via `...tenantColumns()`; RLS required in both SQL files + inline mirror):

| Table | Tenancy (orgId/wsId) | pgvector | RLS | Purpose |
|---|---|---|---|---|
| `conversations` | both | no | yes | Company-chat / direct / task thread container. One `kind='company'` per workspace (partial unique index on `workspace_id WHERE kind='company'`). |
| `conversation_messages` | both | **yes** (`embedding vector(1536)`) | yes | Every turn (user/agent/system). HNSW index on `embedding`. Indexed `(conversation_id, created_at)` and unique `(conversation_id, seq)`. |
| `agent_messages` | both | no | yes | Durable inter-agent bus (handoff/reply/broadcast/observation). Gives the dormant `step_type='handoff'` a runtime. |
| `routing_decisions` | both | no | yes | Task-router audit + learning corpus (proposed/confirmed/diverted/rejected/dispatched/failed). |
| `agent_relationships` | both | no | yes | Org chart: directed edge (supervises/watches/delegates_to) between two `agents`. |
| `employee_controls` | both | no | yes | 1:1 with `agents` (unique `agent_id`). Per-employee mutable controls: activation_state, approval_mode, bypass_permission, plan_mode, max_runs_per_day, daily_cost_cap_usd, heartbeat_interval_s. |
| `employee_tool_grants` | both | no | yes | Per-employee tool scope grant: `agent_id`, `tool_ref`, `risk_class` (reuse `connector_risk_class`), `approval_required`, `bypass_permission`, `granted_by`. |
| `onboarding_states` | both | no | yes | 60-second onboarding checklist (`step` enum). *Alternative: persist under `settings.key='onboarding.state'` and add NO table — pick one; the table is recommended for resumability.* |

**New columns on existing tables** (mirror in `drizzle.service.ts`):

| Table | Column | Type | Notes |
|---|---|---|---|
| `agent_runs` | `parent_run_id` | uuid (nullable) | Run tree for handoffs. |
| `agent_runs` | `routing_decision_id` | uuid (nullable) | Back-link to routing audit. |
| `agent_runs` | `triggered_by_agent_id` | uuid (nullable) | Initiating employee (null = human). |
| `agent_runs` | `failure_reason` | text (nullable) | Carries `COST_LIMIT_EXCEEDED` / `KILL_SWITCH_ACTIVE` etc. |
| `agents` | `is_router` | boolean NOT NULL default false | The single dispatcher employee (partial unique index per workspace). |
| `agents` | `routing_keywords` | jsonb default `'[]'` | Router pre-filter chips. |
| `agents` | `supervisor_agent_id` | uuid (nullable) | Hierarchy link. |
| `agent_memories` | `kind` | enum `memory_kind` | episodic / semantic / procedural. |
| `agent_memories` | `visibility` | enum `memory_visibility` | private / workspace / organization. |
| `agent_memories` | `source_run_id` | uuid (nullable) | Provenance for the learning loop. |
| `agent_memories` | `salience` | numeric | 0–1 importance for ranking/decay. |

**New enums** (`pgEnum`):

| Enum | Values |
|---|---|
| `conversation_kind` | `company`, `direct`, `task` |
| `message_author_type` | `user`, `agent`, `system` |
| `message_role` | `message`, `handoff`, `result`, `clarification`, `divert_suggestion` |
| `agent_message_kind` | `handoff`, `reply`, `broadcast`, `observation` |
| `routing_status` | `proposed`, `confirmed`, `diverted`, `rejected`, `dispatched`, `failed` |
| `agent_relationship_kind` | `supervises`, `watches`, `delegates_to` |
| `activation_state` | `active`, `paused`, `archived` |
| `approval_mode` | `always`, `risky_only`, `never` |
| `memory_kind` | `episodic`, `semantic`, `procedural` |
| `memory_visibility` | `private`, `workspace`, `organization` |
| `onboarding_step` | `created_org`, `hired_first_employee`, `connected_or_skipped`, `first_run_succeeded`, `done` |

> pgvector/RLS note: only `conversation_messages.embedding` is a **new** vector column (reuses the existing `vector(1536)` type — never a new dimension, per §13). The migration must ensure `CREATE EXTENSION IF NOT EXISTS vector;` and add HNSW indexes (`vector_cosine_ops`, m=16, ef_construction=64) on `conversation_messages.embedding` (raw SQL — Drizzle cannot model HNSW). All new tables use the **two-clause** RLS policy (org **and** workspace) to close the existing workspace-isolation gap.

---

### 2. New Inngest events (slash-namespaced)

| Event | Emitted when | Payload |
|---|---|---|
| `orchestration/route` | A request needs routing to an employee | `{ routingDecisionId, organizationId, workspaceId, conversationId }` |
| `orchestration/decided` | Human confirmed/diverted/rejected a routing proposal | `{ routingDecisionId, decision, agentId? }` |
| `agent/handoff` | One employee hands work to another | `{ parentRunId, fromAgentId, toAgentId, conversationId, task, organizationId, workspaceId, payload? }` |
| `company/message.posted` | A user/employee message is persisted | `{ conversationId, messageId, organizationId, workspaceId }` |
| `company/message.learned` | A run finished; distill exchange to long-term memory | `{ conversationId, runId, agentId, organizationId, workspaceId }` |
| `memory/consolidate` | Retention + learning sweep (scheduled / on-thread-close) | `{ conversationId, organizationId, workspaceId }` |
| `employee/scheduled-tick` | Internal cron fans out due schedules | (cron — no payload) |
| `employee/input.provided` | User answers an `ask-user` conversational pause | `{ runId, approvalId, answer }` |
| `onboarding/completed` | First run succeeds (from `run/finished` handler) | `{ organizationId, workspaceId, userId }` |

> Register every new function in **both** `apps/api/src/inngest/index.ts` and the `INNGEST_FUNCTIONS` array in `apps/api/src/inngest-endpoint/inngest.controller.ts`.

---

### 3. New REST routes (method + path, all under `/v1`)

| Method | Path |
|---|---|
| GET | `/v1/me` |
| GET | `/v1/entitlements` |
| GET | `/v1/members/me/permissions` |
| POST | `/v1/orchestration/route` |
| POST | `/v1/orchestration/decisions/:id` |
| GET | `/v1/orchestration/decisions` |
| POST | `/v1/agent-relationships` |
| GET | `/v1/agent-relationships` |
| DELETE | `/v1/agent-relationships/:id` |
| GET | `/v1/conversations` |
| POST | `/v1/conversations` |
| GET | `/v1/conversations/:id` |
| GET | `/v1/conversations/company` |
| GET | `/v1/conversations/:id/messages` |
| POST | `/v1/conversations/:id/messages` |
| GET | `/v1/agent-handoffs` |
| GET | `/v1/agents/:id/controls` |
| PATCH | `/v1/agents/:id/controls` |
| POST | `/v1/agents/:id/activate` |
| POST | `/v1/agents/:id/deactivate` |
| GET | `/v1/agents/:id/tool-grants` |
| PUT | `/v1/agents/:id/tool-grants` |
| POST | `/v1/agents/:id/triggers` |
| GET | `/v1/agents/:id/triggers` |
| PATCH | `/v1/agents/:id/triggers/:triggerId` |
| DELETE | `/v1/agents/:id/triggers/:triggerId` |
| GET | `/v1/agents/:id/memories` |
| DELETE | `/v1/agents/:id/memories/:memoryId` |
| POST | `/v1/runs/:id/respond` |
| GET | `/v1/approvals/:id/email-decision` (public, HMAC token) |
| GET | `/v1/onboarding` |
| POST | `/v1/onboarding/advance` |

> Reuses existing routes (do NOT redefine): `POST /v1/agents/:id/runs`, `POST /v1/approvals/:id/decide` (fix its stub, don't rename), `GET/POST /v1/agents`, the full `/v1/connectors/*` set, `/v1/templates*`. Reconcile existing drift: `connectorsApi.oauthStart` returns `authorizationUrl` (not `authUrl`); OAuth callback redirect target moves to `/app/connectors?connected=<type>`.

---

### 4. New WebSocket namespaces

| Namespace | Server→client events | Payload |
|---|---|---|
| `/company` (**new**) | `company:message`, `company:typing`, `company:handoff`, `company:divert` | `{ message }` / `{ conversationId, agentId, state }` / `{ handoffId, fromAgentId, toAgentId, task, status }` / `{ conversationId, suggestedAgentId, reason }` |

**Events added to the EXISTING `/runs` namespace** (no new namespace): `routing:proposed` `{ routingDecisionId, chosenAgentId, candidates, rationale }`, `routing:resolved` `{ routingDecisionId, finalAgentId, status }`, `conversation:message` `{ conversationId, message }`.

> `CompanyGateway.handleJoin` MUST verify Better Auth session membership before joining `ws:<workspaceId>` (the existing gateways trust the client-supplied `workspaceId` — a real cross-tenant leak; harden on this new namespace and the `/runs` join path).

---

### 5. New AI Controller actions (dot-namespaced)

| Action | riskClass | target | Args |
|---|---|---|---|
| `orchestration.route` | `confirm` | `server` | `{ requestText, requestedAgentId? }` |
| `company.message` | `confirm` | `server` | `{ conversationId, content }` |
| `company.open` | `safe` | `browser` | `{ conversationId? }` |
| `conversation.open` | `safe` | `browser` | `{ conversationId }` |
| `onboarding.next` | `safe` | `browser` | `{}` (empty) |

> Reuses existing actions: `agent.create`, `agent.run`, `agent.open`, `connector.start`, `knowledge.upload`, `settings.open`. Add each new action to `ACTION_REGISTRY` in `packages/ai-controller/src/registry.ts` with a Zod `argsSchema`.

---

### 6. New env vars (add to §5 + `.env.example`)

| Variable | Purpose |
|---|---|
| `ORCHESTRATION_AUTODISPATCH_THRESHOLD` | Confidence floor (default `0.85`) for silent auto-dispatch of a routed task. |
| `COMPANY_CHAT_MAX_HANDOFF_DEPTH` | Caps recursive employee→employee delegation (default `5`) to prevent loops/runaway cost. |
| `APPROVAL_LINK_SECRET` | HMAC key signing approve/reject email deep links (**env-only**). |
| `APPROVAL_LINK_TTL_HOURS` | Email-link expiry (default `168` = 7d), aligned to the `waitForEvent` timeout. |
| `MEMORY_RETENTION_DAYS` | Hot-window retention for raw turns (default `90`). |
| `MEMORY_LONGTERM_TOPK` | Top-K long-term memories injected into prompt assembly (default `5`). |
| `CONVERSATION_WINDOW_MESSAGES` | Conversation-window size for prompt assembly (default `20`). |
| `NEXT_PUBLIC_BRAND_NAME` | White-label wordmark/title text (default `Bitecodes`). |
| `NEXT_PUBLIC_BRAND_PRIMARY_HSL` | Default `--color-primary` (`H S% L%`, default `221 83% 53%`). |
| `NEXT_PUBLIC_DEFAULT_THEME` | Seeds `next-themes` defaultTheme (`light\|dark\|system`, default `light`). |

> Reuses existing: `LICENSE_KEY` (RBAC custom roles + `/ee` gating), `SUPERADMIN_EMAILS`, `RESEND_API_KEY`/`EMAIL_FROM` (approval emails). No new var for RBAC.

---

### 7. New error codes

**None.** The redesign reuses the canonical §12 set: `FORBIDDEN`, `NOT_LICENSED`, `COST_LIMIT_EXCEEDED`, `KILL_SWITCH_ACTIVE`, `APPROVAL_REQUIRED`, `VALIDATION_FAILED`, `TENANT_MISMATCH`. Do not invent codes; `COST_LIMIT_EXCEEDED`/`KILL_SWITCH_ACTIVE` are carried in the new `agent_runs.failure_reason` column.

---

### 8. New / updated state machines (add to §10)

**`employee_controls.activation_state` (NEW):**
```
active  -> paused                  (deactivate; in-flight runs continue, new/scheduled rejected)
paused  -> active                  (activate)
active  -> archived | paused -> archived   (terminal; employee hidden)
```

**`routing_decisions.status` (NEW — orchestration task):**
```
proposed   -> confirmed   (human confirm)   -> dispatched
proposed   -> diverted    (human picks other) -> dispatched
proposed   -> rejected    (cancel)          (terminal)
(auto, confidence>=threshold) -> confirmed  -> dispatched
dispatched -> failed      (dispatch error)  (terminal)
```

**`agent_messages.... agent_handoffs` handoff status (NEW):** `pending -> accepted -> completed`; `pending -> rejected`; `accepted -> failed`.

**`onboarding_step` (NEW):** `created_org -> hired_first_employee -> connected_or_skipped -> first_run_succeeded -> done` (any step may "Skip for now" → jumps toward `done`).

**Approval / plan-mode (REUSE — no new statuses):** plan-mode and conversational `ask-user` both reuse the existing `agent_runs` transition `running -> waiting_approval -> running`, with an `approvals` row of `kind='custom'`. `approvals.status` (`pending -> approved | rejected`) is unchanged. `agents.mode` (`sandbox -> production`) unchanged. **`bypass_permission=true` skips the `waiting_approval` hop entirely** (auto-approve + mandatory `audit_logs` row).

---

### Collisions & de-duplications flagged

1. **Per-employee control model — CONFLICT, resolved.** The Controls design proposed a 1:1 `employee_controls` table; the RBAC design proposed columns `agents.active` + `agents.execution_mode` (enum `employee_execution_mode`). **Canonical choice: `employee_controls` table** (keeps version-immutable config clean, auditable, avoids polluting `AgentInputSchema`). **Discard** `agents.active`, `agents.execution_mode`, and the enum `employee_execution_mode`. The activate/deactivate/approval/plan controls live in `employee_controls`; `employee_tool_grants` keeps the per-tool `bypass_permission`.

2. **Inter-agent message table name — CONFLICT, resolved.** Designs used `agent_messages` (Memory design) vs `agent_handoffs` (Communication design) for overlapping purposes. **Canonical: `agent_messages`** as the durable bus; the handoff *queue* semantics fold into it via `agent_message_kind='handoff'` + the `agent/handoff` event. **Do not create `agent_handoffs`** as a separate table; the REST route `GET /v1/agent-handoffs` reads `agent_messages WHERE kind='handoff'`.

3. **`message_role` vs `message_author_type` — NOT a collision (kept both).** `message_author_type` = who sent (`user/agent/system`); `message_role` = utterance type (`message/handoff/result/clarification/divert_suggestion`). Both columns on `conversation_messages`.

4. **`agent/handoff` event payload — unified.** Two designs gave divergent payloads. Canonical payload (above) is the superset including `conversationId` + `payload?`.

5. **`/v1/me` vs `/v1/entitlements` vs `/v1/members/me/permissions` — overlapping, kept distinct.** `/v1/me` = identity + role + workspaces (IA design); `/v1/entitlements` = role+plan+features+navItems (Onboarding design); `/v1/members/me/permissions` = resolved scope set (RBAC design). They overlap but serve different consumers; recommend consolidating `/v1/entitlements` to embed the `/v1/me` payload to avoid two round-trips — **flag for stakeholder decision** rather than silently merging.

6. **Onboarding storage — OPEN.** `onboarding_states` table vs `settings.key='onboarding.state'` row. Pick one before migrating to avoid RLS-coverage drift across the two SQL policy files.

7. **Names that already EXIST — do NOT redefine:** `agents`, `agent_versions`, `agent_runs`, `run_steps`, `agent_memories`, `agent_triggers` (type `schedule`), `approvals` (`kind='custom'`, status machine), `notifications`; events `agent/run`, `run/finished`, `run/resumed`, `run/cancelled`, `approval/decided`; enum `step_type='handoff'` (give it runtime, don't rename); `connector_risk_class`; routes `POST /v1/agents/:id/runs`, `POST /v1/approvals/:id/decide`, all `/v1/connectors/*`; AI Controller `agent.create/run/open`, `connector.start`, `knowledge.upload`, `settings.open`; WS `/runs`, `/controller`, `/inbox`. **Route collision warning:** the new `POST /v1/agents/:id/activate` (control toggle) must not clash with the existing `POST /v1/agents/:id/activate/:versionId` (version activation) — they are distinguished only by the `:versionId` segment; document both explicitly.

---

### Tone Check (Warm but Authoritative)
- **Warmth: 3/5** — beginner-facing intent is present (Employees label, onboarding), but this is a dense engineering catalog by design.
- **Authority: 5/5** — grounded in the live schema, the existing `registry.ts`, and §6–§13 catalogs; every collision is named and resolved, and no existing canonical name is redefined.
- **Net:** Authoritative-leaning, appropriate for a BUILD_GUIDE catalog addition. Two items (`/v1/entitlements` consolidation; onboarding table vs settings) are deliberately left as flagged decisions rather than silently chosen.
