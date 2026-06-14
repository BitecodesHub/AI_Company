# Bitecodes — AI Company Redesign: Architecture & Subsystem Design

_Generated 2026-06-13 · v1 · Stage-1 design workflow (18 agents)._

> Locked decisions: "Employees" is a UI label only (code stays `agent`); brand name stays **Bitecodes** with an Apple-grade restyle; the 5 dropped pages are demoted into a "More" group / merged, not deleted; full autonomous build authorized.


---

## Executive summary

This section redefines the Bitecodes navigation around five primary destinations — **Dashboard, Employees, Knowledge, Connectors, Settings** — without renaming any route, table, Inngest event, or AI Controller action. "Employees" is a presentation-layer label over the existing `/app/agents` routes and the `agents` table. The five legacy pages (Workflows, Content, Inbox, Marketplace, Analytics) are kept and remain reachable, but are demoted into a secondary "More" group and/or merged into the primary five so nothing breaks. Navigation visibility, page access, and per-employee controls are gated by the existing four-role hierarchy (`owner > admin > member > viewer`) surfaced through one new read-only context endpoint. A beginner-first progressive-disclosure pattern hides advanced configuration behind an "Advanced" affordance everywhere. Connectors gains a real page (none exists today) backed by `@bitecodes/connectors` and the existing `/v1/connectors/*` OAuth controller.

All work is concentrated in `apps/web`. The only backend addition is one new canonical REST route (`GET /v1/me`) to feed role and workspace context to the client; it must be added to `docs/BUILD_GUIDE.md §7` before implementation.

---

## 1. The five primary destinations

| # | Primary label (UI) | Route (unchanged) | Maps to existing page | Role floor (visible) |
|---|---|---|---|---|
| 1 | Dashboard | `/app/dashboard` | `apps/web/app/[locale]/app/dashboard/page.tsx` | `viewer` |
| 2 | **Employees** | `/app/agents` | `apps/web/app/[locale]/app/agents/page.tsx` (+ `/new`, `/[id]`) | `viewer` |
| 3 | Knowledge | `/app/knowledge` | `apps/web/app/[locale]/app/knowledge/page.tsx` | `member` |
| 4 | Connectors | `/app/connectors` | **NEW page** (see §6) | `member` |
| 5 | Settings | `/app/settings` | `apps/web/app/[locale]/app/settings/page.tsx` | `member` |

**Hard guarantee on naming:** "Employees" is a label only. `agentsApi` (`apps/web/src/lib/api-client.ts:112`), the `/app/agents/*` route segment, the `agents`/`agent_versions`/`agent_runs` tables, the `agent/run` Inngest event, and the `agent.run`/`agent.create`/`agent.open` AI Controller actions all keep their names. The label substitution lives entirely in the nav config and page copy. Page H1s flip from "Agents" to "Employees" (e.g. `apps/web/app/[locale]/app/agents/page.tsx:24` and the empty-state copy on lines 51–54), but `href="/app/agents/new"` and `agentsApi.list()` are untouched.

---

## 2. Disposition of the five demoted pages

All routes stay live; the legacy `next.config.ts` redirect array (`apps/web/next.config.ts:4-7`) and bare-route redirects remain intact, so existing bookmarks and `command-palette.tsx` deep-links keep working. The mapping:

| Legacy page | Route | Disposition | Rationale |
|---|---|---|---|
| Workflows | `/app/workflows` (+ `/new`, `/[id]`) | **"More" group** + surfaced as an "Advanced" tab inside an Employee detail (orchestration belongs to the company/hierarchy story) | Workflow detail is still a placeholder; demote, do not delete. |
| Content | `/app/content` | **"More" group**, also linkable from an Employee whose role is content/social | Keeps `contentApi` + `content/generate` event reachable. |
| Inbox | `/app/inbox` | **"More" group**; later merges into the unified company-chat surface (out of scope here) | Keeps `inboxApi` + `/inbox` WS namespace reachable. |
| Marketplace | `/app/marketplace` | **Merge into Employees** as a "Hire from template / Browse templates" entry point; keep `/app/marketplace` route as the destination | The Agents empty-state already links to `/app/marketplace` (`agents/page.tsx:61`). Reframe as "hiring." |
| Analytics | `/app/analytics` | **Merge into Dashboard** as a tab/section; keep `/app/analytics` route reachable from there | `analyticsApi` already reads `/v1/runs` + billing; no new surface needed. |

"More" is a collapsible secondary group at the bottom of the sidebar nav (above the footer), not a separate top-level item — it keeps the primary list to exactly five.

---

## 3. Sidebar implementation (`apps/web/src/components/shell/sidebar.tsx`)

Replace the single hardcoded `navItems` array (`sidebar.tsx:14-24`) with two role-aware groups and render them through a shared map. Concrete structure:

```tsx
// roleAtLeast(userRole, floor) using the same ranks as rbac.guard.ts
const PRIMARY_NAV = [
  { href: '/app/dashboard',  icon: LayoutDashboard, label: 'Dashboard',  exact: true, minRole: 'viewer' },
  { href: '/app/agents',     icon: Users,           label: 'Employees',               minRole: 'viewer' }, // label-only rename
  { href: '/app/knowledge',  icon: BookOpen,        label: 'Knowledge',               minRole: 'member' },
  { href: '/app/connectors', icon: Plug,            label: 'Connectors',              minRole: 'member' },
  { href: '/app/settings',   icon: Settings,        label: 'Settings',                minRole: 'member' },
];
const MORE_NAV = [
  { href: '/app/workflows',   icon: Workflow,  label: 'Workflows',   minRole: 'member' },
  { href: '/app/content',     icon: Rss,       label: 'Content',     minRole: 'member' },
  { href: '/app/inbox',       icon: Inbox,     label: 'Inbox',       minRole: 'member' },
  { href: '/app/marketplace', icon: Store,     label: 'Templates',   minRole: 'member' },
  { href: '/app/analytics',   icon: BarChart2, label: 'Analytics',   minRole: 'viewer' },
];
```

- Swap the `Bot` icon for `Users` (lucide-react) on the Employees item to reinforce the "people" metaphor; keep `Bot` for individual employee avatars.
- Active-state logic (`sidebar.tsx:72-73`, exact vs `startsWith`) is reused unchanged. Note `/app/agents` `startsWith` still highlights "Employees" on `/app/agents/[id]` — correct.
- The "More" group renders a `ChevronDown` collapse control; default collapsed for `viewer`/`member`, expandable. Items filtered by `roleAtLeast(userRole, item.minRole)`.
- Replace hardcoded identity (`sidebar.tsx:60-61` "Demo Workspace", `:102-103` "Test User"/"test@bitecodes.com") with values from the new `MeProvider` (§5). The workspace switcher button (`:54-65`) binds to `workspacesApi.list()`.
- The non-functional "AI Controller" button (`sidebar.tsx:91-95`) and the unmounted `CommandPalette` (`command-palette.tsx`) are out of scope for this IA task but should be mounted in `apps/web/app/[locale]/app/layout.tsx` so ⌘K works; the palette's hardcoded command list (`command-palette.tsx:8-28`) should be filtered by the same role helper.

---

## 4. Role-based access (RBAC) across nav, pages, and controls

Three enforcement layers, all keyed to the existing `RoleSchema` (`packages/shared/src/enums.ts:10`) and the rank map already in `apps/api/src/common/guards/rbac.guard.ts:16-21`:

1. **Nav visibility (client):** each nav item carries `minRole`; the sidebar filters with a shared `roleAtLeast(current, floor)` helper that mirrors `ROLE_RANK`. This is cosmetic only — never the security boundary.
2. **Page access (client guard + server guard):** the authed shell layout (`apps/web/app/[locale]/app/layout.tsx`) reads role from `MeProvider`; a small `<RoleGate minRole=…>` wrapper renders a "You don't have access" empty state (reuse `apps/web/src/components/ui/empty-state.tsx`) instead of the page body when the role is insufficient. The real boundary stays server-side: API handlers keep using `@RequireRole(...)` via `RbacGuard`. Mutating Employee/Connector endpoints should be decorated `@RequireRole('member')` (create/run) and `@RequireRole('admin')` (delete/activate-to-production); Settings org/billing stay `@RequireRole('owner')`.
3. **Per-employee controls (client + server):** activate/deactivate, bypass-permission, approval-gate, and plan-mode toggles on the Employee detail page render disabled for `viewer`, enabled-with-confirm for `member`, and fully enabled for `admin`+. Each maps to a server endpoint already guarded by `@RequireRole`.

To feed layers 1–2, the client needs the current member's role and active workspace, which **no endpoint returns today** (confirmed: there is no `/v1/me`/whoami controller; `TenantGuard` sets `req.tenantContext` + `req.memberRole` but never exposes them). This requires the new route in §7.

---

## 5. Client context provider: `MeProvider`

Add `apps/web/src/components/providers/me-provider.tsx` ('use client'), mounted inside `apps/web/src/components/providers.tsx` (which already wires TanStack Query). It calls the new `GET /v1/me` once, caches it in Query, and exposes `useMe()` returning `{ user, organization, workspace, role, workspaces }`. The sidebar, `RoleGate`, and the workspace switcher all consume this — eliminating every hardcoded identity string in `sidebar.tsx`. Switching workspace updates the `x-bitecodes-workspace` header used by `api-client.ts:37` and refetches `/v1/me`.

---

## 6. New Connectors page (`apps/web/app/[locale]/app/connectors/`)

There is no Connectors page today. Create `apps/web/app/[locale]/app/connectors/page.tsx` ('use client'), backed by the existing `connectorsApi` (`apps/web/src/lib/api-client.ts:173-178`) and the existing `ConnectorOauthController` (`apps/api/src/connector-oauth/connector-oauth.controller.ts`), which already serves `/v1/connectors`, `/v1/connectors/:type/oauth/start`, `/v1/connectors/:type/oauth/callback`.

Layout:
- **Available connectors grid** sourced from `@bitecodes/connectors` `connectorRegistry.list()` (gmail, slack, x, linkedin, meta) — display `displayName`, `authKind`, and a connect/disconnect state derived from `connectorsApi.list()`. The registry is the source of truth so the UI never invents connector names.
- **Connect flow:** "Connect" calls `connectorsApi.oauthStart(type)` → redirect to `authorizationUrl` (note: the controller returns `authorizationUrl` on `:type/oauth/start` at `connector-oauth.controller.ts:25`, while `api-client.ts:175` types it as `authUrl` — reconcile to `authorizationUrl` when wiring). The OAuth callback already redirects back to `/settings/connectors?connected=<type>` (`connector-oauth.controller.ts:40`); update that destination to `/app/connectors?connected=<type>` and show a success toast (sonner is already provisioned).
- **Risk surfacing:** each action's `riskClass` (`read`/`write`/`destructive` from `connector.interface.ts:58`) renders as a badge so beginners see which connectors can take destructive actions — feeds the approval-gate story.
- **Per-connector disconnect** uses `connectorsApi.remove(id)` (`@RequireRole('member')` server-side).

---

## 7. Progressive disclosure (beginner-first "essential configs only")

A single, reusable pattern applied to every form-bearing page (Employee create/detail, Connectors, Settings):

- **Essentials always visible.** For an Employee that is: name, role, goal — i.e. the top of `AgentInputSchema` (`packages/shared/src/schemas/agent.ts`). Everything else (cost tier, mode, tools[], knowledgeBaseIds[], approvalRequiredFor[], guardrails{piiMask, promptInjectionScan, maxCostUsdPerRun}) is **advanced**.
- **Advanced behind a disclosure.** A `<details>`-style "Advanced settings" expander (reuse `@bitecodes/ui` primitives, e.g. `Tabs`/`Sheet`) collapsed by default. Defaults pre-filled so a beginner can create a working Employee without opening it: `costTier: 'auto'`, `mode: 'sandbox'`, empty tools/KB, guardrails on.
- **Component:** add `apps/web/src/components/ui/disclosure.tsx` (small, reuses `cn` from `@bitecodes/ui`). Note: `apps/web/src/components/ui/skeleton.tsx` currently imports a non-existent `@/lib/utils`; new UI primitives must import `cn` from `@bitecodes/ui` instead to avoid the same broken resolution.
- **Role interaction:** advanced controls also respect `minRole` — a `member` sees but cannot edit `mode: production` (that is `admin`+), shown as disabled with a tooltip.

---

## 8. Modularity & wiring summary

- Nav config (`PRIMARY_NAV`/`MORE_NAV`) lives beside the sidebar; a single `roleAtLeast` helper (new `apps/web/src/lib/rbac.ts`) is shared by sidebar, `RoleGate`, and `CommandPalette` so role logic is defined once and mirrors the server `ROLE_RANK`.
- No route renaming: every demoted page keeps its `/app/<page>` path and its `next.config.ts` redirect.
- Server boundary unchanged in shape (guard chain `AuthGuard → TenantGuard → RbacGuard`); only `@RequireRole` decorators are added/tightened on mutating Employee/Connector handlers.

---

## New canonical names (add to `docs/BUILD_GUIDE.md` BEFORE coding)

Per golden rule #1 ("never invent a name"), the following must be appended to the canonical catalogs first.

**REST routes (`docs/BUILD_GUIDE.md §7`):**

| Domain | Route |
|---|---|
| Session/Me | `GET /v1/me` — returns the authenticated user, active organization, active workspace, the caller's `role` in that workspace, and the list of workspaces the user belongs to. Read-only; resolves entirely from `req.user` + `req.tenantContext` + `req.memberRole` set by the existing guards. New controller: `apps/api/src/me/me.controller.ts` (`@Controller('v1/me')`). No new table, no new event. |

**No new tables, columns, Inngest events, WebSocket namespaces, AI Controller actions, or env vars are introduced by this IA/navigation work.** "Employees" reuses every existing `agent*` name. Connectors reuses `/v1/connectors/*` and `@bitecodes/connectors`. The demoted pages reuse their existing routes and APIs.

> Implementation note to reconcile in the same PR (not new names, but existing drift): `connectorsApi.oauthStart` types the response field as `authUrl` (`api-client.ts:175`) while the controller returns `authorizationUrl` (`connector-oauth.controller.ts:25`). Align both to `authorizationUrl`.

---

## Open clarifying questions (challenge before build)

1. **Marketplace → "Employees".** Folding Marketplace into Employees as "Hire from template" assumes templates are primarily agent templates. The `templates` table is multi-kind (agent, workflow, etc., per `marketplaceApi.list({ kind })`). If workflow/content templates are first-class, merging under Employees mislabels them — should Marketplace instead stay in "More" as "Templates" and only *agent-kind* templates appear in the Employees hire flow?
2. **Role floor for Connectors/Knowledge.** I set both to `member`. If `viewer` users are expected to *see* (not edit) connected integrations and knowledge bases for transparency, the floor should be `viewer` with edit gated separately. Which is intended — hidden from viewers, or visible-but-read-only?

---

## Tone Check (Warm but Authoritative)

- **Warmth: 3/5.** Direct and explanatory; the "AI company / Employees" framing adds approachability, but the section is engineering-dense by design.
- **Authority: 5/5.** Grounded in real file paths and line numbers, explicit about the naming law, and clear on the single new canonical name required.
- **Net:** Authoritative-leaning, appropriate for an internal implementation spec.

---

# Bitecodes — Apple-Grade Design System & Rebrand

> Executive summary: The product keeps the name **Bitecodes** and gets a calm, Apple-grade visual identity built on the tokens that already exist in `apps/web/src/styles/globals.css`. This spec hardens those tokens (color light/dark, type scale, spacing, radii, elevation, motion), maps them to Tailwind v4 `@theme` + shadcn/ui variants, fixes two confirmed bugs (the `rounded-md` vs `--radius` mismatch and a broken `cn` import), names the canonical component-primitive locations, and defines a wordmark treatment to replace the hardcoded `"B"` block. Three new design-only env vars are flagged for `BUILD_GUIDE.md`. No DB tables, Inngest events, REST routes, WS namespaces, or AI Controller actions are introduced — this layer is purely presentational and respects every naming/tenant rule.

---

## 1. Design principles (the "Apple-grade" bar)

1. **Deference** — chrome recedes, content leads. One accent (blue), generous whitespace, hairline borders (`--color-border`), soft multi-layer shadows already defined as `--shadow-*`.
2. **Clarity** — a single type family (SF Pro / system), a 6-step type scale, 4 px spacing grid, high contrast for text, low contrast for surfaces.
3. **Depth via motion, not ornament** — spring on enter/press (`--ease-spring`), smooth on layout (`--ease-smooth`), three durations only. Honor `prefers-reduced-motion`.
4. **Progressive disclosure** — surface only essential controls; advanced settings live behind a `<DisclosureSection>` (collapsed by default). Directly serves the beginner-friendly requirement.
5. **Tokens are the contract** — components never hard-code hex/px; they read CSS variables so white-label theming (`organizations.branding`) and dark mode are free.

---

## 2. Color system

The existing palette in `globals.css` (lines 22–67 light, 70–101 dark) is solid and is **retained**. Additions below close gaps for the AI-company surfaces (per-employee status, approval gates, live traces).

### 2.1 Retained semantic tokens (already in repo)
`--color-background/foreground`, `card`, `popover`, `primary` (blue `221 83% 53%` light / `217 91% 60%` dark), `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, plus status `--color-success/warning/info` and the full `--color-sidebar-*` set.

### 2.2 New tokens to ADD (extend the `@theme` block in `apps/web/src/styles/globals.css`)
These are CSS custom properties, **not** canonical platform names — they need no BUILD_GUIDE entry. Mirror each in the `.dark` block.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-success-foreground` | `hsl(0 0% 100%)` | `hsl(0 0% 100%)` | text on success fills |
| `--color-warning-foreground` | `hsl(38 92% 12%)` | `hsl(38 92% 96%)` | text on warning fills |
| `--color-info-foreground` | `hsl(0 0% 100%)` | `hsl(0 0% 100%)` | text on info fills |
| `--color-surface-2` | `hsl(220 14% 98%)` | `hsl(222 47% 10%)` | raised inner panels (chat bubbles, trace rows) |
| `--color-overlay` | `hsl(224 71% 4% / 0.45)` | `hsl(0 0% 0% / 0.6)` | dialog/sheet scrim |
| `--color-employee-active` | `hsl(142 71% 45%)` | `hsl(142 60% 50%)` | "active" employee dot |
| `--color-employee-idle` | `hsl(220 9% 60%)` | `hsl(215 15% 50%)` | "deactivated/idle" dot |
| `--color-employee-waiting` | `hsl(38 92% 50%)` | `hsl(38 92% 55%)` | "awaiting approval / plan-mode" dot |

**Status → state-machine mapping** (uses existing `agent_runs.status` from BUILD_GUIDE §10, no new names): `running`→`--color-info`, `waiting_approval`/`paused`→`--color-employee-waiting`, `succeeded`→`--color-success`, `failed`/`cancelled`→`--color-destructive`, `queued`→`--color-muted-foreground`.

### 2.3 White-label hook
`organizations.branding` (jsonb, already in `packages/db/src/schema/identity.ts`) supplies a tenant primary color. Inject at runtime by writing `--color-primary` / `--color-ring` / `--color-accent` onto a wrapper element in `apps/web/app/[locale]/app/layout.tsx`. No defaults change unless branding is set.

---

## 3. Typography

Keep `--font-sans` (SF Pro → Inter → system) and `--font-mono` from `globals.css`. Add a **named scale** as utility classes in an `@layer components` block so pages stop hand-rolling `text-lg font-bold tracking-tight`.

| Class | size / line-height | weight | tracking | Use |
|---|---|---|---|---|
| `.text-display` | 2.25rem / 1.1 | 700 | -0.02em | hero, empty-state titles |
| `.text-title-1` | 1.5rem / 1.25 | 650 | -0.015em | page titles |
| `.text-title-2` | 1.25rem / 1.3 | 600 | -0.01em | card/section headers |
| `.text-body` | 0.9375rem / 1.6 | 400 | 0 | default (already the `body` size) |
| `.text-callout` | 0.875rem / 1.5 | 500 | 0 | secondary labels, nav |
| `.text-caption` | 0.75rem / 1.4 | 500 | 0.01em | metadata, timestamps, kbd |

Numeric weights (650 etc.) need a variable font; system SF Pro supports them. Fallback rounds to 600/700. Keep `font-feature-settings: "rlig" 1, "calt" 1` (already set on `html`).

---

## 4. Spacing, radii, elevation

- **Spacing**: 4 px base grid — rely on Tailwind's default scale; restrict component padding to `2/3/4/5/6` (8–24 px). No arbitrary `px` values in components.
- **Radii**: the `--radius-*` ramp (0.5 → 1.5rem + `--radius-full`) is kept. **Convention**: controls = `rounded-xl` (12px), cards/panels = `rounded-2xl` (24px), pills/avatars = `rounded-full`, inputs = `rounded-xl`. This matches the sidebar's existing `rounded-xl` usage.
- **Elevation**: the six `--shadow-*` layers are kept and are correctly darker in dark mode. **Convention**: resting card = `shadow-sm`, hover = `shadow-md`, popover/dropdown = `shadow-lg`, dialog/command palette = `shadow-2xl`. Sidebar stays flat (border only).

---

## 5. Motion & interaction

Keep the three durations and two eases already in `globals.css` (`--duration-fast/normal/slow`, `--ease-spring`, `--ease-smooth`). Add one principle table and a reduced-motion guard.

| Interaction | Property | Duration | Ease |
|---|---|---|---|
| Button/press feedback | `transform` (scale 0.97) | `--duration-fast` | `--ease-spring` |
| Hover surface/color | `background, color, box-shadow` | `--duration-normal` | `--ease-smooth` |
| Dialog/sheet enter | `opacity, transform` | `--duration-normal` | `--ease-spring` |
| List item enter (chat msg, trace row) | `opacity, transform Y` | `--duration-slow` | `--ease-smooth` |
| Page/route transition | `opacity` | `--duration-normal` | `--ease-smooth` |

Add to `@layer base` in `globals.css`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important;
    transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
```
Live surfaces (company chat, run traces driven by the `/runs` and `/controller` WebSocket namespaces) use the "list item enter" recipe so streamed steps animate in consistently.

---

## 6. Tailwind v4 + shadcn/ui mapping

- **Single source of truth** is `apps/web/app/[locale]/app/...` consuming `@theme` tokens in `apps/web/src/styles/globals.css` (imported once by `apps/web/app/layout.tsx`). No `tailwind.config` color block — v4 reads `@theme` directly. Dark mode stays class-based via `next-themes` (`attribute="class"`, set in `apps/web/app/[locale]/layout.tsx`).
- **shadcn/ui variants** read the same tokens through `cva` in `packages/ui/src/components/*`. Two confirmed fixes:
  - **Radius mismatch (bug)**: `packages/ui/src/components/button.tsx` uses `rounded-md` (0.375rem) but the system radius is `--radius` 0.75rem. Change control radii to `rounded-xl` so buttons match cards/inputs and the sidebar.
  - **Token drift**: `buttonVariants` only exposes `default/destructive/outline/secondary/ghost/link`. Add a `success` and `warning` variant (read `--color-success`/`--color-warning` + the new `*-foreground` tokens) so approval-gate and plan-mode actions have semantically correct buttons instead of ad-hoc classes.

---

## 7. Component primitives — canonical locations

Establish a clear two-tier split (resolving the current duplication where pages hand-roll markup and `apps/web/src/components/ui` partly shadows `packages/ui`):

- **`packages/ui/src/components/*`** = the **design-system library** (`@bitecodes/ui`). Theme-agnostic, stateless, exported from `packages/ui/src/index.ts`. Owns: `Button, Input, Card, Dialog, Sheet, Tabs, Table, Toast, DropdownMenu, Badge`. **Add** to this tier (used across many AI-company surfaces): `Avatar` (employee avatars), `Tooltip`, `Switch` (activate/deactivate, bypass-permission toggles), `Separator`, `ScrollArea` (chat/trace panes), `Skeleton`.
- **`apps/web/src/components/ui/*`** = **app-local primitives** that depend on app context (router, session, i18n): keep `empty-state.tsx`, `error-boundary.tsx`. **Move** `skeleton.tsx` into `@bitecodes/ui` (it is theme-only) to eliminate the duplicate.
- **`apps/web/src/components/shell/*`** = composed app chrome: `sidebar.tsx` (rework per §1 nav reduction — UI labels only), plus new `top-bar.tsx` and `disclosure-section.tsx` (progressive disclosure wrapper).

**Bug fix (confirmed)**: `apps/web/src/components/ui/skeleton.tsx:1` imports `cn` from `@/lib/utils`, which does not exist — `cn` lives only in `packages/ui/src/lib/utils.ts` (re-exported by `@bitecodes/ui`). After moving Skeleton into `@bitecodes/ui`, import `cn` from `../lib/utils`. This import would throw the moment the component is rendered.

---

## 8. Logo & wordmark treatment

Today the mark is a hardcoded `<span>B</span>` inside a blue rounded square (`apps/web/src/components/shell/sidebar.tsx:46-49`). Replace with a reusable, theme-aware component.

- **Mark (glyph)**: an SVG `<Logomark/>` — a rounded-square (`rounded-xl`) tile filled with `--color-primary`, containing a monoline "bit" cut (a single rounded notch suggesting `</>` without literal angle brackets). Renders crisp at 20/24/32 px; `currentColor`-driven so it inverts in dark mode.
- **Wordmark**: "Bitecodes" set in `--font-sans`, weight 700, `tracking-tight`, lowercase-stem optical sizing (keep cap "B"). Use the `.text-title-2` size in the sidebar.
- **Lockups**: `horizontal` (mark + wordmark, sidebar/top-bar), `stacked` (auth/landing), `mark-only` (favicon, collapsed sidebar, avatar fallback).
- **Location**: `packages/ui/src/components/logo.tsx`, exported from `packages/ui/src/index.ts`. Props `{ variant: 'horizontal'|'stacked'|'mark'; size?: number }`. Consumed by `sidebar.tsx`, `apps/web/app/[locale]/(auth)/*`, and `apps/web/app/[locale]/(public)/page.tsx`. White-label: the tile fill reads `--color-primary`, so a tenant brand color reskins the mark automatically.
- **Clear space**: ≥ half the mark height on all sides. **Don't**: re-color the glyph per-status, add gradients (reserve gradients for decorative avatars only), or stretch the wordmark.

---

## 9. Navigation visual treatment (5-item reduction)

Supports the product requirement to reduce primary nav to **Dashboard, Employees, Knowledge, Connectors, Settings** (UI labels only — routes stay `/app/agents`, the `agents` table and `agent/run` event are unchanged). Visual rules:

- Active item: `bg-primary text-primary-foreground` pill (already the sidebar pattern) — keep, but apply `--ease-spring` on the active-state transition.
- Demoted pages (Workflows, Content, Inbox, Marketplace, Analytics) move into a **"More" `DropdownMenu`** at the foot of the nav (uses existing `@bitecodes/ui` `DropdownMenu`) — present but de-emphasized, satisfying "kept but demoted." RBAC visibility is enforced upstream; the design simply hides items whose role check fails (no layout shift — render nothing rather than disabled).
- Employee rows carry a status dot using `--color-employee-active/idle/waiting` (§2.2).

---

## 10. New canonical names (add to BUILD_GUIDE)

This design layer introduces **no** tables, columns, Inngest events, REST routes, WebSocket namespaces, or AI Controller actions. The only net-new names are **env vars** controlling the white-label/theme surface, which per CLAUDE.md rule #1 must be added to `docs/BUILD_GUIDE.md §5` and `.env.example` **before** use:

| Env var | Type | Default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_BRAND_NAME` | string | `Bitecodes` | Wordmark/document-title text (keeps name configurable for white-label without code edits) |
| `NEXT_PUBLIC_BRAND_PRIMARY_HSL` | string (`H S% L%`) | `221 83% 53%` | Default `--color-primary` when no tenant `organizations.branding` is set |
| `NEXT_PUBLIC_DEFAULT_THEME` | `light\|dark\|system` | `light` | Seeds `next-themes` `defaultTheme` in `apps/web/app/[locale]/layout.tsx` |

All three are `NEXT_PUBLIC_*`, consistent with the existing `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_APP_NAME` / `NEXT_PUBLIC_APP_URL` convention. The CSS custom properties in §2.2 are **not** canonical platform names and require no BUILD_GUIDE entry.

---

## 11. Implementation checklist (ordered, low-risk)

1. `apps/web/src/styles/globals.css` — add §2.2 color tokens (light + `.dark`), §3 type-scale `@layer components`, §5 reduced-motion guard.
2. `packages/ui/src/components/button.tsx` — `rounded-md` → `rounded-xl`; add `success`/`warning` cva variants.
3. Move `skeleton.tsx` → `packages/ui/src/components/skeleton.tsx`, export from `packages/ui/src/index.ts`, fix the `cn` import (resolves the broken `@/lib/utils` bug).
4. Add `Avatar, Tooltip, Switch, Separator, ScrollArea, Logo` to `@bitecodes/ui`.
5. `packages/ui/src/components/logo.tsx` — implement `<Logo/>`; swap into `sidebar.tsx`, auth pages, landing.
6. `apps/web/app/[locale]/app/layout.tsx` — inject tenant `--color-primary` from `organizations.branding`; add `top-bar.tsx`.
7. Add the three env vars to `docs/BUILD_GUIDE.md §5` and `.env.example`, then read `NEXT_PUBLIC_DEFAULT_THEME` in `apps/web/app/[locale]/layout.tsx`.

## Tone Check (Warm but Authoritative)
- **Warmth**: 3/5 — beginner-friendly framing (progressive disclosure, "calm chrome") is welcoming; tone is largely technical-neutral by necessity.
- **Authority**: 5/5 — every claim cites a real file path/line, two confirmed bugs are called out, and naming/tenant constraints are explicitly honored.
- **Verdict**: On-brand for an internal engineering design spec. To raise warmth for any external-facing variant, add a one-line "why this matters to users" lead under each section.

---

## Executive summary

This design adds a **company-shaped orchestration layer** on top of the existing durable agent runtime (`apps/api/src/inngest/agent.run.ts`) without renaming the `agent` primitive (UI label "Employee" only). It introduces (a) an **org chart** that lets one employee supervise/watch others, (b) a **task router** that classifies an incoming request and assigns it to the correct employee, and (c) a **"wrong employee → divert"** flow that is conversational in the UI and event-driven in the backend. All model calls remain inside Inngest `step.*` calls; every query runs inside `withTenant(orgId, wsId, fn)`. The router is a new durable Inngest function (`orchestration/route`) that reuses `ModelRouter` (`packages/ai-core/src/model/model-router.ts`) for classification and emits the existing `agent/run` event to dispatch — so the executor and `agent_runs` persistence are untouched and the layer is fully additive.

Two open assumptions I am flagging rather than silently adopting (challenge points):
1. **Routing should default to *propose*, not *auto-execute*.** Auto-routing a destructive request to the wrong-but-confident employee is the higher-cost failure mode. I default `routing_decisions.status` to `proposed` and gate auto-dispatch behind an explicit org setting. Confirm you want silent auto-dispatch anywhere.
2. **Supervision is "watch + gate", not "agent edits agent".** Letting a supervisor agent rewrite a subordinate's `agent_versions.system_prompt` at runtime breaks the immutable-version contract in `packages/db/src/schema/agents.ts`. I model supervision as a *review/approval edge*, not a write edge. Confirm that is the intended semantics.

---

## 1. Where this plugs into the existing system

| Concern | Existing anchor | What this design adds |
|---|---|---|
| Durable execution | `agentRunFunction` in `apps/api/src/inngest/agent.run.ts` (id `agent/run`, retries 3) | New `orchestrationRouteFunction` + `agentHandoffFunction`; both emit/await events the executor already understands |
| Dispatch from HTTP | `AgentController.run()` `apps/api/src/agent/agent.controller.ts:108` sends `agent/run` | New `OrchestrationController` sends `orchestration/route` instead of forcing the caller to pick an agent |
| Approval pause/resume | `step.waitForEvent('approval/decided', timeout 7d)` `agent.run.ts:141` | Reused verbatim for both the divert-confirm gate and supervisor gate |
| Live tracking | `RunsGateway` `apps/api/src/gateway/runs.gateway.ts` (room `ws:<workspaceId>`) | New emit helpers on the existing `/runs` namespace; no new WS namespace needed |
| Memory / learning | `MemoryStore` abstract `packages/ai-core/src/memory/memory-store.ts` | Router writes routing outcomes as `long_term` memory entries (RAG feedback loop, not fine-tune) |
| Registry | `ACTION_REGISTRY` `packages/ai-controller/src/registry.ts` | One new dot-namespaced action `orchestration.route` |

Mirror rule (from the codebase map): every new table/column must land in **three** places — `docs/BUILD_GUIDE.md` first, then `packages/db/src/schema/agents.ts`, then the inline `appSchema` in `apps/api/src/drizzle/drizzle.service.ts`.

---

## 2. Data model (new tables + columns)

### 2.1 `agent_relationships` — the org chart (supervision + watching)
A directed edge between two `agents` rows in the same org. Self-referential, so an employee can supervise many and be supervised by many (DAG enforced in app logic, not DB).

```ts
// packages/db/src/schema/agents.ts
export const agentRelationshipKindEnum = pgEnum('agent_relationship_kind', [
  'supervises',   // parent gates/reviews child output
  'watches',      // parent observes child (read-only, no gate)
  'delegates_to', // parent may hand work down to child
]);

export const agentRelationships = pgTable('agent_relationships', {
  id: primaryKey(),
  ...tenantColumns(),
  parentAgentId: uuid('parent_agent_id').notNull(), // the supervisor/watcher
  childAgentId: uuid('child_agent_id').notNull(),   // the subordinate
  kind: agentRelationshipKindEnum('kind').notNull(),
  config: jsonb('config').notNull().default('{}'),  // { gateRiskClass, approvalTimeout, watchOnly }
  enabled: boolean('enabled').notNull().default(true),
  createdBy: uuid('created_by').notNull(),
  ...timestamps(),
}, (t) => [
  index('agent_relationships_parent_idx').on(t.parentAgentId),
  index('agent_relationships_child_idx').on(t.childAgentId),
  index('agent_relationships_org_idx').on(t.organizationId),
]);
```

### 2.2 `routing_decisions` — task router audit + learning corpus
Every routing attempt (proposed, confirmed, diverted, rejected) is a row. This is also the labelled corpus the router learns from.

```ts
export const routingStatusEnum = pgEnum('routing_status', [
  'proposed',    // router picked a candidate, awaiting confirm
  'confirmed',   // user/policy accepted → dispatched agent/run
  'diverted',    // user accepted a different (corrected) employee
  'rejected',    // user cancelled
  'dispatched',  // agent/run emitted; carries runId
  'failed',      // classification or dispatch error
]);

export const routingDecisions = pgTable('routing_decisions', {
  id: primaryKey(),
  ...tenantColumns(),
  requestText: text('request_text').notNull(),
  requestedAgentId: uuid('requested_agent_id'),   // who the user asked (may be wrong/null)
  chosenAgentId: uuid('chosen_agent_id'),          // who the router proposed
  finalAgentId: uuid('final_agent_id'),            // who actually ran after divert/confirm
  confidence: numeric('confidence', { precision: 5, scale: 4 }), // 0..1
  rationale: text('rationale'),                    // model's one-line reason
  candidates: jsonb('candidates'),                 // [{agentId, score, reason}]
  status: routingStatusEnum('status').notNull().default('proposed'),
  conversationId: uuid('conversation_id'),         // links to company-chat thread
  runId: uuid('run_id'),                           // set when dispatched
  decidedBy: uuid('decided_by'),
  ...timestamps(),
}, (t) => [
  index('routing_decisions_org_status_idx').on(t.organizationId, t.status, t.createdAt),
  index('routing_decisions_conversation_idx').on(t.conversationId),
]);
```

### 2.3 Columns added to existing tables
- **`agents`** (`packages/db/src/schema/agents.ts`): add
  - `is_router boolean not null default false` — exactly one router/orchestrator employee per workspace (the "dispatcher"); enforced by partial unique index.
  - `routing_keywords jsonb default '[]'` — cheap pre-filter for the router (skills/domains this employee owns), surfaced in the UI as beginner-friendly chips.
  - `activation_state agent_activation_state not null default 'active'` — supports the per-employee activate/deactivate control (new enum `['active','paused','disabled']`); the router skips non-`active` employees.
- **`agent_runs`**: add
  - `parent_run_id uuid` — set when a run was spawned by a handoff (supervisor → subordinate or delegate), enabling the run tree.
  - `routing_decision_id uuid` — back-link to the routing row for full traceability.
  - `triggered_by_agent_id uuid` — which employee initiated this run (null = human).

### 2.4 RLS
Both new tables key on `organization_id = current_setting('app.current_org', true)`. Register in **both** `packages/db/src/rls/policies.sql` and `packages/db/scripts/setup-rls.sql` (the codebase map notes these two files drift — add to both and reconcile). No FK constraints (consistent with the bare-uuid convention in `agents.ts`).

---

## 3. The task router (durable Inngest function)

**File:** `apps/api/src/inngest/orchestration.route.ts`, registered in `apps/api/src/inngest/index.ts` and the `INNGEST_FUNCTIONS` array in `apps/api/src/inngest-endpoint/inngest.controller.ts`.

```
event: orchestration/route  { routingDecisionId, organizationId, workspaceId, conversationId }
```

Steps (each its own `step.run` for replay, mirroring `agent.run.ts`):
1. **`load-candidates`** — `withTenant(org, ws, tx)` reads active `agents` (filter `activation_state='active'`, exclude `is_router`), their `role`/`goal`/`routing_keywords`, and the `agent_relationships` graph. Cheap keyword pre-filter narrows the set.
2. **`retrieve-prior-routings`** — `MemoryStore.search({ scope: 'long_term', query: requestText })` pulls past `diverted`/`confirmed` outcomes for this org — the learning signal. This is RAG, not fine-tuning.
3. **`classify`** — single `modelRouter.route({ costTier: 'fast' })` call. System prompt: "You are a dispatcher. Given the employee roster and these past corrections, return the best `chosen_agent_id`, a `confidence` 0..1, ranked `candidates`, and a one-line `rationale`. You may not invent employees." Output validated with a shared Zod schema (`RoutingResultSchema`, added to `packages/shared`).
4. **`persist-decision`** — `withTenant` updates `routing_decisions` with `chosenAgentId`, `confidence`, `candidates`, `rationale`.
5. **Branch on confidence + policy:**
   - `confidence ≥ autoDispatchThreshold` **and** org setting `orchestration.autoDispatch=true` **and** chosen ≠ requested-but-wrong → status `confirmed`, emit `agent/run` directly (set `routing_decision_id`, `triggered_by_agent_id=router`).
   - otherwise → status `proposed`, emit `run:status`/a new `routing:proposed` event to `/runs`, then `step.waitForEvent('orchestration/decided', timeout: '1d', match: 'data.routingDecisionId')`. On `confirm`/`divert`, set `finalAgentId` + status, emit `agent/run`. On `reject`, status `rejected`, no dispatch.
6. **`learn`** — write a `long_term` `MemoryStore` entry: `{ requestText, finalAgentId, wasDiverted }`. A divert is a high-value negative-then-positive label that improves step 2 next time.

Confidence threshold and `autoDispatch` live in `settings` (per workspace), surfaced in Settings under progressive disclosure (advanced).

---

## 4. "Ask the wrong employee → divert" flow

This is the headline UX. It is the **proposed** branch of §3, reachable two ways: (a) user opens the company chat and addresses a specific employee, or (b) user is on an employee's page and sends a request that employee cannot serve.

**UX (conversational, in the unified company chat):**
1. User messages Employee A ("@Finance, draft next week's social posts").
2. Frontend calls `POST /v1/orchestration/route` with `{ requestText, requestedAgentId: A }`. Controller enqueues `orchestration/route` and returns `202 { routingDecisionId }`.
3. Router classifies, finds **Content Marketer (B)** with confidence 0.91, and because `requestedAgentId ≠ chosenAgentId`, emits `routing:proposed` to `/runs`.
4. The chat renders an **inline divert card** (not a hard error): *"This looks like a job for **Content Marketer**, not Finance. Send it there?"* with **Send to Content Marketer / Keep with Finance / Cancel** buttons, plus the rationale on a disclosure toggle.
5. User clicks → frontend `POST /v1/orchestration/decisions/:id` with `{ decision: 'divert' | 'confirm' | 'reject', agentId? }`, which emits `orchestration/decided`. The waiting router resumes (step 5 above) and dispatches `agent/run`. The chat shows the run streaming live via existing `run:step` events.

**Backend routing summary:** `orchestration/route` → (low confidence or wrong-target) → `routing:proposed` WS → human picks → `orchestration/decided` WS-triggering REST → router resumes → `agent/run`. No model call happens in any HTTP handler; the controller only enqueues. The divert decision is captured in `routing_decisions` (`status=diverted`, `requestedAgentId` vs `finalAgentId`) and fed back into memory — so the same wrong-ask self-corrects over time.

---

## 5. Supervision & watching (employee-supervises-employee)

Built entirely on `agent_relationships` + the **existing approval primitive**, so no new pause/resume machinery:

- **`supervises`**: when a subordinate run produces a tool call whose `riskClass` ≥ the edge's `config.gateRiskClass`, the executor creates an `approvals` row (kind `tool_call`) **assigned to the supervisor's owning human**, emits `approval:created`, and the run suspends on `step.waitForEvent('approval/decided', timeout 7d)` — the exact code at `agent.run.ts:128-156`. The only change: the approval payload carries `supervisorAgentId` so the company chat shows *"Supervisor: Manager is reviewing"*. Email notification (requirement 7) is sent here via the existing `EmailService` (`apps/api/src/email/email.service.ts`) — fire it inside the `create-approval` step.
- **`watches`**: read-only. The watcher's human is added to the `/runs` room subscription for that run; no gate. Implemented purely client-side + a `run:step` fan-out — zero runtime cost.
- **`delegates_to`**: enables the handoff in §6.

Hierarchy selection UI: a drag-to-connect org-chart canvas in the Employees section writes `agent_relationships` rows via `POST /v1/agent-relationships`. RBAC: only `admin`/`owner` (per `roleEnum`, `apps/api/src/common/guards/rbac.guard.ts`) may edit the chart.

---

## 6. Inter-agent handoff (one employee hands work to another)

The `handoff` value already exists in `stepTypeEnum` (`agents.ts:31`) but has no runtime. Add `agentHandoffFunction`:

```
event: agent/handoff  { parentRunId, fromAgentId, toAgentId, task, organizationId, workspaceId }
```

In `agent.run.ts`, expose a **builtin tool `handoff`** (parsed from the `builtin:handoff` tool-ref convention already in `AgentInputSchema`). When the model calls it, the executor:
1. Verifies a `delegates_to` or `supervises` edge exists in `agent_relationships` (else returns a tool error — an employee cannot delegate to someone outside its chart).
2. Writes a `run_steps` row of `type='handoff'`, emits `agent/handoff`.
3. `agentHandoffFunction` mints a child `runId`, sets `parent_run_id`, and emits `agent/run`. The parent run either `waitForEvent('run/finished', match runId)` (synchronous delegation) or continues (fire-and-forget watch) based on the edge config.

This gives a real run tree (`agent_runs.parent_run_id`) that the company chat renders as nested threads — satisfying "fully tracked, observable in real time."

---

## 7. State machine

`routing_decisions.status`:
```
proposed ──confirm──▶ confirmed ──▶ dispatched
proposed ──divert───▶ diverted  ──▶ dispatched
proposed ──reject───▶ rejected            (terminal)
(auto)   ───────────▶ confirmed ──▶ dispatched
dispatched ─run fails at dispatch─▶ failed (terminal)
```
`agent_runs.status` is unchanged (the §10 machine in BUILD_GUIDE still governs the dispatched run). Handoff children follow the same `agent_runs` machine; the parent transitions `running → waiting_approval` only for the supervisor gate, reusing existing transitions.

---

## 8. New canonical names (add to BUILD_GUIDE FIRST, then code)

**Inngest events (slash-namespaced) — add to `docs/BUILD_GUIDE.md` §6:**
| Event | Trigger | Payload |
|---|---|---|
| `orchestration/route` | A request needs routing to an employee | `{ routingDecisionId, organizationId, workspaceId, conversationId }` |
| `orchestration/decided` | Human confirmed/diverted/rejected a routing proposal | `{ routingDecisionId, decision, agentId? }` |
| `agent/handoff` | One employee hands work to another | `{ parentRunId, fromAgentId, toAgentId, task, organizationId, workspaceId }` |

**AI Controller action (dot-namespaced) — add to `ACTION_REGISTRY` in `packages/ai-controller/src/registry.ts`:**
| Action | riskClass | target | Args |
|---|---|---|---|
| `orchestration.route` | `confirm` | `server` | `{ requestText: string, requestedAgentId?: uuid }` |

**REST routes — add to `docs/BUILD_GUIDE.md` §7 (new `OrchestrationController`, `apps/api/src/orchestration/orchestration.controller.ts`):**
- `POST /v1/orchestration/route` → enqueue `orchestration/route`, return `{ routingDecisionId }`
- `POST /v1/orchestration/decisions/:id` → enqueue `orchestration/decided`
- `GET /v1/orchestration/decisions` → list routing audit
- `POST /v1/agent-relationships` · `GET /v1/agent-relationships` · `DELETE /v1/agent-relationships/:id`

**WebSocket — reuse existing `/runs` namespace (BUILD_GUIDE §8); add two server→client events:**
- `routing:proposed { routingDecisionId, chosenAgentId, candidates, rationale }`
- `routing:resolved { routingDecisionId, finalAgentId, status }`

**Tables/columns/enums — add to `docs/BUILD_GUIDE.md` §6 schema, `packages/db/src/schema/agents.ts`, AND `apps/api/src/drizzle/drizzle.service.ts` appSchema:**
- Tables: `agent_relationships`, `routing_decisions`
- Enums: `agent_relationship_kind`, `routing_status`, `agent_activation_state`
- Columns: `agents.is_router`, `agents.routing_keywords`, `agents.activation_state`; `agent_runs.parent_run_id`, `agent_runs.routing_decision_id`, `agent_runs.triggered_by_agent_id`

**Shared Zod types — add to `packages/shared` (defined once):** `RoutingResultSchema`, `RoutingDecisionSchema`, `AgentRelationshipSchema`, `OrchestrationDecidedSchema`.

**Env var — add to `docs/BUILD_GUIDE.md` §5 + `.env.example`:** `ORCHESTRATION_AUTODISPATCH_THRESHOLD` (default `0.85`).

---

## 9. Modularity, RBAC & build order

- **Modular:** the layer is a single new Nest module (`OrchestrationModule`) + two Inngest functions + two tables. Disabling it (no `is_router` employee) leaves the current `agent/run` path fully functional — nothing else changes.
- **RBAC:** nav visibility of the org-chart editor, the divert decision endpoints, and relationship mutations all gate through the existing `RbacGuard` + `@RequireRole`. `viewer` can watch; `member` can route/confirm; `admin`/`owner` edit hierarchy.
- **Suggested build order:** (1) BUILD_GUIDE catalog edits; (2) schema + RLS in all three locations; (3) `OrchestrationController` + events (stub functions); (4) `orchestrationRouteFunction` classify+propose; (5) divert UI in company chat; (6) `agent/handoff` + supervisor approval wiring; (7) memory feedback loop.

## Tone Check
Audience is an internal engineering/product reader, so this is an internal artifact rather than a customer-facing draft; the brand-voice scoring still applies. **Warm:** moderate — direct and collaborative, with two explicit "challenge" assumptions surfaced rather than rubber-stamped, per the Challenger guideline. **Authoritative:** high — every claim is anchored to a real file path, the existing event catalog, and the naming law, and all new names are quarantined into a single "add to BUILD_GUIDE first" section. Formal English, active voice, no contractions, no emojis. One residual risk to confirm with stakeholders: the auto-dispatch default (§1, assumption 1) is the main behavioural decision left open.

---

## Executive summary

This design adds a tenant-scoped **message bus** so employees (the UI label for `agents`) can talk to each other and to the user; a single **company chat** surface that streams all inter-employee back-and-forth in real time; a new `/company` WebSocket namespace for delivery; durable trace storage that reuses `run_steps`/`audit_logs`; and a **RAG learning loop** that writes durable per-employee memory into the existing `agent_memories` (pgvector 1536) table — never fine-tuning. Every name follows the conventions in `docs/BUILD_GUIDE.md`; all new names are collected in the final subsection for catalog registration **before** any code uses them.

Core principle preserved: HTTP handlers never call models. The chat controller validates with a Zod schema and enqueues an Inngest event; routing, model calls, handoffs, and memory writes happen inside `step.*` in `apps/api/src/inngest/*`. Every DB query runs inside `drizzle.withTenant(orgId, wsId, fn)` (`apps/api/src/drizzle/drizzle.service.ts`).

---

## 1. Data model — the message bus

The bus is a **conversation + messages** pair, plus an **inbox/handoff queue** for routing between employees. All tables live in `packages/db/src/schema/agents.ts` (co-located with `agents`/`agentRuns`) and **must be mirrored into the inline schema in `apps/api/src/drizzle/drizzle.service.ts`** or queries fail. All carry `...tenantColumns()` and register RLS in **both** `packages/db/src/rls/policies.sql` and `packages/db/scripts/setup-rls.sql`.

### `conversations` (the "company chat" thread container)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `primaryKey()` |
| `organization_id`, `workspace_id` | tenant cols | `...tenantColumns()` |
| `kind` | `conversation_kind` enum | `company` (the single unified chat) \| `direct` (user↔one employee) \| `task` (scoped to one root task) |
| `title` | text | auto-summarized by the orchestrator |
| `root_run_id` | uuid | nullable; links to the `agent_runs` row that opened it |
| `created_by` | uuid | user id, or null when employee-initiated |
| timestamps + soft-delete | | `...timestamps()`, `...softDelete()` |

There is exactly **one** `kind='company'` conversation per workspace (enforced by a partial unique index on `(workspace_id) WHERE kind='company'`). It is the "single unified company chat showing ALL agents" from the product vision.

### `conversation_messages` (the bus payload — every utterance, human or agent)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| tenant cols | | |
| `conversation_id` | uuid | FK-by-convention to `conversations` |
| `sender_type` | `message_sender_type` enum | `user` \| `agent` \| `system` (orchestrator) |
| `sender_agent_id` | uuid | null unless `sender_type='agent'` |
| `sender_user_id` | uuid | null unless `sender_type='user'` |
| `recipient_agent_id` | uuid | null = broadcast to the company chat; set = directed handoff |
| `role` | `message_role` enum | `message` \| `handoff` \| `result` \| `clarification` \| `divert_suggestion` |
| `run_id` | uuid | the `agent_runs` row that produced this (null for user msgs) |
| `step_id` | uuid | links to the `run_steps` row, for trace drill-down |
| `content` | text | rendered text |
| `payload` | jsonb | structured handoff args / tool results |
| `parent_message_id` | uuid | threading for back-and-forth |
| `created_at` | timestamptz | indexed `(conversation_id, created_at)` for ordered replay |

`role='divert_suggestion'` is what the product vision calls "asking the wrong employee prompts the user to divert to the correct one" — the orchestrator posts it when intent does not match the addressed employee.

### `agent_handoffs` (the routing queue between employees)
The `handoff` value already exists in `stepTypeEnum` (`packages/db/src/schema/agents.ts:31`) but has **no runtime**. This table gives it durable state.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| tenant cols | | |
| `conversation_id` | uuid | |
| `from_agent_id` | uuid | null when the orchestrator routes a user task |
| `to_agent_id` | uuid | target employee |
| `from_run_id` / `to_run_id` | uuid | the producing run and the spawned child run |
| `task` | text | the delegated instruction |
| `payload` | jsonb | structured args |
| `status` | `handoff_status` enum | `pending` \| `accepted` \| `completed` \| `rejected` \| `failed` |
| timestamps | | |

This is also the hierarchy/supervision substrate: a supervisor employee delegates via a `pending` handoff; the orchestrator picks the target using the per-employee hierarchy config (stored in `agentVersions.config` JSON, no schema change needed).

### Learning loop — reuse `agent_memories` (no new table)
`agent_memories` (`packages/db/src/schema/knowledge.ts:87`) already has `agentId`, `scope thread|long_term`, `threadId`, `content`, `embedding vector(1536)`, `metadata`, `expiresAt`. The learning loop writes **distilled lessons** here, embedded via the same LiteLLM `text-embedding-3-small` path used by `packages/ai-core/src/retrieval/kb-retrieval.ts`. We set `metadata = { source: 'conversation', conversationId, fromAgentId }` and use `scope='long_term'` for durable lessons, `scope='thread'` (with `threadId = conversation_id`) for in-conversation working memory. This satisfies "learn from inputs (durable memory / RAG feedback loop, NOT fine-tuning)". The only code change is replacing `NoOpMemoryStore` (`packages/ai-core/src/memory/memory-store.ts`) with a `DrizzleMemoryStore` that implements the existing abstract `save`/`search`/`summarize` against `agent_memories` inside the caller's `withTenant` tx.

---

## 2. Real-time delivery — new `/company` WebSocket namespace

The three current namespaces (`/runs`, `/controller`, `/inbox`, `apps/api/src/gateway/`) are run- and controller-scoped. Inter-agent chat is a distinct concern, so add a fourth namespace `/company`, implemented as `CompanyGateway` in `apps/api/src/gateway/company.gateway.ts`, registered in `apps/api/src/gateway/gateway.module.ts` exactly like `RunsGateway`.

It copies the proven isolation pattern from `runs.gateway.ts`: client emits `join { workspaceId }` → server `client.join('ws:<workspaceId>')` → all emits target that room only. **Hardening (closes a noted gap):** unlike the current gateways which trust the client-supplied `workspaceId`, `CompanyGateway.handleJoin` must verify the socket's Better Auth session membership before joining the room (mirror the `TenantGuard` membership check in `apps/api/src/common/guards/tenant.guard.ts` using `DrizzleService.systemDb`).

Server→client events on `/company`:
| Event | Payload | Fired by |
|---|---|---|
| `company:message` | `{ message }` (a `conversation_messages` row) | every bus insert |
| `company:typing` | `{ conversationId, agentId, state }` | when an employee's run starts/streams an LLM step |
| `company:handoff` | `{ handoffId, fromAgentId, toAgentId, task, status }` | on `agent_handoffs` insert/update |
| `company:divert` | `{ conversationId, suggestedAgentId, reason }` | orchestrator wrong-employee detection |

`CompanyGateway` exposes `emitMessage`/`emitTyping`/`emitHandoff`/`emitDivert` helpers, injected into the Inngest layer the same way the design intends for `RunsGateway` (Nest provider resolved at function-module bootstrap). Live run-step tracking continues to flow on `/runs` (`run:step`/`run:status`); the company chat subscribes to **both** so it shows messages *and* the internal step trace, satisfying "fully tracked and observable in real time".

---

## 3. Inngest events — orchestration & the talking loop

Three new slash-namespaced events drive the bus. They sit alongside the four registered functions in `apps/api/src/inngest/index.ts` and the `INNGEST_FUNCTIONS` array in `apps/api/src/inngest-endpoint/inngest.controller.ts` (both must list the new functions or the events go unhandled — a known failure mode).

1. **`company/message.posted`** — `{ conversationId, messageId, organizationId, workspaceId }`. Emitted by the chat controller after persisting a user/employee message. Handler `companyMessagePostedFunction` (`apps/api/src/inngest/company.message.posted.ts`):
   - `step.run('classify-intent')` → routes via the orchestrator (LLM at `costTier:'smart'` through `ModelRouter`) to choose the target employee from the active hierarchy.
   - If the addressed employee is wrong → insert a `divert_suggestion` message, `emitDivert`, **stop** (ask the user).
   - Else `step.sendEvent` a `company/handoff.requested`.

2. **`company/handoff.requested`** — `{ handoffId, fromAgentId, toAgentId, conversationId, task, organizationId, workspaceId }`. Handler inserts the `agent_handoffs` row, then enqueues the **existing** `agent/run` event for the target employee (no new run event needed) with `input` carrying `conversationId` + `task`. This makes the child run a first-class `agent_runs` row, so all existing live tracking applies for free.

3. **`company/message.learned`** — `{ conversationId, runId, agentId, organizationId, workspaceId }`. Emitted after a run finishes; handler `companyLearnFunction` distills the exchange (one `step.run` LLM summarize) and writes a `long_term` row to `agent_memories`. This is the RAG feedback loop.

### Wiring into the existing executor (`apps/api/src/inngest/agent.run.ts`)
The current executor's `finalize` step is a stub (`agent.run.ts:173`). Extend it (not replace it) so that when a run was spawned for a conversation it:
- inserts a `conversation_messages` row (`sender_type='agent'`, `role='result'`, `run_id`),
- calls `CompanyGateway.emitMessage`,
- emits `company/message.learned`.

Before the agentic loop, add a `step.run('load-memory')` that calls the new `DrizzleMemoryStore.search({ agentId, scope:'long_term', query: input })` and feeds results into `PromptAssembler.build` (which already accepts `memory` and `retrievedChunks` but is currently called empty). This closes the "runs are stateless" gap and makes employees genuinely learn.

Inside the loop, when the model emits a `handoff`-typed tool call, record a `run_steps` row with `type='handoff'` and `step.sendEvent('company/handoff.requested', …)` instead of the stubbed tool path — turning the dormant `handoff` enum into real inter-agent invocation.

---

## 4. REST routes & AI Controller action

New routes under `/v1`, added to `docs/BUILD_GUIDE.md §7` first, then implemented in a new `apps/api/src/company/company.controller.ts` (+ `company.service.ts`, `company.module.ts`) following the enqueue-not-execute pattern of `knowledge.controller.ts`:

| Route | Purpose |
|---|---|
| `GET /v1/conversations` | list conversations (tenant-scoped) |
| `GET /v1/conversations/:id/messages` | paged message history for replay |
| `POST /v1/conversations/:id/messages` | post a user message → validates Zod → enqueues `company/message.posted` → 202 |
| `GET /v1/conversations/company` | resolve the singleton company-chat conversation |
| `GET /v1/agent-handoffs` | live + historical handoff trace for observability |

One new **dot-namespaced** AI Controller action in `packages/ai-controller/src/registry.ts` (the registry is a closed set; add it there with a Zod `argsSchema`, `riskClass`, `target`): **`company.message`** `(confirm, server)` — lets the Controller post into the company chat on the user's behalf. A matching browser action **`company.open`** `(safe, browser)` navigates the UI to the chat.

---

## 5. Chat UI route

New authed route `apps/web/app/[locale]/app/company/page.tsx` (the live tree is the un-parenthesized `app/[locale]/app/*`). It is the renamed/primary chat surface and should be reachable from the 5-item nav. Structure:
- A **WebSocket provider** (currently missing — `socket.io-client` is a dependency but unwired): add `apps/web/src/lib/company-socket.ts` connecting to `/company`, emitting `join { workspaceId }`, subscribing to `company:message`/`company:typing`/`company:handoff`/`company:divert`, plus `/runs` `run:step` for the step trace.
- A unified timeline showing every employee's avatar, message, and inline handoff/step chips; a right rail "live trace" panel reading `run_steps` via `GET /v1/conversations/:id/messages` joined to steps.
- Data fetching via the already-provisioned TanStack Query (`apps/web/src/components/providers.tsx`) and `apps/web/src/lib/api-client.ts` (add a `companyApi` helper) with `x-bitecodes-workspace` header.
- `divert_suggestion` renders as an interactive prompt ("Ask Marketing instead?") that re-posts to the correct employee — the human-in-the-loop conversational divert.

Approval-by-email reuses the existing `EmailService.send` (`apps/api/src/email/email.service.ts`, currently uninvoked): when a handoff/tool needs approval, the `create-approval` step calls `EmailService.send` with a link to the chat, alongside the existing `approval:created` WS event.

---

## 6. New canonical names (add to BUILD_GUIDE first)

**Tables / enums (`packages/db/src/schema/agents.ts` + mirror in `drizzle.service.ts`; RLS in both SQL files):**
- `conversations`, `conversation_messages`, `agent_handoffs`
- Enums: `conversation_kind (company|direct|task)`, `message_sender_type (user|agent|system)`, `message_role (message|handoff|result|clarification|divert_suggestion)`, `handoff_status (pending|accepted|completed|rejected|failed)`
- New columns reuse existing `agent_memories`; no schema change there.

**Inngest events (slash-namespaced — add to §6):**
- `company/message.posted` `{ conversationId, messageId, organizationId, workspaceId }`
- `company/handoff.requested` `{ handoffId, fromAgentId, toAgentId, conversationId, task, organizationId, workspaceId }`
- `company/message.learned` `{ conversationId, runId, agentId, organizationId, workspaceId }`

**REST routes (add to §7):** `GET /v1/conversations`, `GET /v1/conversations/:id/messages`, `POST /v1/conversations/:id/messages`, `GET /v1/conversations/company`, `GET /v1/agent-handoffs`

**WebSocket namespace (add to §8):** `/company` → `company:message`, `company:typing`, `company:handoff`, `company:divert`

**AI Controller actions (dot-namespaced — `registry.ts`):** `company.message (confirm, server)`, `company.open (safe, browser)`

**Env var (add to §5):** `COMPANY_CHAT_MAX_HANDOFF_DEPTH` (default `5`) — caps recursive employee-to-employee delegation to prevent loops.

---

## 7. Two challenges to the proposal (per design discipline)

1. **A single `kind='company'` conversation will not scale as the firehose UI.** Showing *all* employees' back-and-forth in one thread is visually compelling but becomes unreadable past a few concurrent runs and makes pagination/RLS-filtered replay expensive. Recommendation: keep the singleton as a *projection* (a filtered live feed over `conversation_messages`), but persist work in `kind='task'` conversations. This avoids one hot row and unbounded thread growth. Confirm before building the singleton-write path.

2. **Recursive handoffs risk infinite loops and runaway cost.** Employees delegating to employees, each spawning an `agent/run`, can fan out without bound — the existing per-run cost ceiling (`maxCostUsdPerRun`, `agent.run.ts:92`) does not cap the *tree*. The `COMPANY_CHAT_MAX_HANDOFF_DEPTH` env var and a tree-level budget are mandatory, not optional. Question: should depth/budget be per-workspace config or a hard platform limit?

**Tone Check** — Internal design doc, not external-facing; brand-voice scoring (Warm but Authoritative) is not applicable. Tone is authoritative and direct, consistent with engineering documentation standards.

---

## Executive summary

This section designs four capabilities on top of the existing durable runtime, without inventing runtime behaviour that the codebase does not already have a primitive for:

- **Per-employee controls** — activate/deactivate, bypass-permission, approval gate, and plan-mode — modelled as a single `employee_controls` row per agent, surfaced through new `/v1/agents/:id/controls` routes and enforced inside `apps/api/src/inngest/agent.run.ts`.
- **Long-running scheduled employees** — driven by a real Inngest cron function (`employee/scheduled-tick`) that reads `agent_triggers` (type=`schedule`) and emits the existing `agent/run` event, plus a heartbeat/budget-over-time guard.
- **Approval flow with email** — wires the already-present `EmailService` (`apps/api/src/email/email.service.ts`) and the `notifications` table to the existing `step.waitForEvent('approval/decided', …)` pause primitive, with signed approve/reject links.
- **Conversational human-in-the-loop** — an "ask the user what to do next" pause built on the same `waitForEvent` primitive via a new `employee/input.provided` event.

"Employee" is a UI label only. Every name below — table, column, route, event, action — uses the canonical `agent` domain, per the locked naming rules (`agents` table, `agent/run` event remain unchanged).

---

## 1. Per-employee controls as state

### 1.1 Why a separate `employee_controls` table

The four controls are **mutable operational state**, not version-immutable config. `agent_versions.config` (`packages/db/src/schema/agents.ts:84`) is immutable by design, and `agents.mode` (`agents.ts:60`) is a separate promotion lifecycle (`sandbox → production`). Toggling "deactivate" must not mint a new version. A dedicated 1:1 table keeps controls auditable and RLS-scoped, and avoids polluting `AgentInputSchema` (`packages/shared/src/schemas/agent.ts`) which gates version creation.

### 1.2 The four controls (and their states)

| Control | Column | Semantics |
|---|---|---|
| Activate / deactivate | `activation_state` (enum) | `active` → eligible to run; `paused` → new runs rejected, scheduled ticks skipped; `archived` → terminal, hidden from nav. |
| Bypass-permission | `bypass_permission` (bool) | When true, the approval gate is skipped entirely (auto-approve). Requires `admin`+ to set; every bypassed action still writes an `audit_logs` row. |
| Approval gate | `approval_mode` (enum) | `always` (gate every risky tool), `risky_only` (default — gate `confirm`/`destructive`), `never`. Distinct from `bypass_permission`: the gate decides *what* needs approval; bypass decides *whether* a human is asked. |
| Plan-mode | `plan_mode` (bool) | When true, the run produces a plan artifact and pauses for plan approval before executing any tool. |

### 1.3 Control evaluation order (in `agent.run.ts`)

Insert a `load-controls` `step.run` immediately after `resolve-run` (today a stub at `agent.run.ts:38`). The loop then evaluates, per risky tool call:

```
if activation_state != 'active'        -> NonRetriableError (run rejected at resolve)
if plan_mode and first tool call       -> emit plan, waitForEvent('employee/input.provided') gate
needsApproval = approvalGate(approval_mode, tool.riskClass)
if needsApproval and bypass_permission -> auto-approve + audit_log (skip waitForEvent)
if needsApproval and !bypass_permission-> create approval + email + waitForEvent('approval/decided')
```

This replaces the current name-heuristic at `agent.run.ts:128-132` (`includes('delete')`) with a data-driven gate reading `connector_risk_class` / `mcp_tools.approval_required` (the column already exists per `packages/db/src/schema/connectors.ts`).

### 1.4 REST surface

All under the existing `AgentController` pattern (`apps/api/src/agent/agent.controller.ts`), guarded by the existing `AuthGuard → TenantGuard → RbacGuard` chain. Use `@RequireRole('admin')` on mutating control routes (bypass-permission especially):

- `GET /v1/agents/:id/controls` — read current control state (member+).
- `PATCH /v1/agents/:id/controls` — set activation/approval/plan/bypass (admin+).
- `POST /v1/agents/:id/activate` and `POST /v1/agents/:id/deactivate` — convenience toggles (member+ for activate, admin+ for deactivate).

Note: `POST /v1/agents/:id/activate/:versionId` already exists for *version* activation (`agent.controller.ts:95`). The new control routes are distinct (`/activate` with no `:versionId`) and must be documented to avoid collision.

---

## 2. Long-running employees with scheduling (Inngest cron)

### 2.1 Current gap

`agent_triggers` (type=`schedule`, `agents.ts:94-106`) exists but **nothing reads it** — there is no `inngest.createFunction` with a cron trigger anywhere; only 4 functions are registered (`apps/api/src/inngest/index.ts`). BUILD_GUIDE §6 line 205 already mandates the schedule→cron→`agent/run` path.

### 2.2 Design — one polling cron, not per-agent functions

Inngest cron functions are defined statically at boot; we cannot create one Inngest function per DB row at runtime. The correct pattern is **a single scheduled function that fans out**:

```ts
// apps/api/src/inngest/employee.scheduled-tick.ts
export const employeeScheduledTickFunction = inngest.createFunction(
  { id: 'employee/scheduled-tick', name: 'Dispatch scheduled employees' },
  { cron: '* * * * *' },              // every minute
  async ({ step }) => {
    const due = await step.run('find-due', () =>
      // systemDb scan of agent_triggers WHERE type='schedule' AND enabled
      // AND next_run_at <= now(), grouped per org for withTenant fan-out
    );
    for (const trigger of due) {
      await step.sendEvent(`emit-${trigger.id}`, {
        name: 'agent/run',
        data: { runId: crypto.randomUUID(), agentId: trigger.agentId,
                organizationId: trigger.organizationId, workspaceId: trigger.workspaceId,
                triggerType: 'schedule' },
      });
      // advance next_run_at via cron-parser inside withTenant
    }
  },
);
```

`agent_triggers.config` holds the cron expression and timezone, e.g. `{ "cron": "0 9 * * 1", "tz": "Australia/Sydney" }`. Register the new function in **both** `inngest/index.ts` and the `INNGEST_FUNCTIONS` array in `apps/api/src/inngest-endpoint/inngest.controller.ts:12` (the codebase requires both).

### 2.3 Long-running guards (budget-over-time, heartbeat)

A single per-run `maxCostUsdPerRun` (`agent.run.ts:92`) is insufficient for an employee that runs for days. Add to `employee_controls`:

- `max_runs_per_day` (int) — checked in `find-due` to throttle a runaway schedule.
- `daily_cost_cap_usd` (numeric) — summed from `agent_runs.cost_usd` for the rolling 24h window before each scheduled `agent/run` is emitted; over-cap emits `run/finished` with a `failed`+`COST_LIMIT_EXCEEDED` reason instead of running.
- `heartbeat_interval_s` (int) — for genuinely long agentic loops, emit a `run:status` WebSocket beat each N steps so the supervision UI shows liveness.

### 2.4 REST surface for triggers

- `POST /v1/agents/:id/triggers` — create a schedule trigger (admin+).
- `GET /v1/agents/:id/triggers` · `PATCH /v1/agents/:id/triggers/:triggerId` · `DELETE /v1/agents/:id/triggers/:triggerId`.

---

## 3. Approval flow with email notification

### 3.1 Wire the existing pause primitive

The durable gate already exists and is correct: `step.waitForEvent('approval-<id>', { event: 'approval/decided', timeout: '7d', match: 'data.approvalId' })` (`agent.run.ts:141`). What is missing is persistence and notification. The `create-approval` step (`agent.run.ts:136`, currently returns a fake id) must, inside `withTenant`:

1. Insert an `approvals` row (`agents.ts:172`) — `kind`, `payload` (the tool call + args), `status='pending'`.
2. Transition `agent_runs.status` → `waiting_approval` (valid per BUILD_GUIDE §10).
3. Emit `approval:created` on the `/runs` WebSocket namespace via `RunsGateway.emitApprovalCreated` (`apps/api/src/gateway/runs.gateway.ts`) — already defined, never called.
4. Insert a `notifications` row (`platform.ts:103`, `kind='approval'`).
5. Call `EmailService.send` (`apps/api/src/email/email.service.ts:31`) to the approver(s) with **signed approve/reject deep links**.

### 3.2 Signed email links — no new auth surface needed

Email recipients are not in a browser session, so the approve/reject link carries an HMAC-signed token (signed with a new `APPROVAL_LINK_SECRET` env var). New public routes verify the token and emit `approval/decided` directly:

- `GET /v1/approvals/:id/email-decision?token=…&decision=approved|rejected` — `@SetMetadata('isPublic', true)`, validates HMAC + expiry + that the approval is still `pending`, then does what `decide()` should do.

### 3.3 Fix the broken `decide()` endpoint

`apps/api/src/run/run.controller.ts:55-62` currently hardcodes `runId:'todo'` and `decision:'approved'` and ignores the body. Replace with: read the `approvals` row inside `withTenant` to get the real `runId`, parse `{ decision: 'approved' | 'rejected', reason? }` from the body (validated by a new `ApprovalDecisionSchema` in `packages/shared`), update the row (`status`, `decided_by`, `decided_at`), then emit `approval/decided` with the **real** `runId` and decision. On rejection the run loop already handles the tool-error path (`agent.run.ts:147-155`).

---

## 4. Conversational human-in-the-loop ("ask the user what to do next")

### 4.1 Distinct from approval

Approval is binary (approve/reject a *known* action). The conversational pause is open-ended: the agent asks a free-text question and waits for free-text guidance. It reuses the same durable `waitForEvent` mechanism but a different event.

### 4.2 Runtime

Introduce a `builtin:ask-user` tool. When the model calls it, the loop:

1. Inserts an `approvals` row with `kind='custom'` (reuse the existing enum value — no new kind needed) and `payload={ question, options? }`.
2. Transitions `agent_runs.status` → `waiting_approval`, emits `approval:created` + notification + email (same as §3).
3. `await step.waitForEvent('ask-<id>', { event: 'employee/input.provided', timeout: '7d', match: 'data.approvalId' })`.
4. Pushes the user's answer back into `messages` as a tool result and continues the loop.

### 4.3 REST surface

- `POST /v1/runs/:id/respond` — body `{ approvalId, answer: string }`; emits `employee/input.provided`. Reuses the run-scoped guard chain.

---

## 5. State machine (authoritative for this design)

The `agent_runs.status` machine (BUILD_GUIDE §10) already covers the lifecycle; this design **adds no new run statuses**. It clarifies which control drives each transition and adds the `employee_controls.activation_state` machine.

```
agent_runs.status (existing — reused):
  queued -> running
  running -> waiting_approval        (approval gate OR ask-user; bypass_permission skips this)
  waiting_approval -> running        (approval/decided=approved OR employee/input.provided)
  waiting_approval -> failed         (rejected and fatal) | cancelled
  running -> paused                  (POST /v1/runs/:id/pause)
  paused -> running                  (POST /v1/runs/:id/resume -> run/resumed)
  running -> succeeded | failed | cancelled   (terminal)

employee_controls.activation_state (NEW):
  active  -> paused                  (deactivate; in-flight runs continue, new/scheduled rejected)
  paused  -> active                  (activate)
  active  -> archived | paused -> archived   (terminal; agent hidden, soft-delete-like)

approvals.status (existing — reused for both approval gate and ask-user):
  pending -> approved | rejected     (terminal)
```

`plan_mode` does **not** add a status — the plan-approval pause is a `waiting_approval` state with an `approvals` row of `kind='custom'`, keeping the §10 machine intact.

---

## 6. New canonical names (add to BUILD_GUIDE before coding)

> Per golden rule #1, every name below must be added to `docs/BUILD_GUIDE.md` (and `packages/db/src/schema/agents.ts` + the inline `appSchema` in `apps/api/src/drizzle/drizzle.service.ts`) **first**, then used. Reusing existing names (`agents`, `agent_triggers`, `approvals`, `agent/run`, `approval/decided`, `run/resumed`, `run/cancelled`, `notification_kind='approval'`, `approval_kind='custom'`) requires no additions.

### New table

| Table | Key columns | Notes |
|---|---|---|
| `employee_controls` | `id`, `...tenantColumns()`, `agent_id` (uuid, unique), `activation_state` (enum), `approval_mode` (enum), `bypass_permission` (bool), `plan_mode` (bool), `max_runs_per_day` (int), `daily_cost_cap_usd` (numeric), `heartbeat_interval_s` (int), `...timestamps()` | 1:1 with `agents`. Must register RLS in **both** `packages/db/src/rls/policies.sql` and `packages/db/scripts/setup-rls.sql`. |

### New enums (snake_case)

- `activation_state`: `active` · `paused` · `archived`
- `approval_mode`: `always` · `risky_only` · `never`

### New columns on existing tables

- `agent_runs.trigger_type` already exists; no change. Add `agent_runs.failure_reason` (text, nullable) to carry `COST_LIMIT_EXCEEDED` / `KILL_SWITCH_ACTIVE`.
- `approvals.expires_at` (timestamp) — for the 7d email-link expiry alignment.

### New Inngest events (slash-namespaced)

| Event | Emitted when | Payload |
|---|---|---|
| `employee/scheduled-tick` | Internal cron trigger fans out due schedules | (cron — no payload) |
| `employee/input.provided` | User answers an `ask-user` conversational pause | `{ runId, approvalId, answer }` |

### New REST routes (under `/v1`)

- `GET /v1/agents/:id/controls` · `PATCH /v1/agents/:id/controls`
- `POST /v1/agents/:id/activate` · `POST /v1/agents/:id/deactivate`
- `POST /v1/agents/:id/triggers` · `GET /v1/agents/:id/triggers` · `PATCH /v1/agents/:id/triggers/:triggerId` · `DELETE /v1/agents/:id/triggers/:triggerId`
- `GET /v1/approvals/:id/email-decision` (public, HMAC-token)
- `POST /v1/runs/:id/respond`

### New shared Zod contracts (`packages/shared`)

- `EmployeeControlsSchema` (activation/approval/plan/bypass + the long-running caps)
- `ApprovalDecisionSchema` (`{ decision: 'approved' | 'rejected', reason?: string }`)
- `ScheduleTriggerConfigSchema` (`{ cron: string, tz: string }`)
- `EmployeeInputSchema` (`{ approvalId, answer }`)

### New env vars (add to `.env.example` + BUILD_GUIDE §5)

- `APPROVAL_LINK_SECRET` — HMAC key for signed approve/reject email links.
- `APPROVAL_LINK_TTL_HOURS` (default `168` = 7d) — matches the `waitForEvent` timeout.

### No new AI Controller actions or WebSocket namespaces

The `/runs` namespace and its `approval:created` event already cover the live-tracking need. No dot-namespaced action is required because these controls are server mutations exposed as REST routes, not browser-target Controller actions.

---

## 7. Files to touch (implementation map)

| Concern | File |
|---|---|
| Controls table + enums | `packages/db/src/schema/agents.ts`; RLS in `packages/db/src/rls/policies.sql` + `packages/db/scripts/setup-rls.sql`; mirror inline in `apps/api/src/drizzle/drizzle.service.ts` |
| Control + trigger REST | `apps/api/src/agent/agent.controller.ts` (+ `agent.service.ts`) |
| Approval decide fix + respond | `apps/api/src/run/run.controller.ts` |
| Cron fan-out | new `apps/api/src/inngest/employee.scheduled-tick.ts`; register in `apps/api/src/inngest/index.ts` + `apps/api/src/inngest-endpoint/inngest.controller.ts` |
| Gate, plan-mode, ask-user, persistence, email, WS emit | `apps/api/src/inngest/agent.run.ts` (replace stubs at lines 38, 128–139, 173–191) |
| Email + notification | `apps/api/src/email/email.service.ts`, `packages/db/src/schema/platform.ts` (`notifications`) |
| Live tracking | `apps/api/src/gateway/runs.gateway.ts` (`emitApprovalCreated`/`emitRunStatus`, currently uncalled) |
| Contracts | `packages/shared/src/schemas/agent.ts` (+ run.ts) |

---

## Tone Check

- **Warmth:** Moderate. The section is technical-reference register; it is clear and helpful but intentionally neutral, not conversational. Score 3/5 — appropriate for an internal engineering design, slightly below a customer-facing warm tone.
- **Authority:** High. Claims are grounded in exact file paths and line numbers from the live codebase, distinguishes reused names from new ones, and refuses to invent runtime behaviour. Score 5/5.
- **Verdict:** On-brand for an internal "warm but authoritative" engineering artifact. No emojis, active voice, no contractions, formal register as required.

---

## Executive summary

This design adds a two-tier RBAC model to Bitecodes without breaking the existing coarse role chain. **Tier 1** keeps the live `roleEnum` (`owner > admin > member > viewer`) and the rank-based `RbacGuard` (`apps/api/src/common/guards/rbac.guard.ts`) untouched as the open-core default — beginner-simple, four roles, zero config. **Tier 2** is a license-gated permission layer (the empty `ee/rbac/src/index.ts` stub) that resolves a role to an explicit **permission-scope set** and, critically, to **per-employee tool grants** including the `bypassPermission` control. The web app derives a single `permissions` object from the session and gates the new 5-item nav, page access, and every per-employee button from it. Advanced scopes stay hidden behind progressive disclosure until an admin opts in.

I am challenging two implicit assumptions in the brief before the detail:
- **"RBAC across every per-employee control" should not mean a new role per employee.** Per-employee control belongs on a *grant* table (employee × principal), not on the membership role. Otherwise the role enum explodes and beginners drown. The design separates org/workspace role (coarse) from per-employee grants (fine).
- **"bypass-permission" must be a deliberately dangerous, audited capability, not a checkbox.** Below it is gated behind a dedicated scope `employee:bypass`, never granted to `member`/`viewer`, and every bypass run writes an `audit_logs` row. Granting bypass to a beginner role would silently defeat the approval gate that the rest of the brief depends on.

---

## 1. Role model (two tiers, beginner-first)

### Tier 1 — Coarse roles (unchanged, open-core default)
Keep the canonical `RoleSchema` in `packages/shared/src/enums.ts` and `roleEnum` in `packages/db/src/schema/identity.ts` exactly as they are. Beginners only ever see these four:

| Role | Beginner label (UI only) | Rank | Default capability |
|---|---|---|---|
| `owner` | Owner | 4 | Everything incl. billing, kill-switch, bypass grants |
| `admin` | Manager | 3 | Manage employees, connectors, approvals, members |
| `member` | Operator | 2 | Run/chat with employees they are granted; create in sandbox |
| `viewer` | Observer | 1 | Read-only: watch the company chat, view runs, no actions |

The rank-based `RbacGuard` already enforces `@RequireRole(...)` via `ROLE_RANK`. We **layer scopes on top** rather than replace it, so every existing controller keeps working.

### Tier 2 — Scope resolution (the permission layer)
Each coarse role expands to a fixed set of **permission scopes**. This mapping lives in `ee/rbac/src/index.ts` (default map ships in open-core; *custom* role→scope overrides are license-gated). A scope is a `domain:action` string validated by a new `PermissionScopeSchema` in `packages/shared`.

```
viewer  → company:read, employee:read, run:read, chat:read
member  → (viewer) + chat:write, run:create, employee:create_sandbox
admin   → (member) + employee:manage, employee:activate, approval:decide,
                     connector:manage, member:manage, employee:tool_grant
owner   → (admin)  + employee:bypass, employee:promote_production,
                     billing:manage, org:kill_switch, rbac:custom_roles
```

Resolution function (open-core, deterministic; ee can override):
```ts
// ee/rbac/src/index.ts  (currently just a license stub)
export function scopesForRole(role: Role, custom?: RoleScopeOverride): PermissionScope[]
```
`RbacGuard` gains an optional `@RequireScope('employee:bypass')` decorator (additive to `@RequireRole`). Where a handler declares a scope, the guard checks `scopesForRole(req.memberRole).includes(scope)`; where it does not, behaviour is unchanged.

---

## 2. Per-employee permissions and tool scopes

The brief's "every per-employee control" maps to one new table plus columns on `agents` (the table stays named `agents` per the naming rule — "Employees" is UI label only).

### New columns on `agents` (`packages/db/src/schema/agents.ts`)
- `active boolean NOT NULL DEFAULT true` — activate/deactivate control.
- `execution_mode employee_execution_mode NOT NULL DEFAULT 'approval'` — new pgEnum `['autonomous','approval','plan']` covering bypass-permission (`autonomous`), approval gate (`approval`), and plan-mode (`plan`).
- `supervisor_agent_id uuid` — the hierarchy/supervision link (employee watches another employee).

These must also be mirrored in the API's inline schema at `apps/api/src/drizzle/drizzle.service.ts` (the gap noted in the map — the inline `appSchema` duplicates `packages/db`).

### New table `employee_tool_grants`
Per-employee tool scope + the bypass control, modelled on the existing `mcp_tools.approval_required`/`risk_class` precedent (`packages/db/src/schema/connectors.ts:78`).

| column | type | meaning |
|---|---|---|
| `id` | uuid PK | |
| `organization_id`, `workspace_id` | `...tenantColumns()` | RLS scope |
| `agent_id` | uuid | the employee |
| `tool_ref` | text | encoded ref `mcp:*`/`connector:*`/`builtin:*` (matches `AgentInputSchema`) |
| `risk_class` | `connector_risk_class` | reuse existing enum `read\|write\|destructive` |
| `approval_required` | boolean default true | per-tool approval gate |
| `bypass_permission` | boolean default false | the dangerous control; **only settable with scope `employee:bypass`** |
| `granted_by` | uuid | actor, for audit |

Effective gate at runtime = `bypass_permission ? skip : (approval_required OR risk_class != 'read')`. This is consumed in `apps/api/src/inngest/agent.run.ts` where the current approval check is a stubbed string match on `delete`/`send` — replace that heuristic with a `withTenant` read of `employee_tool_grants` for the run's `agent_id`.

### Per-employee control → enforcement point
| Control | Stored on | Scope to change it | Enforced where |
|---|---|---|---|
| Activate / deactivate | `agents.active` | `employee:manage` | controller short-circuits a run if `!active`; nav/list greys it |
| Bypass permission | `employee_tool_grants.bypass_permission` | `employee:bypass` (owner) | `agent.run.ts` approval step |
| Approval gate | `agents.execution_mode='approval'` + per-tool flag | `employee:manage` | `agent.run.ts` `step.waitForEvent('approval/decided')` |
| Plan mode | `agents.execution_mode='plan'` | `employee:manage` | new plan-approve gate before execute loop |
| Promote sandbox→production | `agents.mode` | `employee:promote_production` (owner) | `PATCH /v1/agents/:id` handler |

---

## 3. API enforcement (build on existing guards)

The three global guards run `AuthGuard → TenantGuard → RbacGuard` (`apps/api/src/app.module.ts`). No new guard ordering is needed.

1. **Coarse gate**: annotate existing handlers, e.g. `member.controller.ts` `PATCH /v1/members/:id/role` already needs `@RequireRole('admin')`; add `@RequireRole('owner')` to billing/kill-switch.
2. **Scope gate**: add `@RequireScope(...)` to per-employee mutations. Example: the bypass toggle endpoint carries `@RequireScope('employee:bypass')`.
3. **Resource-level check** (the part role rank cannot express): for `member` running an employee, the handler must verify a per-user employee grant. This is a thin service call `rbacService.canActUpon(ctx, agentId, scope)` that runs inside `withTenant` and reads `employee_tool_grants` + `agents.workspace_id`. It returns `FORBIDDEN` (existing error code) otherwise.

All checks reuse the canonical `FORBIDDEN`/`NOT_LICENSED` error codes (BUILD_GUIDE §12) — no new codes.

---

## 4. Web app gating (5-item nav + pages + controls)

### Session-derived permissions object
Add `apps/web/src/lib/permissions.ts`: a pure helper `can(scope)` reading a `permissions` array fetched once from a new `GET /v1/members/me/permissions` and held in a React context provider (mount in `apps/web/app/[locale]/app/layout.tsx`, alongside the existing `Providers`). This replaces the hardcoded `Test User`/`Demo Workspace` identity in `apps/web/src/components/shell/sidebar.tsx`.

### Nav reduction + RBAC visibility
Rewrite the hardcoded `navItems` array in `sidebar.tsx`. Each item gains a `scope` and a `tier` (`primary`/`secondary`):

```ts
const navItems = [
  { href:'/app/dashboard',  label:'Dashboard', scope:'company:read',     tier:'primary' },
  { href:'/app/agents',     label:'Employees', scope:'employee:read',    tier:'primary' }, // route + table stay "agents"
  { href:'/app/knowledge',  label:'Knowledge', scope:'employee:read',    tier:'primary' },
  { href:'/app/connectors', label:'Connectors',scope:'connector:manage', tier:'primary' },
  { href:'/app/settings',   label:'Settings',  scope:'company:read',     tier:'primary' },
  // demoted — hidden behind a "More" disclosure, still routable:
  { href:'/app/workflows',  label:'Workflows', scope:'employee:manage',  tier:'secondary' },
  { href:'/app/content',    label:'Content',   scope:'chat:write',       tier:'secondary' },
  { href:'/app/inbox',      label:'Inbox',     scope:'chat:write',       tier:'secondary' },
  { href:'/app/marketplace',label:'Marketplace',scope:'employee:create_sandbox', tier:'secondary' },
  { href:'/app/analytics',  label:'Analytics', scope:'run:read',         tier:'secondary' },
];
```
Render rule: show item only if `can(item.scope)`; `tier:'secondary'` items collapse under a progressive-disclosure "More" group (Apple-grade: hidden until expanded). This satisfies "5 primary; others kept/demoted/hidden, everything still connected." Routes are unchanged so deep links and the `next.config.ts` legacy redirects keep working.

### Page-level guard
Add a small server boundary `requireScope(scope)` used by each authed page (or a shared `app/[locale]/app/layout.tsx` check) that 403-redirects to a friendly "ask your Manager for access" screen when the scope is missing. The existing `Connectors` page is currently a gap (no page yet) — this design assumes its route stub is added.

### Per-control gating
Every per-employee button (activate, bypass, approve, plan-mode) wraps in `can(scope)`; when false, render disabled with a tooltip rather than hiding, so beginners learn the capability exists but is gated.

---

## 5. New canonical names (add to BUILD_GUIDE before coding)

> Per golden-rule #1, add each of these to the named catalog in `docs/BUILD_GUIDE.md` in the same PR, then use.

**Tables / columns (§ schema, mirror in `apps/api/src/drizzle/drizzle.service.ts`):**
- table `employee_tool_grants` (columns above)
- `agents.active boolean`, `agents.supervisor_agent_id uuid`, `agents.execution_mode` (new pgEnum `employee_execution_mode` = `autonomous|approval|plan`)
- optional `role_scope_overrides` table (ee/custom roles): `organization_id`, `role`, `scopes jsonb`

**Shared types (`packages/shared`, defined ONCE):**
- `PermissionScopeSchema` (z.enum of the scope strings in §1) + `PermissionScope`
- `EmployeeExecutionModeSchema` = `['autonomous','approval','plan']`
- `EmployeeToolGrantSchema`

**REST routes (BUILD_GUIDE §7, under `/v1`, kebab-case):**
- `GET /v1/members/me/permissions` — resolved scope set for current user/workspace
- `GET /v1/agents/:id/tool-grants` · `PUT /v1/agents/:id/tool-grants` — manage per-employee grants
- `PATCH /v1/agents/:id/execution-mode` — set autonomous/approval/plan
- `PATCH /v1/agents/:id/active` — activate/deactivate
- (ee) `GET/PUT /v1/admin/roles` — custom role→scope overrides, gated by `NOT_LICENSED`

**No new** Inngest events, WebSocket namespaces, or AI Controller actions are required for RBAC itself — enforcement is synchronous in guards/handlers and inside the existing `agent/run` durable function. The bypass/approval decision continues to flow through the catalogued `approval/decided` event.

**Env var:** reuse existing `LICENSE_KEY` (already read by `ee/rbac/src/index.ts`); no new var.

---

## 6. Modularity, sequencing, and risk

- **Open-core vs ee split:** scope *resolution* and the four default roles ship open-core; *custom roles* and `role_scope_overrides` are gated by `assertRbacLicensed()` (existing `ee/rbac` helper). This keeps beginners on a zero-config path.
- **Backward compatibility:** because Tier 2 is additive (`@RequireScope` only tightens, never loosens, and absent annotations are no-ops), every current controller and the rank guard keep passing the 5 API tests.
- **Migration:** new columns default to safe values (`active=true`, `execution_mode='approval'`, `bypass_permission=false`) so existing employees inherit the *most-gated* posture, not the least.
- **RLS gap to fix in the same change:** the map notes RLS policies key only on `organization_id`, so workspace isolation is not DB-enforced. `employee_tool_grants` must register policies in **both** `packages/db/src/rls/policies.sql` and `scripts/setup-rls.sql` (the two files currently disagree) — otherwise tool grants could leak across workspaces in one org.

---

### Tone Check (Warm but Authoritative)
- **Warmth:** beginner role labels (Owner/Manager/Operator/Observer) and "ask your Manager for access" copy keep the tone approachable; gated controls are shown-but-disabled rather than hidden, which respects the user. Score 4/5.
- **Authority:** decisive defaults (most-gated posture on migration), explicit challenge of two assumptions, and grounding in real file paths and canonical rules convey command of the system. Score 5/5.
- **Risk note:** the section is direct about the bypass-permission danger without alarmism — on-brand. Overall: Warm but Authoritative, 4.5/5.

---

## Context & Memory Storage Architecture

### Executive summary

The platform must store five context classes for the "AI company" model: user-facing conversations, inter-agent (employee-to-employee) message threads, per-employee durable memory, run traces, and audit. The existing schema (`packages/db/src/schema/agents.ts`, `knowledge.ts`, `platform.ts`) covers run traces (`run_steps`, `agent_runs`) and a thin memory table (`agent_memories`) and audit (`audit_logs`), but has no conversation thread model, no inter-agent message bus, and no memory-write feedback loop. This design adds four tables, hardens RLS to workspace level, defines a layered prompt-assembly pipeline tied to `PromptAssembler`, and specifies retention and retrieval. It deliberately reuses the existing `vector(1536)` type and `withTenant()` RLS contract rather than inventing parallel storage.

> **Challenge to the stated requirements:** Two assumptions in the vision deserve scrutiny before build. (1) "A single unified company chat shows ALL agents and their internal back-and-forth, fully tracked in real time" — at scale this is an unbounded fan-out write/read problem; storing every inter-agent token in one conversation will make retrieval and RLS expensive. I recommend separating the *durable thread store* (below) from the *live tail* (Socket.IO `/runs`, ephemeral). (2) "Employees LEARN from inputs" via durable memory — this is reasonable, but auto-promoting raw conversation turns into `long_term` memory without a curation/dedup gate will poison retrieval. The design gates promotion behind an explicit `memory/consolidate` step. Confirm both before implementation.

Two clarifying questions that gate the table design:
- **Memory sharing scope:** Should `long_term` memory be private to one employee, or shared across an org's employees (company knowledge)? The design supports both via a `visibility` column, but the default changes retention and RLS.
- **Conversation ownership:** Is a "conversation" owned by a workspace (multi-user, like a Slack channel) or by a single user session? This determines whether `participants` is a join table or a column.

---

### 1. Storage layers and where each context class lives

| Context class | Table(s) | Hot path | Cold/retrieval path |
|---|---|---|---|
| User ↔ company conversations | `conversations`, `conversation_messages` (new) | Socket.IO `/runs` live tail | windowed replay + semantic recall |
| Inter-agent threads (handoffs) | `conversation_messages` with `author_type='agent'` + `agent_messages` (new, the durable bus) | Socket.IO `/runs` `run:step` | thread replay |
| Per-employee long-term memory | `agent_memories` (existing, extended) | — | pgvector cosine recall |
| Run traces / events | `agent_runs`, `run_steps` (existing) | Socket.IO `/runs` | indexed query by run/agent |
| Audit | `audit_logs` (existing, hardened) | — | append-only export |

Rationale: keep **durable** state in Postgres (single source of truth, RLS-enforced), keep the **live** stream in Socket.IO rooms `ws:<workspaceId>` (already implemented in `apps/api/src/gateway/runs.gateway.ts`). The gateway emits are derived from durable writes, never the reverse — this keeps the "fully tracked and observable" requirement satisfiable on reconnect/replay.

---

### 2. Table designs

All new tables follow the conventions in `packages/db/src/schema/helpers.ts`: `...tenantColumns()` (org NOT NULL, workspace nullable), `...timestamps()`, `primaryKey()`. Vector columns reuse the existing `vector` `customType` (1536 dims) from `knowledge.ts` — never a new dimension (BUILD_GUIDE §13). Each must register RLS in **both** `packages/db/src/rls/policies.sql` and `packages/db/scripts/setup-rls.sql`, and be mirrored into `apps/api/src/drizzle/drizzle.service.ts` (the inline `appSchema`) or queries will fail.

#### 2.1 `conversations` — the unified company-chat container

```ts
// packages/db/src/schema/conversations.ts (new file, export from schema/index.ts)
export const conversationKindEnum = pgEnum('conversation_kind', [
  'company',     // the unified multi-employee chat
  'direct',      // user ↔ single employee
  'agent_thread' // internal employee ↔ employee handoff sub-thread
]);

export const conversations = pgTable('conversations', {
  id: primaryKey(),
  ...tenantColumns(),
  kind: conversationKindEnum('kind').notNull().default('direct'),
  title: text('title'),
  rootAgentId: uuid('root_agent_id'),        // the orchestrator/supervisor employee
  parentConversationId: uuid('parent_conversation_id'), // agent_thread → parent company chat
  createdBy: uuid('created_by').notNull(),    // user id (null for system-spawned)
  lastMessageAt: timestamp('last_message_at', { withTimezone: true, mode: 'date' }),
  ...timestamps(),
  ...softDelete(),
}, (t) => [
  index('conversations_workspace_idx').on(t.workspaceId),
  index('conversations_parent_idx').on(t.parentConversationId),
]);
```

#### 2.2 `conversation_messages` — every turn, human or employee

This is the backbone of the "company chat" and the prompt-replay window. It stores both user turns and employee turns (including the inter-agent back-and-forth) so the unified chat is a single ordered query.

```ts
export const messageAuthorTypeEnum = pgEnum('message_author_type', ['user', 'agent', 'system']);

export const conversationMessages = pgTable('conversation_messages', {
  id: primaryKey(),
  ...tenantColumns(),
  conversationId: uuid('conversation_id').notNull(),
  runId: uuid('run_id'),                 // links a turn to the agent_run that produced it
  authorType: messageAuthorTypeEnum('author_type').notNull(),
  authorAgentId: uuid('author_agent_id'),// set when authorType='agent'
  authorUserId: uuid('author_user_id'),  // set when authorType='user'
  seq: integer('seq').notNull(),         // monotonic per conversation (ordering)
  content: text('content').notNull(),
  toolCalls: jsonb('tool_calls'),        // OpenAI tool_call array when present
  embedding: vector('embedding'),        // for semantic recall of long conversations
  tokenCount: integer('token_count'),
  metadata: jsonb('metadata'),           // citations, model, costUsd, visibility flags
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(sql`now()`),
}, (t) => [
  uniqueIndex('conv_messages_seq_idx').on(t.conversationId, t.seq),
  index('conv_messages_conv_created_idx').on(t.conversationId, t.createdAt),
  index('conv_messages_run_idx').on(t.runId),
]);
```

#### 2.3 `agent_messages` — the durable inter-agent bus

`run_steps.type='handoff'` and the `stepTypeEnum` `'handoff'` value already exist but have no runtime (confirmed in the codebase map). Rather than overload `run_steps` (which is per-run, not per-conversation), add a first-class directed message table. This is what backs "employees talk to each other and learn," the orchestration routing, and the "wrong employee → divert" prompt.

```ts
export const agentMessageKindEnum = pgEnum('agent_message_kind', [
  'handoff',     // route a task to another employee
  'reply',       // answer back to the requester
  'broadcast',   // supervisor → many
  'observation'  // supervisor watching, no action
]);

export const agentMessages = pgTable('agent_messages', {
  id: primaryKey(),
  ...tenantColumns(),
  conversationId: uuid('conversation_id'),     // the company chat this belongs to
  fromAgentId: uuid('from_agent_id').notNull(),
  toAgentId: uuid('to_agent_id'),              // null for broadcast
  kind: agentMessageKindEnum('kind').notNull(),
  runId: uuid('run_id'),                       // run that emitted it
  spawnedRunId: uuid('spawned_run_id'),        // run created in the recipient
  content: text('content').notNull(),
  payload: jsonb('payload'),                   // structured task spec
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(sql`now()`),
}, (t) => [
  index('agent_messages_conv_idx').on(t.conversationId),
  index('agent_messages_to_agent_idx').on(t.toAgentId),
]);
```

#### 2.4 `agent_memories` (existing) — extend, do not replace

The table already has `scope` ('thread' | 'long_term'), `threadId`, `embedding`, `expiresAt`. Add columns to support the company/learning model without inventing a parallel table:

- `kind` (new enum `memory_kind`: `episodic` | `semantic` | `procedural`) — distinguishes "what happened in this thread" from "a learned fact" from "a learned how-to."
- `visibility` (new enum `memory_visibility`: `private` | `workspace` | `organization`) — answers the sharing-scope question above.
- `sourceRunId` (uuid) — provenance for the feedback loop / audit.
- `salience` (numeric) — a 0–1 importance score used to rank promotion and decay.

Keep `threadId` as the `conversationId` for thread-scoped memory so memory and conversation join cleanly.

---

### 3. RLS and tenant isolation

Every query runs inside `withTenant(orgId, wsId, fn)` (`packages/db/src/client.ts`), which sets `app.current_org` and `app.current_workspace` GUCs. **Gap to fix in this work:** existing policies key only on `organization_id` — `app.current_workspace` is set but never enforced (confirmed in `policies.sql`). For conversation and memory data this is a real cross-workspace leakage risk within an org. New tables therefore get a **two-clause policy**:

```sql
-- packages/db/src/rls/policies.sql AND scripts/setup-rls.sql
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY conversation_messages_tenant ON conversation_messages
  USING (
    organization_id::text = current_setting('app.current_org', true)
    AND (
      workspace_id IS NULL
      OR current_setting('app.current_workspace', true) = ''
      OR workspace_id::text = current_setting('app.current_workspace', true)
    )
  )
  WITH CHECK (organization_id::text = current_setting('app.current_org', true));
```

Apply the identical pattern to `conversations`, `agent_messages`, and `agent_memories`. Two more isolation requirements:

- **pgvector recall must run inside `withTenant`.** Follow the exact pattern in `packages/ai-core/src/retrieval/kb-retrieval.ts` — the raw cosine SQL executes on the caller's tenant transaction so RLS filters rows. Memory recall reuses this; do **not** add an out-of-band query path.
- **Socket.IO rooms** already isolate by `ws:<workspaceId>`, but the gateways trust client-supplied `workspaceId` on `join` (codebase-map gap). Before wiring conversation streaming, the `/runs` gateway must verify the joining socket's session has membership in that workspace; otherwise the live company-chat tail leaks across tenants even though the DB does not.

The pgvector extension and HNSW indexes are **not** currently bootstrapped (codebase-map gap #4). New embedding columns require a migration adding `CREATE EXTENSION IF NOT EXISTS vector;` and HNSW indexes (`vector_cosine_ops`, m=16, ef_construction=64) on `conversation_messages.embedding` and the existing `agent_memories.embedding` / `document_chunks.embedding`, expressed as raw SQL (Drizzle cannot model HNSW).

---

### 4. Retention

| Data | Default retention | Mechanism |
|---|---|---|
| `conversation_messages` (raw turns) | 90 days hot | Inngest cron `memory/consolidate` summarizes then trims |
| `agent_messages` | 90 days | same cron; summaries land in `agent_memories` as `episodic` |
| `agent_memories` scope=`thread` | `expiresAt` TTL (existing column), default 30 days | swept by cron |
| `agent_memories` scope=`long_term` | indefinite, decayed by `salience` | re-ranked on recall; low-salience pruned |
| `run_steps` / `agent_runs` | 180 days then archived | export to object storage (MinIO) |
| `audit_logs` | indefinite, append-only | never deleted; export-only |

The consolidation loop is the "learning" mechanism and is **RAG-based, not fine-tuning** (per the vision). A scheduled Inngest function reads a closed thread's `conversation_messages`, calls `PromptAssembler`-adjacent summarization via `ModelRouter`, and writes a `semantic`/`episodic` row into `agent_memories` with provenance (`sourceRunId`) — gated so raw turns are not blindly promoted.

---

### 5. Retrieval and prompt assembly (tie to `PromptAssembler`)

`PromptAssembler.build()` in `packages/ai-core/src/prompt/prompt-assembler.ts` already accepts the exact inputs needed: `memory?: string[]` (prior turns), `retrievedChunks?: RetrievedChunk[]` (KB), `systemPrompt`, and `userInput`. The current gap is that `agent.run.ts` calls `build()` with empty memory/chunks. The assembly pipeline for an employee run becomes a fixed, layered budget:

1. **System / identity** (stable, cache-eligible) — employee `system_prompt` from `agent_versions.systemPrompt`. Use `buildWithCacheMarkers()` so the stable prefix is cached.
2. **Long-term memory** → `memory[]` head. Recall top-K from `agent_memories` (`scope='long_term'`, visibility-filtered) via pgvector cosine on `userInput`'s embedding, reusing the `embedQuery` + cosine SQL of `kb-retrieval.ts`. Ranked by `score * salience`.
3. **KB chunks** → `retrievedChunks[]`. Existing `retrieveChunks()` path, unchanged. Citations rendered by `PromptAssembler.renderCitations`.
4. **Conversation window** → `memory[]` tail. Last N `conversation_messages` for the active `conversationId`, ordered by `seq`. For long conversations exceeding the token budget, replace the middle with a `thread` summary from `agent_memories` (sliding-window + summary, not raw truncation).
5. **Inter-agent context** → when this run was spawned by a handoff, prepend the originating `agent_messages.payload` so the recipient employee has the task spec.
6. **User input** — current turn.

A new `DrizzleMemoryStore` implements the existing abstract `MemoryStore` (`packages/ai-core/src/memory/memory-store.ts`), replacing `NoOpMemoryStore`. Its `save()` writes `agent_memories`, `search()` runs the tenant-scoped cosine query, and `summarize()` calls `ModelRouter`. This is the single seam where the runtime gains memory — no other path writes memory.

---

### 6. Observability and the live company chat

- **Durable-first, stream-second:** every `conversation_messages` and `agent_messages` insert is followed by a `/runs` emit (`run:step` for agent turns, plus a new `conversation:message` event — see new names). The UI subscribes to `ws:<workspaceId>` and renders the unified chat; on reconnect it backfills from `GET /v1/conversations/:id/messages`. This satisfies "fully tracked and observable in real time" without making Socket.IO the system of record.
- **Run traces** stay in `run_steps` (already richly columned: cost, tokens, model, error). The company-chat message links to its run via `conversation_messages.runId`, so clicking a turn drills into the full trace.
- **Audit** (`audit_logs`) records orchestration decisions (route, divert, handoff, memory promotion) via the existing `AuditService.log()` (`apps/api/src/audit/audit.service.ts`), actorType `'agent'` | `'system'`.

---

### 7. New canonical names (add to BUILD_GUIDE.md FIRST, then code)

These do not exist yet and must be registered in `docs/BUILD_GUIDE.md` (and mirrored where noted) before any code uses them, per CLAUDE.md golden rule #1.

**Tables (BUILD_GUIDE §6 schema / packages/db/src/schema + drizzle.service.ts inline schema + both RLS files):**
- `conversations`
- `conversation_messages`
- `agent_messages`

**Columns added to existing `agent_memories`:** `kind`, `visibility`, `source_run_id`, `salience`.

**Enums (packages/db, with `pgEnum`):** `conversation_kind`, `message_author_type`, `agent_message_kind`, `memory_kind`, `memory_visibility`.

**Inngest events (slash-namespaced, BUILD_GUIDE §6):**
- `agent/handoff` — `{ fromAgentId, toAgentId, conversationId, organizationId, workspaceId, payload }` (the inter-agent routing event; recipient handler spawns `agent/run`).
- `memory/consolidate` — `{ conversationId, organizationId, workspaceId }` (retention + learning loop; scheduled and on-thread-close).

**REST routes (BUILD_GUIDE §7, under `/v1`):**
- `POST /v1/conversations` · `GET /v1/conversations` · `GET /v1/conversations/:id` · `GET /v1/conversations/:id/messages` · `POST /v1/conversations/:id/messages`
- `GET /v1/agents/:id/memories` · `DELETE /v1/agents/:id/memories/:memoryId` (operator inspection/forget for the learning loop)

**WebSocket events (BUILD_GUIDE §8, on the existing `/runs` namespace — do not add a new namespace; only `/runs`, `/controller`, `/inbox` are allowed):**
- `conversation:message` — `{ conversationId, message }`

**AI Controller action (dot-namespaced, `packages/ai-controller/src/registry.ts`):**
- `conversation.open` — `riskClass: safe`, `target: browser`, `argsSchema: { conversationId }` (lets the Controller surface the company chat). Add to `ACTION_REGISTRY` with a Zod `argsSchema`; the dispatcher maps `.`→`__` for OpenAI tool names.

**Env vars (BUILD_GUIDE §5 + `.env.example`):**
- `MEMORY_RETENTION_DAYS` (default `90`)
- `MEMORY_LONGTERM_TOPK` (default `5`)
- `CONVERSATION_WINDOW_MESSAGES` (default `20`)

---

### 8. Modularity and migration order

1. Add names to `docs/BUILD_GUIDE.md` (§5, §6, §7, §8) and the action to `registry.ts`.
2. Add tables/enums to `packages/db/src/schema/conversations.ts`, extend `knowledge.ts` `agent_memories`, export from `schema/index.ts`.
3. Write one Drizzle migration that also runs `CREATE EXTENSION vector` + HNSW indexes (raw SQL).
4. Register RLS in **both** `policies.sql` and `setup-rls.sql` with the two-clause (org + workspace) pattern; backfill the workspace clause onto existing conversation-adjacent tables.
5. Mirror new tables into the inline `appSchema` in `apps/api/src/drizzle/drizzle.service.ts`.
6. Implement `DrizzleMemoryStore` (replaces `NoOpMemoryStore`), wire it and the layered assembly into `apps/api/src/inngest/agent.run.ts`, and add the `agent/handoff` + `memory/consolidate` Inngest functions (register in `inngest/index.ts` and the `INNGEST_FUNCTIONS` array in `inngest-endpoint/inngest.controller.ts`).
7. Add the conversation REST controller (enqueue-only for agent turns; HTTP never calls models) and the `conversation:message` emit in `runs.gateway.ts`.

**Tone Check (Warm but Authoritative):** Authoritative — strong (grounded in real file paths, explicit gaps, decisive table designs). Warm — moderate (challenges assumptions and asks clarifying questions rather than dictating; could soften a touch). Net score: 8/10 against brand guidelines; the proactive challenge on the "single company chat" scale risk and the two gating questions keep it advisory rather than prescriptive.

---

## Onboarding, Beginner UX & Sellability

### Executive summary

This design makes a first-time user productive in under 60 seconds (the BUILD_GUIDE §13 "60-second onboarding" gate), hides advanced configuration behind progressive disclosure, and packages Bitecodes as a sellable white-label product on the Apache-core + `/ee` model. It introduces a small, additive set of canonical names (one new table, one new column, two settings keys, one Inngest event, two REST routes, one AI Controller action, and tier/feature-flag constants) and a single `useEntitlements()` gate that the new 5-item nav, the onboarding flow, and every per-employee control already reference. No existing names (the `agents` table, `agent/run` event, `/app/agents` route) are renamed — only the UI label changes to "Employees".

---

### 1. First-run experience (the 60-second path)

**Goal:** signup → one working Employee → one successful run, with zero advanced config visible.

**State model.** Onboarding is a server-owned checklist persisted in `settings` (no schema change: `settings.key = 'onboarding.state'`, scoped by `organization_id`/`workspace_id`). Steps: `created_org → hired_first_employee → connected_or_skipped → first_run_succeeded → done`. The web app reads it via a new `GET /v1/onboarding` and advances it via `POST /v1/onboarding/advance` (see new names). This keeps the wizard resumable across devices and avoids the current hardcoded `localStorage` anti-pattern.

**Flow (Apple-grade, full-screen, dismissible "Skip for now"):**

1. **Welcome / company naming** — names the org + first workspace. Backed by existing `organizations`/`workspaces` rows already created at signup (`packages/db/src/seed.ts` shows the shape).
2. **Hire your first Employee** — a 3-field form (name, role, goal) reusing the exact template grid in `apps/web/app/[locale]/app/agents/new/page.tsx` (the four `templates`: Social Media Manager, Blog Writer, Customer Support, Analytics Reporter). Calls the existing `agentsApi.create({ costTier:'auto', mode:'sandbox' })`. Everything else (model, guardrails, tools) defaults silently.
3. **Give it something to do** — a single prompt box that fires the existing `POST /v1/agents/:id/runs` → `agent/run` Inngest event (`apps/api/src/agent/agent.controller.ts`). The run streams live via the `/runs` WebSocket namespace into a mini transcript.
4. **Done** — confetti, then deep-link into the Company Chat with the new Employee pre-selected.

**Why server-side:** the run executor and approval gate are durable (`apps/api/src/inngest/agent.run.ts`), so onboarding completion must survive a refresh mid-run. The checklist row is updated from the `run/finished` handler, not the browser.

**New component files:**
- `apps/web/src/components/onboarding/OnboardingWizard.tsx` (client, full-screen overlay)
- `apps/web/src/components/onboarding/useOnboarding.ts` (TanStack Query hook over the two new routes — Providers already wires TanStack Query in `apps/web/src/components/providers.tsx`)
- `apps/web/src/components/onboarding/ChecklistDock.tsx` (persistent collapsed checklist on Dashboard after skip)

A `not-started` checklist forces a redirect to `/app/onboarding` from `apps/web/app/[locale]/app/layout.tsx` (the authed shell layout), which currently has no gate.

---

### 2. Progressive disclosure (hide advanced configs)

**Principle:** three disclosure levels, driven by one mode flag, not by scattering `{showAdvanced && …}` conditionals.

| Level | Who sees it | What is shown |
|---|---|---|
| **Essential** (default) | all beginners | name, role, goal, on/off toggle, "Run" |
| **Standard** | after `first_run_succeeded` | cost tier, schedule, approval gate, supervisor |
| **Advanced** | explicit "Show advanced" / admin+ | system prompt, guardrails JSON, model override, raw tool grants |

**Implementation:**
- Add a `<DisclosureSection level="advanced">` primitive in `apps/web/src/components/ui/` (the dir already exists with `empty-state.tsx`, `skeleton.tsx`). It reads the org-level UX mode from `settings.key = 'ux.disclosure_mode'` (`'beginner' | 'pro'`, default `'beginner'`).
- The Employee editor (`apps/web/app/[locale]/app/agents/[id]/page.tsx`) is refactored into tabs: **Overview** (essential), **Behavior** (standard), **Advanced**. The `personality`, `defaultModel`, and version `config` JSONB fields (`packages/db/src/schema/agents.ts`) live only under Advanced.
- **Smart defaults remove choices entirely for beginners:** `costTier='auto'` (router heuristic already exists in `packages/ai-core/src/model/model-router.ts`), `mode='sandbox'`, `guardrails` defaults from `AgentInputSchema` (`packages/shared/src/schemas/agent.ts`). The beginner never sees these unless they opt into Advanced.

**Sandbox→production as a disclosure event:** promoting an Employee from `sandbox` to `production` (the `agents.mode` state machine, BUILD_GUIDE §10 `sandbox -> production`, promotion only) is the moment Standard controls unlock for that Employee, framed as "Put this Employee to work for real."

---

### 3. Beginner-safe RBAC over nav, pages, and controls

The product requirement (RBAC across nav visibility, page access, per-employee control) is satisfied with the **existing 4-value `roleEnum`** (`owner/admin/member/viewer`, `packages/db/src/schema/identity.ts`) — custom roles stay an `/ee` feature per BUILD_GUIDE §1. No new roles are invented.

**One entitlement source of truth.** A new `GET /v1/entitlements` returns `{ role, plan, features[], navItems[] }` computed server-side from `memberships.role`, `subscriptions.plan`, and `feature_flags`. The web app consumes it via `useEntitlements()`:

- **Nav visibility:** the 5 primary items render only if `navItems` includes them. The `RbacGuard` (`apps/api/src/common/guards/rbac.guard.ts`, numeric `ROLE_RANK`) already enforces page access server-side; the client gate is cosmetic-only and never the security boundary.
- **Per-Employee controls** (activate/deactivate, bypass-permission, approval gate, plan-mode): each control is wrapped in `<RequirePermission can="employee.toggle_active">`. The mapping role→permission is a static table in `packages/shared` (new `EntitlementMatrix`), so it is the same on client and server.

This keeps RBAC modular: adding a control means adding one matrix entry, not editing guards.

---

### 4. The new 5-item nav and the demoted pages

`apps/web/src/components/shell/sidebar.tsx` currently hardcodes 9 items. It is rebuilt to render from `useEntitlements().navItems`, primary set:

`Dashboard · Employees · Knowledge · Connectors · Settings`

- **Employees** = label-only rename of Agents; `href` stays `/app/agents` (no route, table, or `agent/run` event rename — hard constraint).
- **Demoted pages** (Workflows, Content, Inbox, Marketplace, Analytics) remain fully routed and functional but move under a single "More" disclosure in the sidebar footer and into contextual entry points (e.g. Content/Inbox surface inside an Employee's detail). This satisfies "kept, demoted, connected, bug-free."
- The hardcoded "Demo Workspace / Free plan / Test User" identity (lines 56–104) is replaced by real session + workspace + plan from `useEntitlements()` and `auth-client`.

---

### 5. Sellability: plans, white-label, and what is gated

**Packaging model (Apache-core free; `/ee` license-gated):**

| Capability | Free (Apache core) | Pro / Team | Enterprise (`/ee`, `LICENSE_KEY`) |
|---|---|---|---|
| Employees, runs, Knowledge, 5 connectors | yes | yes | yes |
| Task-credit cap (BUILD_GUIDE §9: 1 credit = 1k fast-tier tokens) | low monthly grant | higher grant / BYO key | unlimited / BYO key |
| Beginner onboarding, progressive disclosure | yes | yes | yes |
| Long-running scheduled Employees, supervisor hierarchy | limited count | full | full |
| **White-label branding** (logo, colors, custom domain) | no | logo only | full + custom domain |
| SSO/SAML, SCIM, custom roles, audit export | no | no | yes (Phase 13) |

**Enforcement is already wired-for:** the `NOT_LICENSED` error code (BUILD_GUIDE §12) + `LICENSE_KEY` env var gate `/ee` features; `subscriptions.plan` + `feature_flags` + `credit_wallets` gate plan tiers. The single `useEntitlements()` / `EntitlementMatrix` covers all three so the paywall logic is not duplicated.

**White-label:** `organizations.branding` JSONB already exists. Beginner instances ignore it; Pro+ surfaces a Branding tab in Settings that writes `branding`, applied as CSS variables in `apps/web/app/[locale]/layout.tsx` (the Tailwind v4 `@theme` tokens in `src/styles/globals.css`). Custom domain is an Enterprise (`/ee`) gate.

**Sell-readiness surfaces:** the existing Marketplace (`templates` table, `/v1/templates`) becomes the discovery engine for pre-built Employees, and a new `<UpgradeNudge feature="…">` (rendered by `<RequirePermission>` on `NOT_LICENSED`/plan-gated denial) provides consistent, non-blocking upsell with one CTA into `billingApi.checkout`.

---

### 6. Modularity & connectivity checks

- Onboarding, entitlements, and disclosure are three independent modules sharing only the `EntitlementMatrix` contract and two `settings` keys — each is independently testable.
- Every demoted page keeps its route and API wiring; only its nav entry point moves. The Playwright `navigation.spec.ts` and `agents.spec.ts` (already in `apps/web/e2e/`) must be extended to assert the 5-item nav and the onboarding redirect.
- All new reads/writes go through `withTenant(orgId, wsId, fn)` and the three global guards; the onboarding routes are **not** public (unlike the Inngest serve endpoint).

---

### New canonical names (add to BUILD_GUIDE)

> Add to the named catalog **before** writing code (golden rule #1). Mirror any DB change into `packages/db/src/schema`, both RLS files (`src/rls/policies.sql` + `scripts/setup-rls.sql`), and the inline schema in `apps/api/src/drizzle/drizzle.service.ts`.

**Tables (BUILD_GUIDE §schema / ARCHITECTURE §6)**
- `onboarding_states` — `id`, `organization_id`, `workspace_id`, `step` (enum: `created_org`, `hired_first_employee`, `connected_or_skipped`, `first_run_succeeded`, `done`), `completed_at`, timestamps. (Alternative if avoiding a new table: persist under `settings.key='onboarding.state'`; if a table is added, register RLS in both SQL files.)

**Columns**
- `organizations.branding.theme` (sub-key inside existing `branding` JSONB; no DDL) — white-label tokens.

**Settings keys (no schema change; `settings` table)**
- `onboarding.state` — per-workspace checklist mirror.
- `ux.disclosure_mode` — `'beginner' | 'pro'`.

**Inngest events (slash-namespaced, BUILD_GUIDE §6)**
- `onboarding/completed` — `{ organizationId, workspaceId, userId }` (emitted from the `run/finished` handler when the first run succeeds; triggers welcome email via existing `EmailService`).

**REST routes (BUILD_GUIDE §7, under `/v1`)**
- `GET /v1/onboarding` · `POST /v1/onboarding/advance` — read/advance the checklist.
- `GET /v1/entitlements` — computed `{ role, plan, features[], navItems[] }`.

**AI Controller actions (dot-namespaced, `packages/ai-controller/src/registry.ts`)**
- `onboarding.next(safe, browser)` — lets the Controller drive the wizard ("hire my first employee"); `argsSchema` empty, `riskClass: 'safe'`, `target: 'browser'`.

**Shared types (`packages/shared`)**
- `EntitlementMatrix` / `EntitlementMatrixSchema` — role+plan → permitted permissions and `navItems`. Single source consumed by `RbacGuard`, `useEntitlements()`, and `<RequirePermission>`.
- `OnboardingState` / `OnboardingStateSchema`.

**Env vars** — none new; reuses `LICENSE_KEY`, `SUPERADMIN_EMAILS`.

---

### Tone Check (Warm but Authoritative)

- **Warmth:** beginner-first framing ("Hire your first Employee," "Put this Employee to work"), non-blocking upsell nudges, plain-language steps. Scores well.
- **Authority:** grounded in real file paths, existing guards, state machines, and the named-catalog discipline; gating tied to defined error codes. Scores well.
- **Net:** on-brand. One caution — confirm with stakeholders whether `onboarding_states` should be a real table or stay a `settings` row before committing the migration, to avoid RLS-coverage drift noted across the two SQL policy files.

---
