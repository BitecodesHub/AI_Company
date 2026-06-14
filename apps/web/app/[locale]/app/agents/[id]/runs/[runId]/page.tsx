'use client';

/**
 * Run Inspector — full trace of one agent run: status, model, tokens, cost,
 * input/output, the step-by-step trace from run_steps, errors, and controls
 * (pause/resume/cancel/replay). Live via the /runs socket with a polling
 * fallback while the run is active.
 */
import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Pause, Square, RotateCcw, Cpu, Coins, Loader2 } from 'lucide-react';
import { runsApi, type RunStep } from '../../../../../../../src/lib/api-client';
import { useMe } from '../../../../../../../src/hooks/use-me';
import { useRunStream } from '../../../../../../../src/hooks/use-run-stream';
import { toast } from 'sonner';

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled']);

const STATUS_STYLE: Record<string, string> = {
  running: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  queued: 'bg-muted text-muted-foreground',
  waiting_approval: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  paused: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  succeeded: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  failed: 'bg-destructive/10 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};

export default function RunInspectorPage() {
  const params = useParams();
  const runId = params?.runId as string;
  const qc = useQueryClient();
  const { data: me } = useMe();

  const { data: run, isLoading } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => runsApi.get(runId),
    refetchInterval: (q) => (TERMINAL.has((q.state.data?.status as string) ?? '') ? false : 4000),
  });

  const refetch = useCallback(() => { qc.invalidateQueries({ queryKey: ['run', runId] }); }, [qc, runId]);
  useRunStream(me?.workspace?.id, refetch);

  const action = useMutation({
    mutationFn: async (verb: 'pause' | 'resume' | 'cancel' | 'replay') => {
      if (verb === 'pause') return runsApi.pause(runId);
      if (verb === 'resume') return runsApi.resume(runId);
      if (verb === 'cancel') return runsApi.cancel(runId);
      return runsApi.replay(runId);
    },
    onSuccess: (_r, verb) => { toast.success(`Run ${verb}`); refetch(); },
    onError: (e: Error) => toast.error(e.message || 'Action failed'),
  });

  if (isLoading) return <div className="p-8 max-w-4xl mx-auto"><div className="h-40 bg-muted rounded-2xl animate-pulse" /></div>;
  if (!run) return <div className="p-8 max-w-4xl mx-auto text-muted-foreground">Run not found.</div>;

  const steps = (run.steps ?? []) as RunStep[];
  const active = !TERMINAL.has(run.status);

  return (
    <div className="p-8 max-w-4xl mx-auto" data-testid="run-inspector">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight font-mono">Run {runId.slice(0, 8)}…</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[run.status] ?? 'bg-muted'}`}>{run.status}</span>
            {run.failureReason && <span className="text-xs text-destructive">{run.failureReason}</span>}
            {run.triggerType && <span className="text-xs text-muted-foreground">trigger: {run.triggerType}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {active && <Btn onClick={() => action.mutate('pause')} icon={Pause} label="Pause" pending={action.isPending} />}
          {run.status === 'paused' && <Btn onClick={() => action.mutate('resume')} icon={Play} label="Resume" pending={action.isPending} />}
          {active && <Btn onClick={() => action.mutate('cancel')} icon={Square} label="Cancel" pending={action.isPending} danger />}
          {TERMINAL.has(run.status) && <Btn onClick={() => action.mutate('replay')} icon={RotateCcw} label="Replay" pending={action.isPending} />}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat icon={Cpu} label="Tokens" value={`${(run.tokensIn ?? 0) + (run.tokensOut ?? 0)}`} />
        <Stat icon={Coins} label="Cost" value={`$${Number(run.costUsd ?? 0).toFixed(4)}`} />
        <Stat icon={Play} label="Steps" value={`${steps.length}`} />
      </div>

      <h2 className="text-sm font-semibold text-muted-foreground mb-2">Trace</h2>
      <ol className="relative border-l border-border ml-2 space-y-3" data-testid="run-steps">
        {steps.length === 0 ? (
          <li className="ml-4 text-sm text-muted-foreground py-4">No steps recorded yet.</li>
        ) : steps.map((s) => (
          <li key={s.id} className="ml-4">
            <div className="absolute -left-1.5 w-3 h-3 rounded-full border-2 border-background bg-primary" />
            <div className="border border-border rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  <span className="text-muted-foreground mr-2">#{s.index}</span>{s.type}: {s.name}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.status === 'failed' ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>{s.status}</span>
              </div>
              {s.model && <p className="text-xs text-muted-foreground mt-1">{s.model} · {(s.tokensIn ?? 0)}+{(s.tokensOut ?? 0)} tok</p>}
              {s.error != null && <pre className="text-xs text-destructive mt-1 whitespace-pre-wrap">{JSON.stringify(s.error)}</pre>}
            </div>
          </li>
        ))}
      </ol>

      {run.output != null && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Output</h2>
          <pre className="border border-border rounded-xl p-4 text-sm whitespace-pre-wrap overflow-x-auto">{typeof run.output === 'string' ? run.output : JSON.stringify(run.output, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function Btn({ onClick, icon: Icon, label, pending, danger }: { onClick: () => void; icon: typeof Play; label: string; pending?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={pending}
      className={`inline-flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${danger ? 'border-border text-destructive hover:bg-destructive/10' : 'border-border hover:bg-muted'}`}>
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />} {label}
    </button>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Play; label: string; value: string }) {
  return (
    <div className="border border-border rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="w-3.5 h-3.5" /> {label}</div>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </div>
  );
}
