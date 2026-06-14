# Bitecodes — Production QA Audit

**Date:** 2026-06-13
**Scope:** Full runtime end-to-end QA of every page; fix broken functionality; wire missing CRUD/search; bring to production grade.
**Mode:** Full autonomy (self-paced loop). No commits to `main` without surfacing. No deletions of existing code.

## Environment
- Web: Next.js dev on `http://localhost:3002` (locale-prefixed routes).
- API: NestJS on `http://localhost:4000` (running built `dist`, not watch — API changes need rebuild).
- Postgres: `5432` (up). Redis/MinIO/Inngest/LiteLLM: starting via Docker Desktop.
- Test user: `test@bitecodes.com` / `Test1234!`.

## Static checks
- `@bitecodes/web` typecheck: PASS
- `@bitecodes/api` typecheck: PASS

## Findings log

| # | Severity | Area | Finding | Status |
|---|----------|------|---------|--------|
| 1 | Critical | web/providers | `providers.tsx` imports `Toaster` from `sonner`, but `sonner` was in `package.json` yet never installed → 500 on root layout, breaks every page. Also pinned `^1.7.4` → exact `1.7.4` per ARCHITECTURE §3. | Fixing (pnpm install) |

## Pages to verify (E2E)
Public: `/`, `/docs`, `/privacy`, `/terms` · Auth: `/login`, `/signup`, `/forgot-password`
App: `/app/dashboard`, `/app/agents` (+`/new`, `/[id]`), `/app/workflows` (+`/new`, `/[id]`), `/app/content`, `/app/inbox`, `/app/knowledge`, `/app/marketplace`, `/app/analytics`, `/app/settings`
Admin: (admin route group)

Per page check: loads without console/500 errors · primary CRUD (add/update/delete) works · search/filter works · empty + populated states · error handling.
