import type { Metadata } from 'next';
import { TrendingUp, Bot, Zap, Clock, DollarSign, Users } from 'lucide-react';

export const metadata: Metadata = { title: 'Analytics' };

const metrics = [
  { label: 'Total Agent Runs', value: '—', change: '', icon: Bot },
  { label: 'Avg Response Time', value: '—', change: '', icon: Clock },
  { label: 'Success Rate', value: '—', change: '', icon: TrendingUp },
  { label: 'Tasks Automated', value: '—', change: '', icon: Zap },
  { label: 'Cost Saved', value: '—', change: '', icon: DollarSign },
  { label: 'Active Users', value: '—', change: '', icon: Users },
];

export default function AnalyticsPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-1">Track agent performance, cost savings, and ROI</p>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {metrics.map((m) => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-start justify-between mb-3">
              <span className="text-sm text-muted-foreground">{m.label}</span>
              <m.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold text-muted-foreground">{m.value}</p>
            <p className="text-xs text-muted-foreground mt-1">No data yet — run some agents to see metrics</p>
          </div>
        ))}
      </div>

      {/* Coming soon notice */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center">
        <TrendingUp className="w-8 h-8 text-primary mx-auto mb-3" />
        <h3 className="font-semibold mb-1">Detailed analytics available after first agent run</h3>
        <p className="text-sm text-muted-foreground">Agent success rates, cost per task, model usage, time saved estimates, and ROI dashboards will appear here.</p>
      </div>
    </div>
  );
}
