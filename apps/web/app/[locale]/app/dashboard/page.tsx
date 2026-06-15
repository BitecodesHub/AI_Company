'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Bot, Rss, Inbox, Zap, TrendingUp, Clock, ArrowRight,
  Plus, Sparkles, Play, CheckCircle2, Circle,
} from 'lucide-react';
import {
  agentsApi, contentApi, inboxApi, runsApi, connectorsApi, type AgentRun,
} from '../../../../src/lib/api-client';

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function isToday(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso); const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const RUN_DOT: Record<string, string> = {
  completed: 'bg-emerald-500', succeeded: 'bg-emerald-500', success: 'bg-emerald-500',
  running: 'bg-blue-500', pending: 'bg-amber-500', queued: 'bg-amber-500',
  failed: 'bg-red-500', error: 'bg-red-500', cancelled: 'bg-muted-foreground',
};

export default function DashboardPage() {
  const agentsQ = useQuery({ queryKey: ['agents'], queryFn: () => agentsApi.list() });
  const contentQ = useQuery({ queryKey: ['content-items'], queryFn: () => contentApi.list() });
  const inboxQ = useQuery({ queryKey: ['inbox'], queryFn: () => inboxApi.list() });
  const runsQ = useQuery({ queryKey: ['runs'], queryFn: () => runsApi.list() });
  const connectorsQ = useQuery({ queryKey: ['connectors'], queryFn: () => connectorsApi.list() });

  const agents = agentsQ.data?.items ?? [];
  const content = contentQ.data?.items ?? [];
  const inbox = inboxQ.data?.items ?? [];
  const runs = (runsQ.data?.items ?? []) as AgentRun[];
  const connectors = connectorsQ.data?.items ?? [];

  const drafts = content.filter((c) => c.status === 'draft');
  const scheduled = content.filter((c) => c.status === 'scheduled');
  const runsToday = runs.filter((r) => isToday(r.createdAt)).length;
  const recentRuns = [...runs].slice(0, 5);

  const loading = agentsQ.isLoading || contentQ.isLoading || inboxQ.isLoading || runsQ.isLoading;

  const stats = [
    { label: 'Employees', value: agents.length, sub: 'on your team', icon: Bot, color: 'from-blue-500 to-indigo-600', href: '/app/agents' },
    { label: 'Content Drafts', value: drafts.length, sub: 'ready to review', icon: Rss, color: 'from-emerald-500 to-teal-600', href: '/app/content' },
    { label: 'Inbox Messages', value: inbox.length, sub: 'in your inbox', icon: Inbox, color: 'from-amber-500 to-orange-600', href: '/app/inbox' },
    { label: 'Runs Today', value: runsToday, sub: 'agent runs', icon: Zap, color: 'from-violet-500 to-purple-600', href: '/app/analytics' },
  ];

  const quickActions = [
    { icon: '🤖', label: 'Create your first agent', desc: 'Build an AI worker in minutes', href: '/app/agents/new', cta: 'Create agent', primary: true },
    { icon: '📅', label: 'Generate a week of content', desc: 'AI creates platform-adapted posts', href: '/app/content', cta: 'Generate now', primary: false },
    { icon: '🔌', label: 'Connect social accounts', desc: 'Link X, LinkedIn, Instagram…', href: '/app/connectors', cta: 'Connect', primary: false },
    { icon: '🛒', label: 'Browse templates', desc: 'Pre-built agents & workflows', href: '/app/marketplace', cta: 'Browse', primary: false },
  ];

  const onboardingSteps = [
    { label: 'Create your account', done: true },
    { label: 'Set up your workspace', done: true },
    { label: 'Create your first agent', done: agents.length > 0, href: '/app/agents/new' },
    { label: 'Connect a social account', done: connectors.length > 0, href: '/app/connectors' },
    { label: 'Generate your first content', done: content.length > 0, href: '/app/content' },
  ];
  const onboardingProgress = onboardingSteps.filter((s) => s.done).length;
  const onboardingComplete = onboardingProgress === onboardingSteps.length;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting()} 👋</h1>
          <p className="text-muted-foreground mt-1 text-sm">Your workspace is ready. Here&apos;s your overview.</p>
        </div>
        <Link href="/app/agents/new"
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm shadow-primary/25">
          <Plus className="w-4 h-4" /> New Agent
        </Link>
      </div>

      {/* Onboarding progress — hides once everything is done */}
      {!onboardingComplete && (
        <div className="bg-gradient-to-r from-primary/5 to-violet-500/5 border border-primary/20 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Getting started</span>
              <span className="text-xs text-muted-foreground">({onboardingProgress}/{onboardingSteps.length} complete)</span>
            </div>
            <div className="flex items-center gap-1">
              {onboardingSteps.map((_, i) => (
                <div key={i} className={`h-1.5 w-8 rounded-full transition-colors ${i < onboardingProgress ? 'bg-primary' : 'bg-border'}`} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {onboardingSteps.map((step, i) => (
              <div key={i} className={`flex items-center gap-2 text-xs p-2 rounded-lg ${step.done ? 'text-muted-foreground' : 'text-foreground'}`}>
                {step.done
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  : <Circle className="w-3.5 h-3.5 text-border flex-shrink-0" />}
                {step.href && !step.done
                  ? <Link href={step.href} className="hover:text-primary transition-colors line-clamp-2">{step.label}</Link>
                  : <span className="line-clamp-2">{step.label}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}
            className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-sm`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            {loading ? (
              <div className="h-9 w-12 bg-muted rounded animate-pulse mb-1" />
            ) : (
              <div className="text-3xl font-bold tracking-tight mb-1">{s.value}</div>
            )}
            <div className="text-sm font-medium text-muted-foreground">{s.label}</div>
            <div className="text-xs text-muted-foreground/70 mt-0.5">{s.sub}</div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Quick actions</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((a) => (
            <Link key={a.label} href={a.href}
              className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 hover:shadow-md transition-all duration-200 group flex flex-col">
              <div className="text-2xl mb-3">{a.icon}</div>
              <p className="font-medium text-sm mb-1">{a.label}</p>
              <p className="text-xs text-muted-foreground flex-1 mb-4">{a.desc}</p>
              <span className={`text-xs font-medium px-3 py-1.5 rounded-lg inline-flex items-center gap-1 w-fit transition-colors ${
                a.primary
                  ? 'bg-primary text-white group-hover:bg-primary/90'
                  : 'bg-secondary text-secondary-foreground group-hover:bg-primary/10 group-hover:text-primary'
              }`}>
                {a.cta} <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" /> Recent runs
            </h2>
            <Link href="/app/agents" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {recentRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Play className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No runs yet</p>
              <Link href="/app/agents/new" className="mt-3 text-xs text-primary hover:underline">Create agent →</Link>
            </div>
          ) : (
            <div className="space-y-1">
              {recentRuns.map((r) => (
                <Link key={r.id} href={`/app/agents/${r.agentId}/runs/${r.id}`}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted transition-colors">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${RUN_DOT[r.status] ?? 'bg-muted-foreground'}`} />
                  <span className="text-sm flex-1 capitalize">{r.status}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-muted-foreground" /> Upcoming posts
            </h2>
            <Link href="/app/content" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {scheduled.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Rss className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No content scheduled</p>
              <Link href="/app/content" className="mt-3 text-xs text-primary hover:underline">Generate content →</Link>
            </div>
          ) : (
            <div className="space-y-1">
              {scheduled.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-2 py-2 rounded-lg">
                  <Rss className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1 line-clamp-1">{c.title || 'Untitled'}</span>
                  <span className="text-xs text-muted-foreground capitalize">{c.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
