'use client';

/**
 * Employee control panel — binds to /v1/agents/:id/controls. Activation,
 * approval mode, plan mode, bypass (owner-only), and daily caps. The bypass
 * toggle is disabled for non-owners (cosmetic; the server also enforces it).
 */
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Power, PauseCircle, ShieldCheck, Loader2 } from 'lucide-react';
import { controlsApi, type EmployeeControls } from '../../lib/api-client';
import { useMe } from '../../hooks/use-me';
import { roleAtLeast } from '../../lib/rbac';
import { toast } from 'sonner';

export function ControlPanel({ agentId }: { agentId: string }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isOwner = roleAtLeast(me?.role ?? 'viewer', 'owner');

  const { data, isLoading } = useQuery({
    queryKey: ['controls', agentId],
    queryFn: () => controlsApi.get(agentId),
  });

  const [draft, setDraft] = useState<Partial<EmployeeControls>>({});
  useEffect(() => { if (data) setDraft(data); }, [data]);

  const save = useMutation({
    mutationFn: (patch: Partial<EmployeeControls>) => controlsApi.update(agentId, patch),
    onSuccess: () => { toast.success('Controls saved'); qc.invalidateQueries({ queryKey: ['controls', agentId] }); },
    onError: (e: Error) => toast.error(e.message || 'Could not save'),
  });

  const setActivation = useMutation({
    mutationFn: (state: 'active' | 'deactivated') => state === 'active' ? controlsApi.activate(agentId) : controlsApi.deactivate(agentId),
    onSuccess: () => { toast.success('Activation updated'); qc.invalidateQueries({ queryKey: ['controls', agentId] }); },
    onError: (e: Error) => toast.error(e.message || 'Could not update'),
  });

  if (isLoading || !data) return <div className="h-40 border border-border rounded-2xl animate-pulse" />;

  const state = draft.activationState ?? data.activationState;

  return (
    <div data-testid="control-panel" className="border border-border rounded-2xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Controls</h3>
          <p className="text-xs text-muted-foreground">Activation, approvals, and guardrails for this employee.</p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          state === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : state === 'paused' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : 'bg-muted text-muted-foreground'}`}>{state}</span>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setActivation.mutate('active')} disabled={setActivation.isPending || state === 'active'}
          className="inline-flex items-center gap-1.5 text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-muted disabled:opacity-50">
          <Power className="w-4 h-4" /> Activate
        </button>
        <button onClick={() => { setDraft((d) => ({ ...d, activationState: 'paused' })); save.mutate({ activationState: 'paused' }); }} disabled={save.isPending || state === 'paused'}
          className="inline-flex items-center gap-1.5 text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-muted disabled:opacity-50">
          <PauseCircle className="w-4 h-4" /> Pause
        </button>
        <button onClick={() => setActivation.mutate('deactivated')} disabled={setActivation.isPending || state === 'deactivated'}
          className="inline-flex items-center gap-1.5 text-sm border border-border rounded-lg px-3 py-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50">
          Deactivate
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm">
          <span className="block text-xs text-muted-foreground mb-1">Approval mode</span>
          <select
            value={draft.approvalMode ?? data.approvalMode}
            onChange={(e) => {
              const v = e.target.value as EmployeeControls['approvalMode'];
              setDraft((d) => ({ ...d, approvalMode: v }));
              if (v === 'never' && !isOwner) { toast.error('Only an owner can disable the approval gate.'); return; }
              save.mutate({ approvalMode: v });
            }}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background"
          >
            <option value="always">Always (gate every tool)</option>
            <option value="risky">Risky only</option>
            <option value="never" disabled={!isOwner}>Never (owner only)</option>
          </select>
        </label>

        <label className="text-sm flex items-center gap-2 sm:mt-6">
          <input type="checkbox" checked={draft.planMode ?? data.planMode}
            onChange={(e) => { setDraft((d) => ({ ...d, planMode: e.target.checked })); save.mutate({ planMode: e.target.checked }); }} />
          Plan mode (approve before acting)
        </label>
      </div>

      <label className={`text-sm flex items-center gap-2 ${!isOwner ? 'opacity-50' : ''}`}>
        <input type="checkbox" disabled={!isOwner} checked={draft.bypassPermission ?? data.bypassPermission}
          onChange={(e) => { setDraft((d) => ({ ...d, bypassPermission: e.target.checked })); save.mutate({ bypassPermission: e.target.checked }); }} />
        <ShieldCheck className="w-4 h-4" /> Bypass permission gate {!isOwner && <span className="text-xs text-muted-foreground">(owner only)</span>}
      </label>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm">
          <span className="block text-xs text-muted-foreground mb-1">Max runs / day</span>
          <input type="number" min={1} defaultValue={data.maxRunsPerDay ?? undefined}
            onBlur={(e) => save.mutate({ maxRunsPerDay: e.target.value ? Number(e.target.value) : null })}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background" placeholder="unlimited" />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-muted-foreground mb-1">Daily cost cap (USD)</span>
          <input type="number" min={0} step="0.01" defaultValue={data.dailyCostCapUsd ?? undefined}
            onBlur={(e) => save.mutate({ dailyCostCapUsd: e.target.value ? Number(e.target.value) : null })}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background" placeholder="unlimited" />
        </label>
      </div>

      {save.isPending && <p className="text-xs text-muted-foreground inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> saving…</p>}
    </div>
  );
}
