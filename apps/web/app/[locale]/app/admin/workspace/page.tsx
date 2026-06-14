'use client';

/**
 * Admin → Workspace. Shows the active organization + workspace (from /v1/me).
 * Editable branding / default-role / invite-only controls land with the
 * workspace-settings endpoints (later phase); shown here read-only for now.
 */
import { useMe } from '../../../../../src/hooks/use-me';

export default function WorkspaceSettingsPage() {
  const { data, isLoading } = useMe();

  if (isLoading) return <div className="h-24 bg-muted rounded-2xl animate-pulse" />;

  return (
    <div data-testid="admin-workspace" className="max-w-2xl space-y-4">
      <div className="border border-border rounded-2xl p-5">
        <h3 className="font-semibold mb-3">Organization</h3>
        <dl className="grid grid-cols-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="col-span-2">{data?.org?.name ?? '—'}</dd>
          <dt className="text-muted-foreground">Slug</dt>
          <dd className="col-span-2">{data?.org?.slug ?? '—'}</dd>
          <dt className="text-muted-foreground">Your role</dt>
          <dd className="col-span-2 capitalize">{data?.role ?? '—'}</dd>
        </dl>
      </div>

      <div className="border border-border rounded-2xl p-5">
        <h3 className="font-semibold mb-3">Active workspace</h3>
        <dl className="grid grid-cols-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="col-span-2">{data?.workspace?.name ?? '—'}</dd>
          <dt className="text-muted-foreground">Workspaces</dt>
          <dd className="col-span-2">{data?.workspaces?.length ?? 0}</dd>
        </dl>
      </div>

      <p className="text-xs text-muted-foreground">
        Editable workspace settings (branding, default member role, invite-only) connect once the
        workspace-settings endpoints ship. Nothing here is editable yet.
      </p>
    </div>
  );
}
