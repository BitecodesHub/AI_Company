'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Bot, CheckCircle2, XCircle, CreditCard, Gauge } from 'lucide-react';
import { analyticsApi } from '../../../../src/lib/api-client';

const SUCCESS = ['completed', 'succeeded', 'success', 'done'];
const FAILURE = ['failed', 'error', 'cancelled', 'canceled'];

export default function AnalyticsPage() {
  const runsQ = useQuery({ queryKey: ['analytics-runs'], queryFn: () => analyticsApi.runs() });
  const usageQ = useQuery({ queryKey: ['analytics-usage'], queryFn: () => analyticsApi.usage() });

  const runs = (runsQ.data?.items ?? []) as Array<{ status?: string }>;
  const total = runs.length;
  const succeeded = runs.filter((r) => SUCCESS.includes((r.status ?? '').toLowerCase())).length;
  const failed = runs.filter((r) => FAILURE.includes((r.status ?? '').toLowerCase())).length;
  const successRate = total ? `${Math.round((succeeded / total) * 100)}%` : '—';
  const sub = usageQ.data;

  const loading = runsQ.isLoading || usageQ.isLoading;

  const metrics = [
    { label: 'Total agent runs', value: total ? String(total) : '0', icon: Bot },
    { label: 'Succeeded', value: total ? String(succeeded) : '0', icon: CheckCircle2 },
    { label: 'Success rate', value: successRate, icon: Gauge },
    { label: 'Failed', value: total ? String(failed) : '0', icon: XCircle },
    { label: 'Plan', value: sub?.plan ? sub.plan : '—', icon: CreditCard },
    { label: 'Credits', value: sub?.balanceCredits != null ? String(sub.balanceCredits) : '—', icon: TrendingUp },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-1">Agent performance and usage at a glance.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {metrics.map((m) => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-start justify-between mb-3">
              <span className="text-sm text-muted-foreground">{m.label}</span>
              <m.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            {loading ? (
              <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-bold capitalize">{m.value}</p>
            )}
          </div>
        ))}
      </div>

      {!loading && total === 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center">
          <TrendingUp className="w-8 h-8 text-primary mx-auto mb-3" />
          <h3 className="font-semibold mb-1">Run an agent to populate analytics</h3>
          <p className="text-sm text-muted-foreground">Once your employees start working, success rates, volumes, and usage appear here automatically.</p>
        </div>
      )}
    </div>
  );
}
