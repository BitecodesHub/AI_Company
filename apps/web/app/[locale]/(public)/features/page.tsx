import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, GitBranch, Brain, ShieldCheck, MessagesSquare, Workflow, Plug, Gauge, Users, Eye } from 'lucide-react';
import { Reveal } from '../../../../src/components/marketing/reveal';

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Bitecodes';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bitecodes.com';
const DESCRIPTION = 'Orchestration, memory, human-in-the-loop approvals, a live company timeline, scheduling, and connectors — everything you need to run an AI workforce responsibly.';

export const metadata: Metadata = {
  title: 'Features',
  description: DESCRIPTION,
  alternates: { canonical: `${APP_URL}/features` },
  openGraph: { title: `Features | ${BRAND}`, description: DESCRIPTION, url: `${APP_URL}/features`, type: 'website' },
};

const SECTIONS = [
  { icon: Users, title: 'Hire role-based employees', body: 'Pick from a marketplace of ready-made roles — Chief of Staff, HR, Support, Sales, Research, Finance. Each starts with a goal, tools, and safe defaults.' },
  { icon: GitBranch, title: 'Orchestration & routing', body: 'Ask the company in plain language. Requests route to the best-fit employee; a poor match proposes a divert you confirm once. High-confidence routes auto-dispatch.' },
  { icon: Brain, title: 'Memory & learning', body: 'Employees remember context and your corrections. Correct a route once and the same request routes itself next time — measurable, durable learning.' },
  { icon: ShieldCheck, title: 'Human-in-the-loop controls', body: 'Per-employee activation, approval mode, plan mode, and daily run/cost caps. Risky actions pause for approval in-app or via a signed email link.' },
  { icon: MessagesSquare, title: 'One live company timeline', body: 'Every message, observation, and hand-off in a single real-time feed. See exactly what each employee did and why.' },
  { icon: Eye, title: 'Full run visibility', body: 'A Run Inspector shows every step, tool call, token, and cost, with pause / resume / cancel / replay. No black boxes.' },
  { icon: Workflow, title: 'Scheduling & long-running work', body: 'Put employees on a cadence with caps, or let them run multi-step jobs that survive restarts on durable execution.' },
  { icon: Plug, title: 'Connectors', body: 'Email, Slack, social, Notion, GitHub and more. Credentials are encrypted in a vault and every tool call is audited.' },
  { icon: Gauge, title: 'Operable on one key', body: 'Run everything through a single provider — one OpenRouter key or a local Ollama install. Built-in health checks and setup validation.' },
];

export default function FeaturesPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-20">
      <Reveal>
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">A real company, not a chatbot</h1>
          <p className="text-muted-foreground mt-4 text-lg">Everything you need to run an AI workforce — with the oversight a real team demands.</p>
        </div>
      </Reveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-14">
        {SECTIONS.map((s, i) => (
          <Reveal key={s.title} delay={(i % 3) * 0.05}>
            <div className="h-full border border-border rounded-2xl p-6 bg-card hover:border-primary/30 transition-colors">
              <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <s.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1.5">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="mt-16 text-center">
          <Link href="/signup" className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25">
            Start free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
