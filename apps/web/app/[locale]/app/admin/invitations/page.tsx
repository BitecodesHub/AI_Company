'use client';

/**
 * Admin → Invitations. Invite by email + role (POST /v1/invitations) and list
 * pending invites (GET /v1/invitations). Both are admin-gated server-side.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Send, Loader2 } from 'lucide-react';
import { membersApi, type Role } from '../../../../../src/lib/api-client';
import { toast } from 'sonner';

const ROLES: Role[] = ['admin', 'member', 'viewer'];

export default function InvitationsPage() {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');

  const { data, isLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => membersApi.listInvitations(),
  });

  const invite = useMutation({
    mutationFn: () => membersApi.invite(email.trim().toLowerCase(), role),
    onSuccess: () => {
      toast.success('Invitation created');
      setEmail('');
      qc.invalidateQueries({ queryKey: ['invitations'] });
    },
    onError: (e: Error) => toast.error(e.message || 'Could not invite'),
  });

  const items = data?.items ?? [];
  const canInvite = /.+@.+\..+/.test(email) && !invite.isPending;

  return (
    <div data-testid="admin-invitations">
      <form
        onSubmit={(e) => { e.preventDefault(); if (canInvite) invite.mutate(); }}
        className="flex flex-wrap items-end gap-3 mb-6 p-4 border border-border rounded-2xl"
      >
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs text-muted-foreground mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="px-3 py-2 rounded-xl border border-border bg-background text-sm"
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button
          type="submit"
          disabled={!canInvite}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {invite.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send invite
        </button>
      </form>

      <div className="border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Email</th>
              <th className="text-left font-medium px-4 py-3">Role</th>
              <th className="text-left font-medium px-4 py-3">Expires</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={3} className="px-4 py-3"><div className="h-5 bg-muted rounded animate-pulse" /></td></tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                  <Mail className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  No pending invitations.
                </td>
              </tr>
            ) : (
              items.map((inv) => (
                <tr key={inv.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{inv.email}</td>
                  <td className="px-4 py-3 capitalize">{inv.role}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
