import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = { title: 'Workflow' };

export default function WorkflowDetailPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/app/workflows" className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm">
          <ArrowLeft className="w-4 h-4" /> Workflows
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-2">Workflow</h1>
      <div className="border border-border rounded-xl h-96 flex items-center justify-center text-muted-foreground">
        Visual canvas — coming soon
      </div>
    </div>
  );
}
