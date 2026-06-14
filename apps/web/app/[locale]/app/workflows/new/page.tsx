import Link from 'next/link';
import { ArrowLeft, GitBranch } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'New Workflow' };

export default function NewWorkflowPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/app/workflows" className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm">
          <ArrowLeft className="w-4 h-4" /> Workflows
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">New Workflow</span>
      </div>
      <h1 className="text-2xl font-bold mb-2">Create a workflow</h1>
      <p className="text-muted-foreground mb-8">Build an automated multi-step pipeline using the visual canvas.</p>
      <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center">
        <GitBranch className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
        <p className="text-muted-foreground text-sm mb-4">The visual workflow builder is coming soon.<br/>You can still create workflows programmatically via the API.</p>
        <Link href="/app/workflows" className="text-sm text-primary hover:underline">← Back to workflows</Link>
      </div>
    </div>
  );
}
