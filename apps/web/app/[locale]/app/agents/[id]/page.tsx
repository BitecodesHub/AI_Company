import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Play, Settings, History, BookOpen } from 'lucide-react';
import { ControlPanel } from '../../../../../src/components/employee/control-panel';
import { OrgGraph } from '../../../../../src/components/employee/org-graph';

export const metadata: Metadata = { title: 'Agent' };

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id } = await params;
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/app/agents" className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm">
          <ArrowLeft className="w-4 h-4" /> Agents
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">Agent</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Agent</h1>
          <p className="text-muted-foreground mt-1">Configure and run this agent</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 border border-border px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
            <Settings className="w-4 h-4" /> Configure
          </button>
          <button className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Play className="w-4 h-4" /> Run
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {['Playground', 'Configuration', 'Run history', 'Knowledge'].map((tab, i) => (
          <button key={tab} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${i === 0 ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Playground */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="bg-muted/30 px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-medium">Playground</span>
          <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-0.5 rounded-full">Sandbox mode</span>
        </div>
        <div className="min-h-60 p-4 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Play className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Run this agent to see the output here</p>
          </div>
        </div>
        <div className="border-t border-border p-3 flex gap-2">
          <input placeholder="Type a message to this agent…" className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground" />
          <button className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium">Send</button>
        </div>
      </div>

      {/* Employee controls (activation, approvals, guardrails) */}
      <div className="mt-6">
        <ControlPanel agentId={id} />
      </div>

      {/* Organization graph — supervises / watches / delegates edges */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Organization</h2>
        <OrgGraph highlightAgentId={id} />
      </div>
    </div>
  );
}
