import type { Metadata } from 'next';
import Link from 'next/link';
import { GitBranch, Plus, Play } from 'lucide-react';

export const metadata: Metadata = { title: 'Workflows' };

export default function WorkflowsPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-muted-foreground mt-1">Automate multi-step processes with visual workflow builder</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> New workflow
        </button>
      </div>

      {/* Empty state */}
      <div className="border-2 border-dashed border-border rounded-2xl p-16 text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <GitBranch className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Build your first workflow</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Connect agents, connectors, and logic into automated pipelines. Trigger on schedules, webhooks, or events.
        </p>
        <div className="flex gap-3 justify-center">
          <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Create workflow
          </button>
          <Link href="/app/marketplace" className="inline-flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
            Browse templates
          </Link>
        </div>
      </div>
    </div>
  );
}
