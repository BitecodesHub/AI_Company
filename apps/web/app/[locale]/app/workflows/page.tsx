'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, Plus, Play } from 'lucide-react';
import { workflowsApi, type Workflow } from '../../../../src/lib/api-client';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  draft: 'bg-muted text-muted-foreground',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

export default function WorkflowsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['workflows'], queryFn: () => workflowsApi.list() });
  const workflows = (data?.items ?? []) as Workflow[];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-muted-foreground mt-1">Automate multi-step processes with a visual builder.</p>
        </div>
        <Link href="/app/workflows/new"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> New workflow
        </Link>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border border-border rounded-2xl p-5 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-muted mb-4" />
              <div className="h-4 bg-muted rounded w-2/3 mb-2" />
              <div className="h-3 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-2xl p-16 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GitBranch className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Build your first workflow</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Connect agents, connectors, and logic into automated pipelines. Trigger on schedules, webhooks, or events.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/app/workflows/new"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Create workflow
            </Link>
            <Link href="/app/marketplace" className="inline-flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
              Browse templates
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((w) => (
            <Link key={w.id} href={`/app/workflows/${w.id}`}
              className="block border border-border rounded-2xl p-5 bg-card hover:border-primary/30 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <GitBranch className="w-5 h-5 text-primary" />
                </div>
                <span className={`text-[10px] font-medium px-2 py-1 rounded-full capitalize ${STATUS_STYLES[w.status] ?? STATUS_STYLES.draft}`}>
                  {w.status}
                </span>
              </div>
              <h3 className="font-semibold mb-1">{w.name}</h3>
              <p className="text-sm text-muted-foreground">{(w.graph?.nodes?.length ?? 0)} steps</p>
              <div className="flex items-center mt-4 pt-4 border-t border-border">
                <span className="ml-auto text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <Play className="w-3 h-3" /> Open
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
