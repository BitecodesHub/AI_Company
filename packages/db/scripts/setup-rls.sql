-- Bitecodes — RLS bootstrap script.
-- Run ONCE as a superuser after migrations, before starting the API.
-- Usage: psql <superuser-url>/bitecodes -f packages/db/scripts/setup-rls.sql
-- Idempotent: safe to run multiple times.

-- ── 1-3. Application role + grants (self-managed superuser Postgres only) ─────
-- On managed Postgres (e.g. Render) the connecting user is the database OWNER,
-- not a superuser, and usually lacks CREATEROLE. There the app uses the owner
-- connection string for both DATABASE_URL and DATABASE_SUPERUSER_URL, so the
-- separate bitecodes_app role is unnecessary. Role creation + grants are therefore
-- best-effort: if the current user cannot manage roles, log and continue rather
-- than aborting the migration (which, under ON_ERROR_STOP=1, would fail the whole
-- deploy and leave the database without its schema).
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bitecodes_app') THEN
    CREATE ROLE bitecodes_app LOGIN PASSWORD 'bitecodes_app_secret' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    RAISE NOTICE 'Role bitecodes_app created.';
  ELSE
    RAISE NOTICE 'Role bitecodes_app already exists.';
  END IF;

  -- Schema usage + table/sequence privileges (current and future objects).
  GRANT USAGE ON SCHEMA public TO bitecodes_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bitecodes_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bitecodes_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bitecodes_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO bitecodes_app;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping bitecodes_app role/grants: current user cannot manage roles (managed Postgres). The app connects as the database owner instead.';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping bitecodes_app role/grants (SQLSTATE %): %', SQLSTATE, SQLERRM;
END
$role$;

-- ── 4. Enable + force RLS on every tenant-scoped table ───────────────────────
-- organizations is global (no RLS needed — callers filter by id explicitly)

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents FORCE ROW LEVEL SECURITY;

ALTER TABLE agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_versions FORCE ROW LEVEL SECURITY;

ALTER TABLE agent_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_triggers FORCE ROW LEVEL SECURITY;

ALTER TABLE employee_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_controls FORCE ROW LEVEL SECURITY;

ALTER TABLE agent_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_relationships FORCE ROW LEVEL SECURITY;

ALTER TABLE routing_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_decisions FORCE ROW LEVEL SECURITY;

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;

ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages FORCE ROW LEVEL SECURITY;

ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages FORCE ROW LEVEL SECURITY;

ALTER TABLE onboarding_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_states FORCE ROW LEVEL SECURITY;

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs FORCE ROW LEVEL SECURITY;

ALTER TABLE run_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_steps FORCE ROW LEVEL SECURITY;

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals FORCE ROW LEVEL SECURITY;

ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_bases FORCE ROW LEVEL SECURITY;

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks FORCE ROW LEVEL SECURITY;

ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memories FORCE ROW LEVEL SECURITY;

ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectors FORCE ROW LEVEL SECURITY;

ALTER TABLE connector_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_credentials FORCE ROW LEVEL SECURITY;

ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_servers FORCE ROW LEVEL SECURITY;

ALTER TABLE mcp_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_tools FORCE ROW LEVEL SECURITY;

ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts FORCE ROW LEVEL SECURITY;

ALTER TABLE brand_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_voices FORCE ROW LEVEL SECURITY;

ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items FORCE ROW LEVEL SECURITY;

ALTER TABLE content_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_variants FORCE ROW LEVEL SECURITY;

ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_messages FORCE ROW LEVEL SECURITY;

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows FORCE ROW LEVEL SECURITY;

ALTER TABLE workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_versions FORCE ROW LEVEL SECURITY;

ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY;

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records FORCE ROW LEVEL SECURITY;

ALTER TABLE controller_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE controller_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE controller_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE controller_actions FORCE ROW LEVEL SECURITY;

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts FORCE ROW LEVEL SECURITY;

-- ── 5. Create RLS policies (idempotent — DROP before CREATE) ─────────────────
-- Policy name pattern: <table>_org_policy
--
-- CANONICAL TWO-CLAUSE TEMPLATE (BUILD_GUIDE — tenant isolation):
--   USING / WITH CHECK (
--     organization_id::text = current_setting('app.current_org', true)
--     AND (workspace_id IS NULL
--          OR workspace_id::text = current_setting('app.current_workspace', true))
--   )
--
-- Clause 1 isolates by organization. Clause 2 isolates by workspace while still
-- allowing org-level rows (workspace_id IS NULL) to be visible across the org.
-- `current_setting(.., true)` returns NULL (not an error) when a GUC is unset, so
-- with no workspace GUC only org-level rows are visible — a safe default-deny.
--
-- Tables WITHOUT a workspace_id column (e.g. workspaces) fall back to the
-- org-only clause automatically (detected via information_schema below).

DO $do$
DECLARE
  tbl text;
  has_ws boolean;
  using_expr text;
  tbl_list text[] := ARRAY[
    'workspaces','memberships','invitations',
    'agents','agent_versions','agent_triggers','employee_controls',
    'agent_relationships','routing_decisions',
    'conversations','conversation_messages','agent_messages','onboarding_states',
    'agent_runs','run_steps','approvals',
    'knowledge_bases','documents','document_chunks','agent_memories',  -- created in Phase H (pgvector)
    'connectors','connector_credentials','mcp_servers','mcp_tools',
    'social_accounts','brand_voices','content_items','content_variants','inbox_messages',
    'workflows','workflow_versions','workflow_runs',
    'audit_logs','notifications','idempotency_keys',
    'subscriptions','usage_records',
    'controller_sessions','controller_actions','blog_posts'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbl_list LOOP
    -- Skip tables not present in this database (a migration may not yet have
    -- created them). Without this, one missing table aborts the whole DO block
    -- and rolls back every policy created so far.
    IF to_regclass('public.' || tbl) IS NULL THEN
      RAISE NOTICE 'Skipping % (table does not exist)', tbl;
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'workspace_id'
    ) INTO has_ws;

    IF has_ws THEN
      -- Canonical two-clause: org + (org-level OR matching workspace).
      using_expr :=
        '(organization_id::text = current_setting(''app.current_org'', true) '
        || 'AND (workspace_id IS NULL OR workspace_id::text = current_setting(''app.current_workspace'', true)))';
    ELSE
      -- No workspace column (e.g. workspaces) → org-only.
      using_expr := '(organization_id::text = current_setting(''app.current_org'', true))';
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_org_policy', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (%s) WITH CHECK (%s)',
      tbl || '_org_policy', tbl, using_expr, using_expr
    );
    RAISE NOTICE 'Policy created for table % (two-clause: %)', tbl, has_ws;
  END LOOP;
END$do$;

-- ── 6. Superuser bypass for the owner role (needed for migrations) ────────────
-- The superuser (yashcomputers) can still BYPASS RLS for migrations.
-- The app role (bitecodes_app) cannot bypass — enforced by NOSUPERUSER NOBYPASSRLS.

-- ── 7. Verify ─────────────────────────────────────────────────────────────────
SELECT
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relname IN ('agents', 'workspaces', 'agent_runs', 'content_items')
ORDER BY relname;

SELECT count(*) AS total_policies FROM pg_policies;

SELECT rolname, rolsuper, rolbypassrls
FROM pg_roles
WHERE rolname IN ('yashcomputers', 'bitecodes_app')
ORDER BY rolname;
