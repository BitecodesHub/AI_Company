'use client';

/**
 * Admin → System. Live subsystem health from GET /v1/system-health. Each probe
 * shows ok/degraded/down with latency or a clear error — never a faked "ok".
 * "Deep check" additionally makes a real AI provider call.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import { systemHealthApi, type HealthProbe } from '../../../../../src/lib/api-client';

const ICON = {
  ok: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
  degraded: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
  down: <XCircle className="w-5 h-5 text-destructive" />,
};
const LABEL: Record<string, string> = {
  database: 'Database', redis: 'Redis', ai_provider: 'AI provider',
  inngest: 'Inngest', storage: 'Storage', auth: 'Auth',
};

export default function SystemPage() {
  const [deep, setDeep] = useState(false);
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['system-health', deep],
    queryFn: () => systemHealthApi.get(deep),
    refetchInterval: 30_000,
  });

  const probes = (data?.probes ?? []) as HealthProbe[];

  return (
    <div data-testid="admin-system" className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Overall</span>
          {data && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              {ICON[data.status]} <span className="capitalize">{data.status}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} /> Deep check
          </label>
          <button onClick={() => refetch()} className="inline-flex items-center gap-1.5 text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-muted">
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-16 border border-border rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {probes.map((p) => (
            <div key={p.name} className="border border-border rounded-2xl p-4 flex items-start gap-3">
              <div className="mt-0.5">{ICON[p.status]}</div>
              <div className="min-w-0">
                <p className="font-medium">{LABEL[p.name] ?? p.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 break-words">
                  {p.error ?? p.detail ?? p.status}
                  {p.latencyMs != null && <span className="ml-1 opacity-70">· {p.latencyMs}ms</span>}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      {data && <p className="text-xs text-muted-foreground mt-4">Checked {new Date(data.checkedAt).toLocaleString()}</p>}
    </div>
  );
}
