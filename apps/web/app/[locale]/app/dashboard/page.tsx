import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Bot, Rss, Inbox, Zap, TrendingUp, Clock, ArrowRight,
  Plus, Sparkles, Play, CheckCircle2, Circle,
} from 'lucide-react';

export const metadata: Metadata = { title: 'Dashboard — Bitecodes' };

const stats = [
  { label: 'Active Agents', value: '0', sub: 'in sandbox mode', icon: Bot, color: 'from-blue-500 to-indigo-600', href: '/app/agents' },
  { label: 'Content Drafts', value: '0', sub: 'ready to review', icon: Rss, color: 'from-emerald-500 to-teal-600', href: '/app/content' },
  { label: 'Inbox Messages', value: '0', sub: 'unread', icon: Inbox, color: 'from-amber-500 to-orange-600', href: '/app/inbox' },
  { label: 'Runs Today', value: '0', sub: 'agent runs', icon: Zap, color: 'from-violet-500 to-purple-600', href: '/app/agents' },
];

const quickActions = [
  { icon: '🤖', label: 'Create your first agent', desc: 'Build an AI worker in minutes', href: '/app/agents/new', cta: 'Create agent', primary: true },
  { icon: '📅', label: 'Generate a week of content', desc: 'AI creates platform-adapted posts', href: '/app/content', cta: 'Generate now', primary: false },
  { icon: '🔌', label: 'Connect social accounts', desc: 'Link X, LinkedIn, Instagram…', href: '/app/settings', cta: 'Connect', primary: false },
  { icon: '🛒', label: 'Browse templates', desc: 'Pre-built agents & workflows', href: '/app/marketplace', cta: 'Browse', primary: false },
];

const onboardingSteps = [
  { label: 'Create your account', done: true },
  { label: 'Set up your workspace', done: true },
  { label: 'Create your first agent', done: false, href: '/app/agents/new' },
  { label: 'Connect a social account', done: false, href: '/app/settings' },
  { label: 'Generate your first content', done: false, href: '/app/content' },
];
const onboardingProgress = onboardingSteps.filter(s => s.done).length;

export default function DashboardPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Good morning 👋</h1>
          <p className="text-muted-foreground mt-1 text-sm">Your workspace is ready. Here&apos;s your overview.</p>
        </div>
        <Link href="/app/agents/new"
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm shadow-primary/25">
          <Plus className="w-4 h-4" /> New Agent
        </Link>
      </div>

      {/* Onboarding progress */}
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
            <div className="text-3xl font-bold tracking-tight mb-1">{s.value}</div>
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
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Play className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No runs yet</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">Create an agent to get started</p>
            <Link href="/app/agents/new" className="mt-3 text-xs text-primary hover:underline">
              Create agent →
            </Link>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-muted-foreground" /> Upcoming posts
            </h2>
            <Link href="/app/content" className="text-xs text-primary hover:underline">View calendar</Link>
          </div>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Rss className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No content scheduled</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">Generate your first week of posts</p>
            <Link href="/app/content" className="mt-3 text-xs text-primary hover:underline">
              Generate content →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
