'use client';

/**
 * Admin → Members. Lists real members from GET /v1/members with search,
 * role badges, inline role changes, and deactivate. All mutations are RBAC-gated
 * server-side; the UI optimistically refetches on success.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, UserMinus, Loader2 } from 'lucide-react';
import { membersApi, type Role } from '../../../../../src/lib/api-client';
import { toast } from 'sonner';

const ROLES: Role[] = ['owner', 'admin', 'member', 'viewer'];

const ROLE_BADGE: Record<Role, string> = {
  owner: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  admin: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  member: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  viewer: 'bg-muted text-muted-foreground border-border',
};

export default function MembersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => membersApi.list(),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => membersApi.updateRole(id, role),
    onSuccess: () => { toast.success('Role updated'); qc.invalidateQueries({ queryKey: ['members'] }); },
    onError: (e: Error) => toast.error(e.message || 'Could not update role'),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => membersApi.remove(id),
    onSuccess: () => { toast.success('Member deactivated'); qc.invalidateQueries({ queryKey: ['members'] }); },
    onError: (e: Error) => toast.error(e.message || 'Could not deactivate'),
  });

  const items = (data?.items ?? []) as Array<{
    id: string; userId: string; email?: string | null; name?: string | null;
    role: Role; status?: string; joinedAt?: string;
  }>;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) =>
      (m.name ?? '').toLowerCase().includes(q) || (m.email ?? '').toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div data-testid="admin-members">
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members…"
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Member</th>
              <th className="text-left font-medium px-4 py-3">Role</th>
              <th className="text-left font-medium px-4 py-3">Status</th>
              <th className="text-right font-medium px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-3" colSpan={4}><div className="h-5 bg-muted rounded animate-pulse" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No members found.</td></tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{m.name ?? '—'}</div>
                    <div className="text-muted-foreground text-xs">{m.email ?? ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={m.role}
                      disabled={updateRole.isPending}
                      onChange={(e) => updateRole.mutate({ id: m.id, role: e.target.value })}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border bg-transparent ${ROLE_BADGE[m.role]}`}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={m.status === 'deactivated' ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}>
                      {m.status ?? 'active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.status !== 'deactivated' && (
                      <button
                        onClick={() => deactivate.mutate(m.id)}
                        disabled={deactivate.isPending}
                        className="inline-flex items-center gap-1.5 text-xs text-destructive hover:bg-destructive/10 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        {deactivate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
