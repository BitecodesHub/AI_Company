# Bitecodes — AI Company Redesign: Phased Roadmap
_Generated 2026-06-13 · v1._

# Bitecodes "AI Company" — Final Phased Implementation Roadmap

## Executive summary

This roadmap sequences the Bitecodes "AI company" redesign into seven dependency-ordered phases plus a new **Phase 0 hardening prerequisite** that closes the three blockers raised in review. Lowest-risk/highest-visibility work ships first; backend capability is added in additive layers. Every new name is quarantined to a "catalog entries" block per golden rule #1 (register in `docs/BUILD_GUIDE.md` first, then code). No `agent*` name is renamed; "Employees" is a label only.

All reviewer findings were verified against the live code before resolution: `apps/api/src/drizzle/drizzle.service.ts` does hand-redefine a minimal subset (its `appSchema` at line 194 omits `agent_triggers`, `approvals`, `run_steps`, `agent_memories`, connectors, `mcp_tools`); `apps/api/src/inngest/agent.run.ts` is stubbed (placeholder tenant IDs at lines 41–53, name-heuristic approval at line 131, no persistence at lines 136–139 and 179–181); `docs/BUILD_GUIDE.md` line 205 already mandates per-agent Inngest crons; `apps/api/src/agent/agent.controller.ts` line 95 owns `POST :id/activate/:versionId`; and both RLS files use a single org-only clause with a nullable `workspace_id`.

Two cross-cutting gates apply to **every** phase and are part of each phase's acceptance criteria:
- **Typecheck gate** — `pnpm -r typecheck` (web + api + packages) passes.
- **Test gate** — the relevant package suites in `CLAUDE.md` plus touched Playwright specs (`apps/web/e2e/navigation.spec.ts`, `apps/web/e2e/agents.spec.ts`) pass.

**Resolved reviewer issues, mapped to phases:**
- **Blocker — drizzle.service.ts drift** → resolved in **Phase 0** by refactoring `drizzle.service.ts` to re-export `appSchema` from `@bitecodes/db` (eliminates the third drift source) plus a CI superset check.
- **Blocker — stubbed executor** → resolved in **Phase 0** by implementing real `resolve-run`, persistence, and `run/finished`, with "no placeholder tenant IDs remain in `agent.run.ts`" as an explicit acceptance criterion. Phase 3's data-driven gate is gated behind this.
- **Blocker — scheduling mechanism collision** → resolved in **Phase 0** by recording a single BUILD_GUIDE decision: **keep the existing per-agent cron mechanism (§6 line 205); drop `employee/scheduled-tick` entirely.**
- **Major — `/activate` route collision** → resolved by renaming the control toggle to `POST /v1/agents/:id/controls/activate` / `…/deactivate` (Phase 3).
- **Major — two-clause RLS form** → resolved by specifying the exact policy form below and a per-table `workspace_id` nullability decision (Phase 0 sets the standard).
- **Major — RBAC coverage gap** → resolved by explicit server-side role floors on chat, orchestration, and controls (Phases 3–5).
- **Minor — watch/learning observability** → resolved by a concrete watcher feed + a measurable learning test (Phases 4 and 6).
- **Minor — Phase-1 fail-open stub** → resolved by defaulting the stub to `viewer` (least-permissive) and a server-guard audit gate (Phase 1).

---

## Phase 0 — Hardening prerequisite (NEW; resolves all three blockers + the RLS-form major)

**Goal:** Make the typed DB client, the executor, the scheduling decision, and the RLS policy form trustworthy *before* any new feature reads through them. This phase ships no user-visible feature; it removes the structural risk the reviewers flagged.

**Scope**
- **(Blocker 1 — schema drift) Refactor `drizzle.service.ts` to import the schema from `@bitecodes/db`.** Replace the hand-rolled inline tables/enums and the partial `appSchema` export (lines 18–200) with a re-export of the canonical schema barrel from `packages/db/src/schema/index.ts`. This deletes the third drift source entirely, so future phases never "mirror" by hand. Add a CI assertion test: every table referenced by an API query exists as a key on the imported `appSchema` (superset check). *Resolves the reviewer's preferred fix.*
- **(Blocker 2 — stubbed executor) Implement the real run lifecycle in `agent.run.ts`:** `resolve-run` performs a `withTenant(orgId, wsId, …)` query loading the `agent_runs` row, its `agents` row, and the `active` `agent_versions` row (no placeholder IDs); `finalize` persists `output`, `cost_usd`, `tokens_*`, `status`, `finished_at` and emits `run/finished`; `create-approval` inserts a real `approvals` row (`kind='custom'`) and emits the WS event. Keep tool *execution* itself stubbed (still flagged for later phases) but make run/approval/audit persistence real.
- **(Blocker 3 — scheduling) Record the canonical scheduling decision in BUILD_GUIDE:** **keep per-agent Inngest cron functions from `agent_triggers` (type `schedule`) as already stated in §6 line 205; DROP the proposed `employee/scheduled-tick` event.** Remove it from every downstream phase, catalog, and state machine. Document the per-agent cron registration path so no second mechanism is ever introduced.
- **(Major — RLS form) Establish the canonical two-clause policy template** for all *new* tables and write it into both `packages/db/src/rls/policies.sql` and `packages/db/scripts/setup-rls.sql`:
  `USING / WITH CHECK = (organization_id::text = current_setting('app.current_org', true)) AND (workspace_id IS NULL OR workspace_id::text = current_setting('app.current_workspace', true))`.
  This admits legitimate org-level (`workspace_id IS NULL`) rows while closing the workspace-isolation gap. File a separate, explicitly out-of-scope hardening task to retrofit the existing org-only tables so isolation is eventually uniform (not split between old/new semantics).

**Key files to change/create**
- Change: `apps/api/src/drizzle/drizzle.service.ts` (import `@bitecodes/db`), `apps/api/src/inngest/agent.run.ts`, `docs/BUILD_GUIDE.md` (§6 scheduling decision + §RLS policy template), `packages/db/src/rls/policies.sql`, `packages/db/scripts/setup-rls.sql`.
- Create: `apps/api/test/drizzle-schema-superset.spec.ts` (CI superset check).

**New canonical catalog entries used**
- None invented. **Removed** from the catalog: `employee/scheduled-tick` (Inngest). BUILD_GUIDE §6 amended only to reaffirm the existing per-agent cron mechanism.

**Acceptance criteria (testable)**
- `appSchema` in `drizzle.service.ts` is the `@bitecodes/db` barrel; the superset test passes (every API-referenced table is a key).
- **No placeholder tenant IDs remain in `agent.run.ts`** (grep for `org-placeholder`/`ws-placeholder`/`agent-placeholder` returns zero); a seeded run resolves a real agent inside `withTenant` and persists `status=succeeded` + emits `run/finished`.
- A real `approvals` row is inserted on the existing name-heuristic path (gate logic replaced in Phase 3); existing 5 API tests still pass.
- The two-clause policy template exists verbatim in both SQL files; a tenant-isolation test proves an org-level (`workspace_id NULL`) row inserts and a cross-workspace row is rejected.
- `grep` confirms zero references to `employee/scheduled-tick` anywhere in the repo.

**Risks/mitigations**
- *Importing the full `@bitecodes/db` barrel pulls pgvector column types Drizzle-node cannot model.* Mitigation: the barrel already compiles for migrations; gate on `pnpm -r typecheck` and the superset test in the same change.
- *Refactor regresses an existing typed query.* Mitigation: run the full API suite before/after; the import is additive (more tables, same names).

---

## Phase 1 — Nav reduction, "Employees" label, design-system foundation, role-based nav visibility

**Goal:** Reduce primary navigation to five items (Dashboard, Employees, Knowledge, Connectors, Settings), rename "Agents" → "Employees" at the label layer only, lay the Apple-grade design-system foundation, and gate nav visibility by role — without touching routes, tables, or events.

**Scope**
- Replace the hardcoded 9-item `navItems` array in `apps/web/src/components/shell/sidebar.tsx` with role-aware `PRIMARY_NAV` (5) + collapsible `MORE_NAV` (Workflows, Content, Inbox, Templates/Marketplace, Analytics), default collapsed; filter both by `roleAtLeast`.
- Swap the Employees icon `Bot` → `Users`; flip the Agents page H1/empty-state copy to "Employees" while keeping `href="/app/agents/*"` and `agentsApi.*` untouched.
- Add `apps/web/src/lib/rbac.ts` with `RoleRank` mirroring the **verified** server `ROLE_RANK` (`owner:4, admin:3, member:2, viewer:1` from `rbac.guard.ts`) and `roleAtLeast(current, floor)`; tag each nav item with a `minRole`.
- Design tokens: add §2.2 employee-status/surface-2/overlay/`*-foreground` tokens (light + `.dark`), §3 type-scale utilities, and the `prefers-reduced-motion` guard to `apps/web/src/styles/globals.css`.
- Fix confirmed bugs: `button.tsx` `rounded-md` → `rounded-xl`; move `skeleton.tsx` into `@bitecodes/ui` and fix its `@/lib/utils` import to `../lib/utils`.
- Add `<Logo/>` to `@bitecodes/ui`; replace the hardcoded `<span>B</span>`.
- **(Minor — fail-open stub) Default the temporary `useMe()` stub to `viewer`** (least-permissive) so nav fails *closed* during the Phase-1→2 gap, not open.

**Key files to change/create**
- Change: `apps/web/src/components/shell/sidebar.tsx`, `apps/web/src/styles/globals.css`, `apps/web/app/[locale]/app/agents/page.tsx`, `packages/ui/src/components/button.tsx`, `packages/ui/src/index.ts`, `apps/web/app/[locale]/layout.tsx`, `apps/web/e2e/navigation.spec.ts`.
- Create: `apps/web/src/lib/rbac.ts`, `packages/ui/src/components/skeleton.tsx` (moved), `packages/ui/src/components/logo.tsx`.
- Delete/retire: `apps/web/src/components/ui/skeleton.tsx` (re-export shim only if importers exist).

**New canonical catalog entries used**
- Env vars to register in §5 + `.env.example` first: `NEXT_PUBLIC_BRAND_NAME` (`Bitecodes`), `NEXT_PUBLIC_BRAND_PRIMARY_HSL` (`221 83% 53%`), `NEXT_PUBLIC_DEFAULT_THEME` (`light`). CSS custom properties are not canonical names.

**Acceptance criteria (testable)**
- `navigation.spec.ts` asserts exactly five primary items (Dashboard, Employees, Knowledge, Connectors, Settings); "More" expands to reveal the five demoted items.
- All legacy routes still resolve (deep-link test); `next.config.ts` redirects unchanged.
- A `viewer` stub hides `member`-floor items; an `admin` stub shows them (`roleAtLeast` unit test). **The stub defaults to `viewer`** — a unit test asserts the default is least-permissive.
- **Server-guard audit:** a documented check confirms every mutating endpoint on the five demoted pages already carries a server-side `@RequireRole` (or is read-only); this is recorded as the real boundary, with client nav gating explicitly cosmetic. Any unguarded mutation found is filed as a Phase-2 guard task.
- `pnpm --filter @bitecodes/ui test` passes; `Skeleton` renders without throwing.
- `pnpm -r typecheck` green; zero `PRISM` strings; zero `agent`→`employee` renames in routes/imports/tables/events.

**Risks/mitigations**
- *Role not yet server-sourced.* Mitigation: `viewer` default fails closed; the real source lands in Phase 2; nav gating is never the security boundary.
- *Moving `skeleton.tsx` breaks an importer.* Mitigation: grep importers first; re-export shim; typecheck gate.
- *Token additions regress dark mode.* Mitigation: mirror every token in `.dark`; per-theme smoke check.

---

## Phase 2 — Session context: `GET /v1/me`, `MeProvider`, entitlements, Connectors page

**Goal:** Replace hardcoded identity with a real role/workspace context, add the Connectors page, and make Phase 1's nav gating security-correct end to end.

**Scope**
- Add read-only `GET /v1/me` resolving `req.user` + `req.tenantContext` + `req.memberRole` (no new table, no event).
- Add `MeProvider`/`useMe()` (TanStack Query) in `apps/web/src/components/providers.tsx`; wire the workspace switcher to set `x-bitecodes-workspace` and refetch.
- Add `GET /v1/entitlements` returning `{ role, plan, features[], navItems[] }`; add `EntitlementMatrix`/`PermissionScope` shared types; add `<RoleGate minRole>` reusing `empty-state.tsx`. **Flagged decision honored:** `/v1/entitlements` embeds the `/v1/me` payload to avoid two round-trips, while `/v1/members/me/permissions` remains distinct (resolved scope set).
- Create the Connectors page backed by `connectorsApi` + `connectorRegistry.list()`; reconcile `authUrl` → `authorizationUrl`; move the OAuth callback redirect to `/app/connectors?connected=<type>`.
- Tighten `@RequireRole(...)` on mutating Employee/Connector handlers (see role-floor table below).

**Key files to change/create**
- Create: `apps/api/src/me/me.controller.ts`, `me.module.ts`, `apps/web/src/components/providers/me-provider.tsx`, `apps/web/src/lib/permissions.ts`, `apps/web/app/[locale]/app/connectors/page.tsx`, `apps/web/src/components/ui/role-gate.tsx`.
- Change: `apps/api/src/app.module.ts`, `apps/web/src/components/providers.tsx`, `apps/web/src/components/shell/sidebar.tsx` (consume `useMe`), `apps/web/src/lib/api-client.ts`, `apps/api/src/connector-oauth/connector-oauth.controller.ts`, `packages/shared/src/schemas/*`.

**New canonical catalog entries used**
- REST (§7): `GET /v1/me`, `GET /v1/entitlements`, `GET /v1/members/me/permissions`.
- Shared types: `EntitlementMatrix`/`EntitlementMatrixSchema`, `PermissionScope`/`PermissionScopeSchema`.

**Acceptance criteria (testable)**
- `GET /v1/me` returns role, active workspace, and workspace list for a seeded session (API e2e).
- Sidebar shows real identity (no "Demo Workspace"/"Test User" strings).
- Connectors page lists gmail/slack/x/linkedin/meta with connect/disconnect state and risk badges; "Connect" round-trips OAuth start to `authorizationUrl`.
- A `viewer` requesting an `admin`-floor page sees `<RoleGate>`; the server still returns `FORBIDDEN` for the underlying mutation.
- Typecheck + 5 API tests + `navigation.spec.ts`/`agents.spec.ts` pass.

**Risks/mitigations**
- *No-workspace fallback.* Mitigation: `/v1/me` mirrors the existing `if (!ctx.organizationId)` short-circuit and returns `workspaces: []`.
- *OAuth redirect drift.* Mitigation: align `authorizationUrl` in controller and `api-client.ts` in one change with a typed assertion.

---

## Phase 3 — Per-employee controls, scheduling, approval-by-email

**Goal:** Add activate/deactivate, bypass-permission, approval-gate, and plan-mode controls; per-agent cron scheduling (the existing mechanism); and wire the approval pause to email. **Hard prerequisite: Phase 0 must be merged** — the data-driven gate reads `employee_controls` through the real `resolve-run`, which only exists after Phase 0.

**Scope**
- Add `employee_controls` (1:1 with `agents`, two-clause RLS, `workspace_id` nullable) + enums `activation_state`, `approval_mode`; add `agent_runs.failure_reason`, `approvals.expires_at`. Mirror is automatic via the Phase-0 `@bitecodes/db` import (no hand-mirror).
- Replace the name-heuristic approval check in `agent.run.ts` with a data-driven gate reading `employee_controls` + `mcp_tools.approval_required`/`risk_class` (now possible because `resolve-run` loads the real agent); add `load-controls`, plan-mode gate, and `builtin:ask-user` pause.
- **Scheduling (Blocker 3 resolution):** implement **per-agent Inngest cron functions** from `agent_triggers` (type `schedule`) per BUILD_GUIDE §6; the cron handler emits `agent/run`. **No global `employee/scheduled-tick`.** Add daily run/cost caps + heartbeat read in the cron handler before emit.
- Fix `decide()` in `run.controller.ts` (real `runId`, parsed body, rejection path); add signed email approve/reject links (`APPROVAL_LINK_SECRET`); wire `EmailService` + `notifications` + `RunsGateway.emitApprovalCreated`.
- **Route collision (Major resolution):** add control toggles at **`POST /v1/agents/:id/controls/activate`** and **`…/controls/deactivate`** (NOT `:id/activate`) so they never collide with the existing `POST /v1/agents/:id/activate/:versionId` (verified at controller line 95).

**Key files to change/create**
- Change: `packages/db/src/schema/agents.ts`, `packages/db/src/rls/policies.sql`, `packages/db/scripts/setup-rls.sql`, `apps/api/src/inngest/agent.run.ts`, `apps/api/src/inngest/index.ts`, `apps/api/src/inngest-endpoint/inngest.controller.ts`, `apps/api/src/agent/agent.controller.ts` (+`agent.service.ts`), `apps/api/src/run/run.controller.ts`, `apps/api/src/email/email.service.ts`, `apps/api/src/gateway/runs.gateway.ts`, `packages/shared/src/schemas/agent.ts`.
- Create: a Drizzle migration adding the table/columns/enums (per-agent cron registration lives in the existing trigger path — no new fan-out function).

**New canonical catalog entries used**
- Table: `employee_controls`. Enums: `activation_state`, `approval_mode`. Columns: `agent_runs.failure_reason`, `approvals.expires_at`.
- Inngest: `employee/input.provided`. (**`employee/scheduled-tick` is NOT added.**)
- REST: `GET|PATCH /v1/agents/:id/controls`, `POST /v1/agents/:id/controls/activate`, `POST /v1/agents/:id/controls/deactivate`, `POST|GET|PATCH|DELETE /v1/agents/:id/triggers[/:triggerId]`, `GET /v1/approvals/:id/email-decision` (public, HMAC), `POST /v1/runs/:id/respond`.
- Shared: `EmployeeControlsSchema`, `ApprovalDecisionSchema`, `ScheduleTriggerConfigSchema`, `EmployeeInputSchema`. Env: `APPROVAL_LINK_SECRET`, `APPROVAL_LINK_TTL_HOURS`.

**Role floors (Major — RBAC resolution), registered in BUILD_GUIDE:**
- `PATCH /v1/agents/:id/controls` general fields → **member**.
- `PATCH …/controls` toggling `bypass_permission=true` OR `approval_mode='never'` → **owner-only** (or `admin` with `LICENSE_KEY`); enforced server-side via `@RequireRole` + a field-level guard, not client gating.
- `POST …/controls/activate` / `…/deactivate` → **member** (control toggle), distinct from version activation which stays **admin**.

**Acceptance criteria (testable)**
- A `paused` employee rejects new runs and is skipped by its per-agent cron (unit + e2e).
- A risky tool call with `bypass_permission=false` inserts an `approvals` row, transitions the run to `waiting_approval`, sends email, and resumes on `approval/decided`; with bypass it auto-approves and writes an `audit_logs` row.
- A schedule trigger `{cron:"* * * * *"}` advances `next_run_at` and emits `agent/run` via the **per-agent** cron.
- A `member` attempting to set `bypass_permission=true` receives `FORBIDDEN` (server-side); only owner succeeds.
- New table has the two-clause RLS in both SQL files; tenant-isolation test passes. Grep confirms no `employee/scheduled-tick`.

**Risks/mitigations**
- *Schema drift.* Mitigation: eliminated in Phase 0; the superset test guards regressions.
- *Runaway schedules/cost.* Mitigation: `max_runs_per_day` + `daily_cost_cap_usd` checked in the cron handler before emit.

---

## Phase 4 — Orchestration: hierarchy, task router, "wrong employee → divert"

**Goal:** Add the company org chart, a durable task router, and the conversational divert flow — additive over `agent/run`.

**Scope**
- Add `agent_relationships` (supervises/watches/delegates_to) + `routing_decisions` (two-clause RLS; `agent_relationships`/`routing_decisions` `workspace_id` nullable for org-level edges); add `agents.is_router`/`routing_keywords`/`supervisor_agent_id` and `agent_runs.parent_run_id`/`routing_decision_id`/`triggered_by_agent_id`.
- Add `orchestrationRouteFunction` (classify → persist → propose/auto-dispatch → `waitForEvent('orchestration/decided')` → emit `agent/run`) and `agentHandoffFunction`.
- Add `OrchestrationController` + REST; `orchestration.route` AI Controller action; `routing:proposed`/`routing:resolved` on the existing `/runs` namespace.
- **(Minor — watcher feed resolution):** define the watcher signal concretely — a `watches` edge surfaces `agent_messages` rows of `kind='observation'` scoped to the watched employee's runs, emitted on the existing `/runs` namespace as `conversation:message` to the watcher's subscribed room. Documented in BUILD_GUIDE so the feature is observable, not schema-only.
- Add the org-chart editor (admin+) and the inline divert card.

**New canonical catalog entries used**
- Tables: `agent_relationships`, `routing_decisions`. Enums: `agent_relationship_kind`, `routing_status`, `activation_state` (reused from Phase 3). Columns as above.
- Inngest: `orchestration/route`, `orchestration/decided`, `agent/handoff`. Action: `orchestration.route` (`confirm`, `server`). WS: `routing:proposed`, `routing:resolved`. REST: `POST /v1/orchestration/route`, `POST /v1/orchestration/decisions/:id`, `GET /v1/orchestration/decisions`, `POST|GET|DELETE /v1/agent-relationships[/:id]`. Shared: `RoutingResultSchema`, `RoutingDecisionSchema`, `AgentRelationshipSchema`, `OrchestrationDecidedSchema`. Env: `ORCHESTRATION_AUTODISPATCH_THRESHOLD` (`0.85`).

**Role floors (RBAC resolution):**
- `POST /v1/orchestration/route` → **member**. Auto-dispatch above threshold is **disabled for viewer-initiated requests** (always falls back to `proposed`).
- `POST|DELETE /v1/agent-relationships` (org-chart edits) → **admin**.

**Acceptance criteria (testable)**
- Asking the wrong employee yields `routing_decisions.status=proposed` and a `routing:proposed` WS emit; confirm/divert emits `agent/run` with `routing_decision_id` set.
- Default is **propose**, not auto-dispatch; auto-dispatch only fires above threshold with the org setting enabled, never for a `viewer`.
- A supervisor gate suspends a child run via the existing `approval/decided` primitive.
- A `watches` edge produces an `observation`-kind `agent_message` visible to the watcher over `/runs` (watcher-feed test).

**Risks/mitigations**
- *Auto-routing a destructive action to the wrong employee.* Mitigation: `proposed` default + setting gate + viewer exclusion.
- *Supervisor "edits" subordinate.* Mitigation: supervision modeled as a review/approval edge, never a write to immutable `agent_versions`.

---

## Phase 5 — Company chat, inter-agent message bus, live tracking

**Goal:** Add the unified company-chat surface, durable message bus, `/company` WebSocket namespace, and the run-step persistence the live feed depends on (the core of which landed in Phase 0).

**Scope**
- Add `conversations`, `conversation_messages` (with `embedding vector(1536)` + HNSW), `agent_messages` tables + enums (two-clause RLS; `conversations.kind='company'` is `workspace_id NOT NULL`; `agent_relationships`-style org-level rows stay nullable). Finalize per-step `run_steps` writes in `agent.run.ts`.
- Add `CompanyGateway` on `/company` with **session-verified room join** (resolves the WS tenant-leak hardening): `handleJoin` verifies Better Auth session membership before joining `ws:<workspaceId>`, mirroring `TenantGuard`; the same check is added to the `/runs` join path.
- Add `company/message.posted`, `company/handoff.requested`, `company/message.learned` events + handlers; `CompanyController` REST; `company.message`/`company.open` actions.
- Build the chat UI route, a real `socket.io` client provider, and the live trace rail.

**New canonical catalog entries used**
- Tables/enums: `conversations`, `conversation_messages`, `agent_messages`; `conversation_kind`, `message_author_type`, `message_role`, `agent_message_kind`, `handoff_status`. (Collision note: the durable bus is **`agent_messages`**; handoff queue semantics fold in via `agent_message_kind='handoff'` — `agent_handoffs` is **not** a separate table; `GET /v1/agent-handoffs` reads `agent_messages WHERE kind='handoff'`.)
- Inngest: `company/message.posted`, `company/handoff.requested`, `company/message.learned`. WS: `/company` → `company:message|typing|handoff|divert`; `conversation:message` on `/runs`. REST: `GET|POST /v1/conversations[...]`, `GET /v1/conversations/company`, `GET /v1/agent-handoffs`. Actions: `company.message` (`confirm`, `server`), `company.open` (`safe`, `browser`). Env: `COMPANY_CHAT_MAX_HANDOFF_DEPTH` (`5`).

**Role floors (RBAC resolution):**
- `POST /v1/conversations/:id/messages` and `company.message` → **member** (a `viewer` cannot post a message that could auto-dispatch a destructive employee).

**Acceptance criteria (testable)**
- Posting a user message persists a row, emits `company/message.posted`, renders live over `/company`; reconnect backfills from REST.
- A handoff produces a child `agent_runs` row with `parent_run_id`; chat renders nested threads.
- `/company` join **rejects a socket without verified workspace membership**; the same rejection holds on `/runs`.
- A `viewer` POST to `/v1/conversations/:id/messages` returns `FORBIDDEN`.
- Recursive handoffs are capped by `COMPANY_CHAT_MAX_HANDOFF_DEPTH`.

**Risks/mitigations**
- *Single company conversation as firehose.* Mitigation: persist work in `task` conversations; render the singleton as a filtered projection.
- *WS tenant leakage.* Mitigation: membership check on join, mirroring `TenantGuard`.

---

## Phase 6 — Memory & learning loop (RAG, not fine-tuning)

**Goal:** Make employees accumulate durable memory and learn from corrections via a curated RAG feedback loop with a **measurable** success criterion.

**Scope**
- Extend `agent_memories` with `kind`/`visibility`/`source_run_id`/`salience`; bootstrap `CREATE EXTENSION IF NOT EXISTS vector` + HNSW indexes (raw SQL) in a migration.
- Implement `DrizzleMemoryStore` (replaces `NoOpMemoryStore`); wire layered prompt assembly (`load-memory` step) into `agent.run.ts`.
- Add `memory/consolidate` cron + on-thread-close handler with a curation/dedup gate before promoting to `long_term`.
- **(Minor — learning eval resolution):** replace the vague "biases the next routing decision" criterion with a concrete, testable one (below).
- Fix the existing org-only RLS drift on memory tables to the two-clause form (workspace-visible memories scoped; `visibility='organization'` rows use `workspace_id IS NULL`).

**New canonical catalog entries used**
- Columns: `agent_memories.kind|visibility|source_run_id|salience`. Enums: `memory_kind`, `memory_visibility`. Inngest: `memory/consolidate`. REST: `GET /v1/agents/:id/memories`, `DELETE /v1/agents/:id/memories/:memoryId`. Env: `MEMORY_RETENTION_DAYS` (90), `MEMORY_LONGTERM_TOPK` (5), `CONVERSATION_WINDOW_MESSAGES` (20).

**Acceptance criteria (testable)**
- Fresh DB bootstraps pgvector + HNSW without error; tenant-scoped cosine recall returns rows inside `withTenant`.
- **Measurable learning test:** after a divert correction (Phase 4) writes a `long_term` memory with `source_run_id`, an identical subsequent request yields `routing_decisions.status=confirmed` for the corrected employee **without human input** (retrieval-influence assertion), proving the loop changes behavior.
- Raw turns are not auto-promoted without passing the consolidation gate.
- A `member`-deleted memory (`DELETE …/memories/:id`) is gone from recall.

**Risks/mitigations**
- *Memory poisoning.* Mitigation: explicit `memory/consolidate` curation/dedup gate; `salience`-ranked decay.
- *Workspace leakage in recall.* Mitigation: two-clause RLS on memory tables (fixing the existing org-only drift).

---

## Phase 7 — Onboarding, beginner UX, sellability

**Goal:** Make a new user productive in under 60 seconds, hide advanced config behind progressive disclosure, and package plan/white-label gating.

**Scope**
- Server-owned onboarding checklist. **Open decision resolved:** use the `onboarding_states` table (resumable, RLS-registered) rather than a `settings` row, and register its two-clause RLS in both SQL files before migrating. `GET /v1/onboarding` + `POST /v1/onboarding/advance`; `onboarding/completed` emitted from the `run/finished` handler (now real after Phase 0).
- `OnboardingWizard` reusing the template grid + `agentsApi.create`; `ChecklistDock`; layout redirect gate.
- `<DisclosureSection>` primitive + three-level disclosure on the Employee editor; `ux.disclosure_mode` setting.
- `useEntitlements()`/`<RequirePermission>`/`<UpgradeNudge>` plan + white-label gating; Branding tab writing `organizations.branding`.

**New canonical catalog entries used**
- Table: `onboarding_states` (two-clause RLS, both SQL files). Enum: `onboarding_step`. Settings keys: `onboarding.state`, `ux.disclosure_mode`. Inngest: `onboarding/completed`. REST: `GET /v1/onboarding`, `POST /v1/onboarding/advance`. Action: `onboarding.next` (`safe`, `browser`). Shared: `OnboardingState`/`OnboardingStateSchema`, reuse `EntitlementMatrix`. Env: none new (reuse `LICENSE_KEY`, `SUPERADMIN_EMAILS`).

**Acceptance criteria (testable)**
- Signup → hire employee → first successful run advances the checklist; completion survives a mid-run refresh (server-owned state).
- Beginners never see advanced fields; promoting sandbox→production unlocks Standard controls.
- Plan-gated/`NOT_LICENSED` features render `<UpgradeNudge>`, not a hard crash.
- Extended Playwright specs assert the onboarding redirect and the 5-item nav.

**Risks/mitigations**
- *RLS drift if `onboarding_states` is added.* Mitigation: the table decision is now fixed; register two-clause RLS in both SQL files (Phase-0 template).
- *Onboarding state diverging from durable run.* Mitigation: advance from the `run/finished` handler, not the browser.

---

# PHASE 0 — DETAILED FILE-LEVEL PLAN (new; the blocker-clearing prerequisite)

| # | File (absolute) | New/Change | One-line description |
|---|---|---|---|
| 1 | `/Users/yashcomputers/Desktop/Bitecodes/apps/api/src/drizzle/drizzle.service.ts` | Change | Delete inline enums/tables/`appSchema` (lines 18–200); import the schema barrel from `@bitecodes/db` and re-export as `appSchema`. **Resolves Blocker 1.** |
| 2 | `/Users/yashcomputers/Desktop/Bitecodes/apps/api/test/drizzle-schema-superset.spec.ts` | New | CI test: every table referenced by API queries is a key on the imported `appSchema`. |
| 3 | `/Users/yashcomputers/Desktop/Bitecodes/apps/api/src/inngest/agent.run.ts` | Change | Real `resolve-run` (withTenant load of run+agent+active version), real `finalize` persistence + `run/finished` emit, real `create-approval` insert. **Resolves Blocker 2.** No placeholder IDs. |
| 4 | `/Users/yashcomputers/Desktop/Bitecodes/docs/BUILD_GUIDE.md` | Change | §6: reaffirm per-agent cron mechanism; **delete `employee/scheduled-tick`**. Add the canonical two-clause RLS policy template. **Resolves Blocker 3 + RLS-form major.** |
| 5 | `/Users/yashcomputers/Desktop/Bitecodes/packages/db/src/rls/policies.sql` | Change | Add the two-clause policy template + comment block documenting the `workspace_id IS NULL OR …` form for all new tables. |
| 6 | `/Users/yashcomputers/Desktop/Bitecodes/packages/db/scripts/setup-rls.sql` | Change | Mirror the same two-clause template; flag existing org-only tables for a separate retrofit task. |

**Phase 0 gates:** `pnpm -r typecheck`, the new superset test, the existing 5 API tests, and a tenant-isolation test all pass; grep confirms zero `*-placeholder` tenant IDs in `agent.run.ts` and zero `employee/scheduled-tick` references.

---

# PHASE 1 — DETAILED FILE-LEVEL PLAN

| # | File (absolute) | New/Change | One-line description |
|---|---|---|---|
| 1 | `/Users/yashcomputers/Desktop/Bitecodes/docs/BUILD_GUIDE.md` | Change | Add `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_BRAND_PRIMARY_HSL`, `NEXT_PUBLIC_DEFAULT_THEME` to §5 (catalog-first). |
| 2 | `/Users/yashcomputers/Desktop/Bitecodes/.env.example` | Change | Add the same three `NEXT_PUBLIC_*` vars with defaults. |
| 3 | `/Users/yashcomputers/Desktop/Bitecodes/apps/web/src/lib/rbac.ts` | New | `RoleRank` mirroring verified server `ROLE_RANK` (owner4/admin3/member2/viewer1) + `roleAtLeast`. |
| 4 | `/Users/yashcomputers/Desktop/Bitecodes/apps/web/src/components/shell/sidebar.tsx` | Change | 9-item array → role-filtered `PRIMARY_NAV`(5) + collapsible `MORE_NAV`(5); `Bot`→`Users`; `<span>B</span>`→`<Logo/>`; `useMe()` stub **defaults to `viewer`** (fail-closed). |
| 5 | `/Users/yashcomputers/Desktop/Bitecodes/apps/web/app/[locale]/app/agents/page.tsx` | Change | Flip H1/empty-state "Agents"→"Employees"; keep `href` and `agentsApi.list()` untouched. |
| 6 | `/Users/yashcomputers/Desktop/Bitecodes/apps/web/src/styles/globals.css` | Change | §2.2 tokens (light + `.dark`), §3 type-scale, `prefers-reduced-motion` guard. |
| 7 | `/Users/yashcomputers/Desktop/Bitecodes/packages/ui/src/components/button.tsx` | Change | `rounded-md`→`rounded-xl` (incl. `sm`/`lg`); add `success`/`warning` cva variants. |
| 8 | `/Users/yashcomputers/Desktop/Bitecodes/packages/ui/src/components/skeleton.tsx` | New | Moved; import `cn` from `../lib/utils` (fixes broken `@/lib/utils`). |
| 9 | `/Users/yashcomputers/Desktop/Bitecodes/apps/web/src/components/ui/skeleton.tsx` | Delete | Remove after move; re-export shim only if importers exist. |
| 10 | `/Users/yashcomputers/Desktop/Bitecodes/packages/ui/src/components/logo.tsx` | New | Theme-aware `<Logo>` reading `--color-primary` for white-label. |
| 11 | `/Users/yashcomputers/Desktop/Bitecodes/packages/ui/src/index.ts` | Change | Export `Skeleton` and `Logo`. |
| 12 | `/Users/yashcomputers/Desktop/Bitecodes/apps/web/app/[locale]/layout.tsx` | Change | Seed `next-themes` `defaultTheme` from `NEXT_PUBLIC_DEFAULT_THEME`. |
| 13 | `/Users/yashcomputers/Desktop/Bitecodes/apps/web/e2e/navigation.spec.ts` | Change | Assert five primary items, "More" reveals five demoted, all legacy routes resolve. |
| 14 | `/Users/yashcomputers/Desktop/Bitecodes/packages/ui/src/__tests__/` | New | `Skeleton` render test + `roleAtLeast` unit test (incl. a test that the stub defaults to least-permissive `viewer`). |

**Phase 1 gates:** `pnpm --filter @bitecodes/ui test`, `pnpm -r typecheck`, and `navigation.spec.ts` pass; grep confirms zero `PRISM` strings and zero `agent`→`employee` renames in routes/imports/tables/events; the server-guard audit on the five demoted pages is recorded.

---

## Tone Check (Warm but Authoritative)
- **Warmth: 3/5** — the beginner-first "Employees" framing and onboarding intent remain, though this is an engineering artifact by necessity.
- **Authority: 5/5** — every blocker and major is resolved against verified file paths and line numbers (`drizzle.service.ts` L194, `agent.run.ts` L41–53/131/179, BUILD_GUIDE §6 L205, `agent.controller.ts` L95, org-only RLS, `ROLE_RANK` 4/3/2/1); the scheduling contradiction is reconciled to the existing mechanism; new names stay quarantined to "register in BUILD_GUIDE first."
- **Net:** On-brand for an internal implementation roadmap. Formal English, active voice, no contractions, no emojis.

---

## Adversarial review summary

**Verdict:** CONDITIONAL GO — the catalog discipline and phase ordering are fundamentally sound and the proposal correctly self-identifies the two worst latent bugs (org-only RLS, unauthenticated WS join). However, eight concrete defects must be resolved before coding starts. Three are blockers: (1) the proposal repeatedly instructs mirroring new tables into a "drizzle.service.ts inline appSchema" that is in fact a hand-redefined minimal subset which already OMITS existing dependency tables (agent_triggers, approvals, run_steps, agent_memories, mcp_tools), so Phases 3/5/6 will not compile or query as written; (2) the entire control/approval/learning/live-tracking vision is layered on an agent.run executor that is ~90% stubbed (placeholder tenant IDs, no persistence, name-heuristic approval) — Phase 3 acceptance criteria assume persistence that does not exist; (3) the canonical "scheduled trigger" mechanism already exists in BUILD_GUIDE §6 (per-agent cron emitting agent/run) and the new employee/scheduled-tick fan-out contradicts it without reconciling. The remaining five are major/minor naming, RBAC-coverage, and modularity gaps. Net: proceed, but treat the flagged items as gating fixes, not "by the way" notes.

| Severity | Area | Problem | Fix |
|---|---|---|---|
| blocker | Schema drift / modularity (drizzle.service.ts) | Both the catalog and roadmap repeatedly state new tables/columns must be 'mirrored into the inline appSchema in apps/api/src/drizzle/drizzle.service.ts.' I verified that file: it is NOT a faithful mirror of packages/db. It hand-redefines enums (roleEnum, agentModeEnum, runStatusEnum...) and a MINIMAL table subset; its exported appSchema (line 194) contains only organizations, workspaces, memberships, invitations, agents, agentVersions, agentRuns, knowledgeBases, documents, brandVoices, contentItems, auditLogs. It OMITS agent_triggers, approvals, run_steps, agent_memories, connectors, mcp_tools — all of which Phases 3/5/6 query through the typed db client. The new tables (employee_controls, conversations, agent_messages, etc.) plus these missing prerequisites must all be added or the typed queries will not exist at compile time. | Before Phase 3, add a gating task: register every NEW and every EXISTING-but-missing dependency table/enum/column into the drizzle.service.ts inline schema AND appSchema export, and add a CI check (drizzle.service appSchema keys ⊇ tables referenced by api queries). Better: refactor drizzle.service.ts to import from @bitecodes/db to eliminate the third drift source entirely, and flag that refactor as an explicit Phase 2 prerequisite rather than an inline 'mirror' footnote. |
| blocker | Stubbed executor vs. Phase 3 acceptance criteria | agent.run.ts is ~90% stubbed: step 'resolve-run' returns hardcoded org-placeholder/ws-placeholder/agent-placeholder (no withTenant, no DB read); 'finalize' persists nothing (all TODO); approval check is the name-heuristic toName.includes('delete'\|\|'send'); create-approval returns a fake id and never inserts. Phase 3's acceptance criteria ('creates an approvals row, transitions the run to waiting_approval, sends email, resumes on approval/decided') and Phase 5's live-feed all presuppose real persistence and a real run/agent resolve that DO NOT EXIST. The roadmap defers this to a one-line Phase-3 'mitigation' and 'flag remaining stubs as Phase 5' — but the controls gate in Phase 3 cannot read employee_controls if resolve-run never loads a real agent. | Insert a hard prerequisite at the start of Phase 3: implement real resolve-run (withTenant query for agent+activeVersion+employee_controls), real agent_runs/run_steps/approvals persistence, and the run/finished emit, BEFORE wiring the data-driven approval gate. Make 'no placeholder tenant IDs remain in agent.run.ts' an explicit acceptance criterion. |
| blocker | Naming/mechanism collision — scheduling | BUILD_GUIDE §6 already defines the canonical scheduling mechanism: 'Scheduled triggers (agent_triggers of type schedule) create per-agent Inngest cron functions; the cron handler emits agent/run.' The proposal introduces a NEW single fan-out event employee/scheduled-tick that reads agent_triggers and emits agent/run — a different architecture (one global cron vs. per-agent cron) for the same job. This is an un-reconciled contradiction with an existing canonical statement, violating golden rule #1's spirit (do not redefine existing mechanisms) and risking double-firing if both exist. | Reconcile in BUILD_GUIDE before Phase 3: either (a) amend §6 to replace per-agent crons with the single employee/scheduled-tick fan-out and document the migration, or (b) drop employee/scheduled-tick and implement per-agent crons as already specified. Pick one and record the decision; do not let both mechanisms coexist. |
| major | Route catalog collision — POST /v1/agents/:id/activate | The proposal adds POST /v1/agents/:id/activate (control toggle) alongside the EXISTING POST /v1/agents/:id/activate/:versionId (version activation, verified in agent.controller.ts line 95 and BUILD_GUIDE §7 line 219). NestJS path matching for /:id/activate vs /:id/activate/:versionId is distinguishable, but the two are semantically confusable, and the catalog only 'documents both' without specifying ordering/guard separation. activateVersion is an admin-to-production action; the new activate is a member-level control toggle — mixing them under near-identical paths invites an RBAC mistake. | Rename the control toggle to a non-colliding, intent-clear path, e.g. POST /v1/agents/:id/controls/activate and /controls/deactivate (or fold into the existing PATCH /v1/agents/:id/controls body), register it in BUILD_GUIDE §7, and keep version activation untouched. Apply distinct @RequireRole guards (member for control toggle, admin for version-to-production). |
| major | Tenant/RLS isolation — two-clause policy on writes | Confirmed: existing policies.sql uses a SINGLE org-only clause (organization_id = current_setting('app.current_org')) with no workspace clause, and tenantColumns() makes workspace_id NULLABLE. The proposal correctly flags this and mandates 'two-clause (org AND workspace) RLS' on all new tables. But a two-clause WITH CHECK that requires workspace_id = current_setting('app.current_workspace') will REJECT inserts of legitimately workspace-null/org-level rows (e.g. a kind='company' conversation is per-workspace, but agent_relationships or org-visibility memories may be org-level). A naive AND policy breaks org-scoped rows and diverges from every existing table's policy, creating inconsistent isolation semantics across the schema. | Specify the exact policy form before migrating: USING/WITH CHECK = (organization_id = org) AND (workspace_id IS NULL OR workspace_id = current_setting('app.current_workspace')). Decide per-table whether workspace_id is NOT NULL (company chat) or nullable (org-level relationships/memories). Add the same form to setup-rls.sql. Also flag retrofitting the existing org-only tables as a separate hardening task so isolation is uniform, not split between 'old org-only' and 'new two-clause' tables. |
| major | RBAC coverage gap — per-employee controls and company chat | Requirement #2 demands RBAC across 'every per-employee control,' and #5/#8 demand a fully tracked company chat. The plan adds @RequireRole on mutating handlers and a @RequireScope('employee:bypass'), but: (a) there is no defined guard for WHO may post into company chat / trigger orchestration.route (a viewer posting a message that auto-dispatches a destructive employee bypasses intent); (b) bypass_permission and approval_mode='never' on employee_controls are extremely high-privilege toggles with no stated owner-only gate; (c) the existing rbac.guard.ts ROLE_RANK is the only enforcement and the proposal's client roleAtLeast mirror is explicitly 'cosmetic, never the security boundary' — but no server guard is specified for the new conversation POST or controls PATCH bypass field. | In BUILD_GUIDE, define explicit role floors: company.message/POST conversations = member; PATCH controls toggling bypass_permission or approval_mode='never' = owner-only (or admin with LICENSE_KEY); orchestration auto-dispatch above threshold disabled for viewer-initiated requests. Add server-side guards as acceptance criteria, not just client nav gating. |
| minor | Missing-vision coverage — supervisor 'watch' is modeled but observability of the watch is underspecified; learning-from-inputs lacks an eval gate | Vision #4 (an employee supervises/WATCHES others) and #5 (LEARN from inputs) are partially addressed: agent_relationships has a 'watches' edge and memory/consolidate has a curation gate. But the plan does not specify HOW a 'watch' edge produces a live observable signal (no agent_message_kind for a passive observation feed tied to the watcher's view beyond the generic 'observation' enum value), and the learning loop has no measurable success criterion — 'biases the next routing decision' (Phase 6 AC) is asserted but untestable without a defined retrieval-influence metric. Risk: these flagship features ship as schema with no demonstrable behavior. | Add to Phase 4/6: define the watcher feed (which conversation/agent_messages rows a 'watches' edge surfaces, and on which WS event), and replace the vague Phase 6 AC with a concrete test (e.g., 'after a divert correction memory is written, an identical subsequent request yields routing_decisions.status=confirmed for the corrected agent without human input'). Without it, the supervision and learning requirements are not verifiably met. |
| minor | Phase ordering / dependency — Phase 1 nav gating ships before its data source | Phase 1 gates nav by role using a temporary useMe() stub that defaults to 'the most-permissive role.' This ships a cosmetic RBAC boundary that defaults OPEN (most-permissive) for a full phase before Phase 2 delivers /v1/me. Combined with the kept-but-demoted pages (Workflows, Content, Inbox, Marketplace, Analytics) still being directly route-accessible, a viewer in the Phase-1 window sees all nav items. The roadmap calls this 'cosmetic-only, never the security boundary,' which is correct, but the demoted pages have their own mutating actions whose server guards are only tightened in Phase 2/3. | Default the Phase-1 stub to the LEAST-permissive role (viewer) so nav fails closed, and confirm the five demoted pages' existing mutating endpoints already carry server-side @RequireRole before Phase 1 ships (or accept that they are read-mostly). Document that page-level <RoleGate> (Phase 2) and server guards are the real boundary, and that no destructive action on a demoted page is reachable without a server guard during the Phase-1→2 gap. |
