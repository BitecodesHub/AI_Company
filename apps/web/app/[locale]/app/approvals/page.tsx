'use client';

/**
 * Approval inbox — pending human-in-the-loop approvals. Approve/reject resumes
 * the waiting run. Server enforces who may decide; this refetches on success.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, ShieldQuestion, Loader2, Clock } from 'lucide-react';
import { runsApi, type Approval } from '../../../../src/lib/api-client';
import { toast } from 'sonner';

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => runsApi.listApprovals(),
    refetchInterval: 15_000,
  });

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approved' | 'rejected' }) => runsApi.decide(id, decision),
    onSuccess: (res, vars) => {
      toast.success(`Request ${vars.decision}${res?.emitted === false ? ' (resume pending)' : ''}`);
      qc.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: (e: Error) => toast.error(e.message || 'Could not record decision'),
  });

  const items = (data?.items ?? []) as Approval[];

  return (
    <div className="p-8 max-w-4xl mx-auto" data-testid="approvals-page">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Approvals</h1>
        <p className="text-muted-foreground mt-1 text-sm">Runs paused for your decision before a sensitive action.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="h-24 border border-border rounded-2xl animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-2xl p-16 text-center">
          <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldQuestion className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Nothing waiting</h3>
          <p className="text-muted-foreground text-sm">When an employee needs sign-off, it shows up here.</p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="approvals-list">
          {items.map((a) => (
            <div key={a.id} className="border border-border rounded-2xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <ShieldQuestion className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">
                  Tool call: <span className="font-mono text-sm">{a.payload?.toolName ?? a.kind}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Run {a.runId.slice(0, 8)}…</p>
                {a.expiresAt && (
                  <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" /> expires {new Date(a.expiresAt).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => decide.mutate({ id: a.id, decision: 'approved' })}
                  disabled={decide.isPending}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {decide.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
                </button>
                <button
                  onClick={() => decide.mutate({ id: a.id, decision: 'rejected' })}
                  disabled={decide.isPending}
                  className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <X className="w-4 h-4" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
