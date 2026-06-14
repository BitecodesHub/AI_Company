# Bitecodes — The Open-Source Agentic AI Operating System

> Build, run, and share AI agents that actually do the work.
> Starts as the easiest way to automate your social media. Grows into the operating system for your entire AI workforce.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Built with TypeScript](https://img.shields.io/badge/Built%20with-TypeScript-3178c6.svg)](https://www.typescriptlang.org/)

---

## What is Bitecodes?

Bitecodes is a **production-grade, multi-tenant, white-label Agentic AI platform** you can self-host with a single command or run as managed cloud. It combines four things that usually require four separate tools:

1. **An AI Agent Builder** — create agents with a role, goal, personality, tools, memory, and permissions. No code required.
2. **A Workflow Automation Engine** — long-running, durable, event-driven automations with a visual drag-and-drop canvas.
3. **A Social Media Automation Suite** (flagship) — connect your accounts, train a brand voice, and let agents draft, schedule, post, and reply across every network.
4. **An AI Controller** — the wow factor. Talk (or type) to your whole app: *"draft next week's LinkedIn posts, reply to the angry comment on Instagram, then open billing."* Bitecodes navigates, fills forms, and does the work for you across the entire product.

Everything is **AI-first but never AI-mandatory** — every automated action has a manual fallback, and every manual field has an "AI fill" option. Nothing is compulsory.

---

## Why Bitecodes exists

The agentic AI market in 2025–2026 is split into three exhausted categories:

- **Workflow tools** (Zapier, Make, n8n) — great plumbing, weak agents, restrictive licenses.
- **Agent builders** (Lindy, Dify, Flowise) — strong agents, weak integrations, weak distribution.
- **Vertical AI tools** (Buffer, Hootsuite, Sprout) — polished UX, zero programmability, expensive.

**No single product is simultaneously**: truly open (Apache 2.0), a horizontal agent + workflow OS, shipping a delightful social-automation flagship, MCP-native, community-driven, and Apple-grade in polish. That intersection is empty. Bitecodes fills it.

---

## Core principles

| Principle | What it means in practice |
|---|---|
| **Open-core, forever Apache 2.0** | The core is permissively licensed. We will never relicense it. Paid features live in a clearly-separated `/ee` directory. |
| **AI-first, never AI-forced** | Every screen offers AI assistance; every AI action has a manual alternative and an approval gate. |
| **Configurable from UI + env** | Anything an operator needs is editable in the admin UI; anything security-critical is set by environment variable. |
| **Single Docker to start** | `docker compose up` brings up the whole stack. Production scale-out is documented, not required on day one. |
| **No hallucinated dependencies** | Every library in this repo is real, pinned to an exact version, and listed in `package.json`/`requirements.txt`. |
| **Multi-tenant by construction** | Tenant isolation is enforced at the database layer with Postgres Row-Level Security, not just in application code. |
| **SEO on by default** | Every public page ships server-rendered with structured data, sitemaps, and AI-generated metadata. |

---

## The tech stack (real, pinned, and connected)

Bitecodes is a **TypeScript-first monorepo** with a single optional Python service for heavy AI work. This is a deliberate choice for a small team: one primary language, shared types end-to-end, no Spring Boot/JVM overhead.

| Layer | Technology | Why |
|---|---|---|
| Monorepo | Turborepo + pnpm | Fast, shared packages, one install |
| Frontend | Next.js 15 (App Router), React 19, TypeScript | SSR for SEO, best-in-class DX |
| UI | Tailwind CSS v4, shadcn/ui, Radix UI, lucide-react | Apple-grade polish, accessible primitives |
| Forms & validation | React Hook Form + Zod | Type-safe forms, shared schemas |
| Data fetching | TanStack Query v5 | Caching, optimistic updates |
| Light client state | Zustand | Simple, no boilerplate |
| Workflow canvas | React Flow (@xyflow/react) | Battle-tested node editor |
| Backend API | NestJS 11 (TypeScript), REST + WebSocket | Modular, OpenAPI, shares types with frontend |
| Realtime | Socket.IO | Reconnection-safe live run updates |
| Durable execution | Inngest | Long-running agents, retries, replay, pause/resume |
| AI worker (optional) | Python 3.12 + FastAPI | Embeddings, heavy RAG, LangGraph/CrewAI graphs |
| Model gateway | LiteLLM (self-hosted proxy) | 100+ providers, fallback, per-workspace virtual keys |
| Agent tools protocol | Model Context Protocol (official TS SDK) | Universal, vendor-neutral tool standard |
| Database | PostgreSQL 16 + pgvector | One store for relational + vector; RLS isolation |
| ORM | Drizzle ORM | TypeScript-native, first-class pgvector + RLS control |
| Cache / queue | Redis 7 + BullMQ | Short jobs, caching, rate limiting |
| Object storage | S3-compatible (MinIO self-host / Cloudflare R2) | Files, media, exports |
| Auth | Better Auth | Email, OAuth, SSO/SCIM plugin for enterprise |
| Billing | Lago (self-host) + Stripe | Usage metering, credits, wallets, invoicing |
| LLM observability | Langfuse | Traces, evals, cost per run |
| App observability | OpenTelemetry → Grafana/Loki/Tempo | Logs, metrics, traces |
| Email | Resend | Transactional email, no SMTP server to run |
| Deployment | Docker Compose; Fly.io / Railway / Hetzner + Coolify | One command locally; documented scale-out |

> **Version pinning:** exact versions live in each app's `package.json` and the Python `requirements.txt`. Do not use "latest." See `ARCHITECTURE.md` → "Dependency Versions" for the canonical list.

---

## Monorepo layout

```
bitecodes/
├── apps/
│   ├── web/                 # Next.js 15 frontend (user app + admin + public/SEO pages)
│   ├── api/                 # NestJS backend (REST + WebSocket + Inngest functions)
│   └── worker/              # Python FastAPI AI worker (embeddings, heavy graphs) — optional
├── packages/
│   ├── shared/              # Shared TS types + Zod schemas (the contract between web & api)
│   ├── db/                  # Drizzle schema, migrations, RLS policies, seed scripts
│   ├── ui/                  # Shared React component library (shadcn/ui based)
│   ├── ai-core/             # Agent runtime, prompt assembly, model-routing client, guardrails
│   ├── connectors/          # Connector framework + first-party integrations
│   ├── mcp/                 # MCP client + server wrappers
│   ├── ai-controller/       # Action registry + command bus for natural-language app control
│   ├── seo/                 # Sitemap, structured-data, metadata helpers
│   └── config/              # Shared eslint, tsconfig, tailwind, prettier
├── ee/                      # Enterprise features (proprietary license, license-key gated)
│   ├── sso/                 # SAML/OIDC/SCIM
│   ├── rbac/                # Advanced custom roles & tool-scope permissions
│   ├── audit/               # Audit export, SIEM forwarding, indefinite retention
│   └── guardrails-pro/      # Premium prompt-injection & PII vault
├── infra/
│   ├── docker/              # Dockerfiles per app
│   ├── compose/             # docker-compose.yml + override files
│   └── deploy/              # Fly.io, Railway, Coolify, k8s manifests
├── docs/                    # This documentation
├── docker-compose.yml       # Single-command local stack
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .env.example             # Every configurable variable, documented
├── README.md
├── BUILD_GUIDE.md           # the anti-hallucination build handbook (read first when building)
├── ARCHITECTURE.md
├── DEVELOPMENT_TASKS.md
└── LICENSE                  # Apache 2.0 (core) — see ee/LICENSE for enterprise terms
```

---

## Quick start (local, single command)

### Prerequisites
- Docker and Docker Compose v2
- (For development) Node.js 22 LTS and pnpm 9
- An LLM API key (OpenAI, Anthropic, Google, or OpenRouter) — **or** a local model via Ollama

### 1. Clone and configure
```bash
git clone https://github.com/your-org/prism.git
cd prism
cp .env.example .env
# Open .env and set at minimum:
#   POSTGRES_PASSWORD, AUTH_SECRET, ENCRYPTION_KEY
#   and ONE model provider key, e.g. OPENAI_API_KEY or OPENROUTER_API_KEY
```

### 2. Start everything
```bash
docker compose up
```

This launches: Postgres (+pgvector), Redis, MinIO, the Next.js web app, the NestJS API, the Inngest dev server, the LiteLLM gateway, and (optionally) the Python worker.

### 3. Open the app
- App: http://localhost:3000
- First-run wizard creates your admin user and first organization.
- API docs (Swagger): http://localhost:4000/docs
- Inngest dashboard: http://localhost:8288
- LiteLLM gateway: http://localhost:4001

### 4. Your first "wow" in 60 seconds
1. Pick a goal: **Grow my X / LinkedIn**.
2. Connect one social account (or choose "demo workspace" with sample data).
3. Paste 3–5 of your past posts → Bitecodes extracts your brand voice.
4. Get a week of posts drafted, scheduled, and waiting for one-click approval.
5. Meet the agent that did it — edit its prompt, tools, and schedule.

---

## Development setup (without full Docker)

```bash
pnpm install                      # install all workspaces
docker compose up postgres redis minio inngest litellm   # infra only
pnpm db:push                      # apply Drizzle schema
pnpm db:seed                      # seed demo data + templates
pnpm dev                          # runs web + api + worker in watch mode
```

Useful scripts (defined in root `package.json`):

| Script | Action |
|---|---|
| `pnpm dev` | Run web, api, worker concurrently |
| `pnpm build` | Build all apps |
| `pnpm db:generate` | Generate Drizzle migration from schema |
| `pnpm db:push` | Push schema to database |
| `pnpm db:migrate` | Run migrations |
| `pnpm db:seed` | Seed demo data |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |

---

## Feature overview

### For everyone
- **Agent builder** — role, goal, personality, prompt (versioned), model selection, tools, knowledge, memory, permissions, triggers, guardrails.
- **Workflow builder** — visual canvas with triggers, conditions, approvals, delays, loops, error/escalation branches.
- **Knowledge bases** — upload files, crawl websites, ingest URLs; RAG answers with source citations.
- **Connectors + MCP** — first-party integrations plus any MCP server, with a tool-approval gate.
- **Durable, long-running agents** — schedule them, trigger them on events, pause/resume/cancel, replay any run step-by-step.
- **Social automation** — multi-network publishing, AI content generation, brand voice, content calendar, unified inbox, AI replies.
- **AI Controller** — control the entire app by voice or text.
- **Cost & usage transparency** — a live cost meter; per-agent, per-workspace analytics.
- **Community & marketplace** — share, clone, remix, rate, and (later) sell agents, workflows, and brand voices.

### For admins
- **AI blog publishing** — topic → full SEO-optimized article → publish, with auto meta, structured data, and internal links.
- **AI customer replies** — inbox messages drafted by AI in your brand voice; approve or auto-send.
- **AI everywhere** — every admin field has an "AI fill" button; nothing manual is required.
- **Full control panel** — users, roles, billing, connectors, model controls, cost limits, kill switch, audit logs, white-label branding.
- **Auto-SEO** — sitemaps, robots, JSON-LD, Open Graph, programmatic landing pages, all generated and kept current automatically.

---

## Configuration model

Bitecodes reads configuration from two sources:

1. **Environment variables** (set at boot, never overridden by the UI): secrets, encryption keys, default model gateway URL, license key, allowed domains.
2. **Database settings** (editable in the admin UI per workspace): branding, default model, BYO API keys (encrypted), feature flags, allowed connectors, default prompt templates.

**Rule:** the UI value wins when both exist — *except* for security-critical settings (auth providers, audit destination, encryption key), which are environment-only.

See `.env.example` for every variable with inline documentation.

---

## Licensing

- **Core** (everything outside `/ee`): **Apache License 2.0**. Use it, fork it, embed it, sell services on it. We will never relicense the core. See [`LICENSE`](LICENSE).
- **Enterprise** (`/ee` directory): proprietary, source-available, requires a commercial license key to run. See [`ee/LICENSE`](ee/LICENSE).
- **Contributions**: by Developer Certificate of Origin (DCO), not a CLA — so the community keeps trust that the core stays open.

This avoids the relicensing backlash that hit other projects and the SaaS-embedding restrictions of "fair-code" / AGPL / "modified Apache" licenses. You can build and sell a white-label product on Bitecodes's core.

---

## Documentation map

| Document | Purpose |
|---|---|
| **README.md** (this file) | Overview, quick start, configuration |
| **BUILD_GUIDE.md** | The build handbook: golden rules, glossary, naming conventions, the canonical Inngest-event / REST-route / WebSocket catalogs, the complete environment-variable list, shared-type contracts, state machines, error codes, and the testing strategy. Read this first when building. |
| **ARCHITECTURE.md** | Full system architecture: every layer, the database schema, data flows, the AI Controller, the SEO engine, security, scaling |
| **DEVELOPMENT_TASKS.md** | Every build task broken to the smallest unit, phase by phase, with file paths and acceptance criteria — designed for an AI coding agent to execute in order |
| **Bitecodes_Development_Plan.docx** | The complete development plan with code context for frontend, backend, database, and MCP |
| `.env.example` | Every configurable environment variable, documented |

---

## Roadmap at a glance

- **V1 (Months 0–3):** Core platform + social flagship + AI Controller v1 + admin + SEO. Self-host + free cloud.
- **V1.5 (Months 3–6):** Visual workflow canvas, agency multi-workspace mode, 30+ connectors, Stripe billing live.
- **V2 (Months 6–12):** Community, marketplace (free), social listening, long-term memory, enterprise add-ons (SSO/RBAC/audit).
- **V2.5 (Months 12–18):** Marketplace monetization (70/30 revenue share), multi-agent collaboration, voice agents, browser automation v2, mobile app.
- **V3 (Months 18+):** On-prem/VPC, SOC 2 / HIPAA / GDPR, fine-tuning UI, vertical packs, embed SDK.

Full phasing lives in `DEVELOPMENT_TASKS.md`.

---

## Contributing

1. Read `BUILD_GUIDE.md` first, then `ARCHITECTURE.md` and `DEVELOPMENT_TASKS.md`.
2. Pick an unchecked task; one task per pull request where possible.
3. Sign your commits (`git commit -s`) for DCO.
4. Run `pnpm lint && pnpm typecheck && pnpm test` before opening a PR.
5. New connectors are especially welcome — see `packages/connectors/README.md` for the connector contract.

---

## License

Core: Apache License 2.0. Enterprise (`/ee`): proprietary. See `LICENSE` and `ee/LICENSE`.
