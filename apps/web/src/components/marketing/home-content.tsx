'use client';

/**
 * HomeContent — the marketing homepage. Confident, specific copy (not generic
 * filler), smooth scroll-reveal via framer-motion (reduced-motion aware), and a
 * "meet your team" section driven by the same role templates the product hires.
 */
import { ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Brain, GitBranch, MessagesSquare, ShieldCheck, Workflow, Plug,
  Sparkles, CheckCircle2, Play, ChevronRight,
} from 'lucide-react';
import { EMPLOYEE_TEMPLATES } from '../../lib/employee-templates';
import { FAQ_ITEMS } from '../../lib/marketing-content';

const FEATURES = [
  { icon: GitBranch, title: 'Orchestration that routes itself', desc: 'Ask the company in plain language. The right employee picks it up; the wrong fit proposes a divert you confirm once.' },
  { icon: Brain, title: 'Memory that compounds', desc: 'Employees remember corrections and context. Tell them once; the behaviour sticks across runs.' },
  { icon: ShieldCheck, title: 'Human-in-the-loop controls', desc: 'Activation, approval gates, plan mode, and daily spend caps. Approve risky steps in-app or by email.' },
  { icon: MessagesSquare, title: 'One company timeline', desc: 'Every message, hand-off, and decision in a single live feed. No more guessing what your agents did.' },
  { icon: Workflow, title: 'Schedules & long-running work', desc: 'Put employees on a cadence with per-agent caps, or let them run multi-step jobs that survive restarts.' },
  { icon: Plug, title: 'Connect your stack', desc: 'Email, Slack, social, Notion, GitHub and more — credentials encrypted, every tool call audited.' },
];

const STEPS = [
  { n: '01', title: 'Hire', desc: 'Pick a role from the marketplace — HR, Support, Sales, Research. They start with a goal and safe defaults.' },
  { n: '02', title: 'Delegate', desc: 'Ask the company. Work routes to the right employee, who can pull in others when needed.' },
  { n: '03', title: 'Oversee', desc: 'Watch every run live, approve sensitive actions, and let employees learn from your corrections.' },
];

const TESTIMONIALS = [
  { name: 'Sarah K.', role: 'Head of Marketing', quote: 'It is the first agent product that did not feel like a demo. The approval gates meant I actually trusted it with real work.' },
  { name: 'Marcus T.', role: 'Founder', quote: 'I hired a Chief of Staff and a Support Lead in a minute. Routing and the live timeline are genuinely useful, not a gimmick.' },
  { name: 'Priya S.', role: 'Agency Owner', quote: 'Per-employee spend caps and a full audit trail are why this passed our review. Setup was one provider key.' },
];

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function HomeContent() {
  const params = useParams();
  const locale = (params?.locale as string) ?? 'en';
  const l = (href: string) => `/${locale}${href}`;
  const team = EMPLOYEE_TEMPLATES.slice(0, 6);

  return (
    <div className="overflow-hidden">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[60rem] h-[60rem] rounded-full bg-gradient-to-br from-primary/15 via-violet-500/10 to-transparent blur-3xl" />
          <div className="absolute top-40 -right-40 w-[36rem] h-[36rem] rounded-full bg-gradient-to-br from-cyan-400/10 to-transparent blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border border-border bg-card/60 text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Your AI workforce — hired in a click
            </span>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="mt-6 text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
              Hire AI employees that
              <span className="block bg-gradient-to-r from-primary via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">actually do the work.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Build an AI company: hire role-based employees, delegate in plain language, and keep humans in control with approvals, memory, and a live timeline of everything they do.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
              <Link href={l('/signup')} className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25">
                Start free <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href={l('/features')} className="inline-flex items-center gap-2 border border-border px-6 py-3 rounded-xl text-sm font-semibold hover:bg-muted transition-colors">
                <Play className="w-4 h-4" /> See how it works
              </Link>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Open-core · one provider key · self-hostable</p>
          </Reveal>

          {/* Floating product peek */}
          <Reveal delay={0.2}>
            <div className="mt-14 relative max-w-3xl mx-auto">
              <div className="rounded-2xl border border-border bg-card shadow-2xl shadow-primary/5 overflow-hidden text-left">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-2/40">
                  <span className="w-3 h-3 rounded-full bg-red-400" /><span className="w-3 h-3 rounded-full bg-amber-400" /><span className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="ml-2 text-xs text-muted-foreground">Company chat</span>
                </div>
                <div className="p-5 space-y-3 text-sm">
                  <div className="flex gap-2"><span className="text-muted-foreground">You</span><span className="bg-primary/10 rounded-lg px-3 py-1.5">Draft the launch announcement and reply to the angry review.</span></div>
                  <div className="flex gap-2"><span>🧭</span><span className="bg-muted rounded-lg px-3 py-1.5">Routing → ✍️ Quill (content) and 🎧 Sage (support).</span></div>
                  <div className="flex gap-2"><span>✍️</span><span className="bg-muted rounded-lg px-3 py-1.5">Draft ready. Awaiting your approval before publishing.</span></div>
                  <div className="flex gap-2"><span>🎧</span><span className="bg-muted rounded-lg px-3 py-1.5">Reply drafted in your brand voice — approve to send.</span></div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Trust strip ───────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-surface-2/20">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[['1 key', 'to power every feature'], ['100%', 'runs traceable'], ['Row-level', 'tenant isolation'], ['Open', 'core, self-hostable']].map(([a, b]) => (
            <div key={a}><div className="text-2xl font-bold">{a}</div><div className="text-xs text-muted-foreground mt-1">{b}</div></div>
          ))}
        </div>
      </section>

      {/* ── Meet your team ────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <Reveal>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Meet your team</h2>
            <p className="text-muted-foreground mt-2 max-w-xl mx-auto">Hire ready-made employees. Each comes with a role, goal, and the controls to work safely.</p>
          </div>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {team.map((t, i) => (
            <Reveal key={t.key} delay={i * 0.05}>
              <div className="h-full border border-border rounded-2xl p-5 bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${t.accent} flex items-center justify-center text-xl`}>{t.avatar}</div>
                  <div><p className="font-semibold leading-tight">{t.name}</p><p className="text-xs text-muted-foreground">{t.role}</p></div>
                </div>
                <p className="text-sm text-muted-foreground">{t.tagline}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link href={l('/signup')} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:gap-2.5 transition-all">
            Browse the full marketplace <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="bg-surface-2/20 border-y border-border">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight">A real company, not a chatbot</h2>
              <p className="text-muted-foreground mt-2 max-w-xl mx-auto">Everything you need to run an AI workforce responsibly.</p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.05}>
                <div className="h-full border border-border rounded-2xl p-6 bg-card">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                    <f.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1.5">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-3 gap-6">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08}>
              <div className="relative border border-border rounded-2xl p-6 bg-card h-full">
                <span className="text-4xl font-bold text-primary/15">{s.n}</span>
                <h3 className="text-lg font-semibold mt-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────────────────── */}
      <section className="bg-surface-2/20 border-y border-border">
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.06}>
              <figure className="h-full border border-border rounded-2xl p-6 bg-card">
                <blockquote className="text-sm leading-relaxed">“{t.quote}”</blockquote>
                <figcaption className="mt-4 text-sm"><span className="font-semibold">{t.name}</span><span className="text-muted-foreground"> · {t.role}</span></figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight text-center mb-10">Questions, answered</h2>
        </Reveal>
        <div className="divide-y divide-border border border-border rounded-2xl bg-card">
          {FAQ_ITEMS.map((f) => (
            <details key={f.question} className="group p-5 [&_summary]:cursor-pointer">
              <summary className="flex items-center justify-between font-medium list-none">
                {f.question}
                <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-90" />
              </summary>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{f.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-violet-500/5 to-transparent p-10 sm:p-14 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Build your AI company today</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Hire your first employee in under a minute. One provider key. Full control.</p>
            <div className="mt-7 flex items-center justify-center gap-3 flex-wrap">
              <Link href={l('/signup')} className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25">
                Start free <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href={l('/pricing')} className="inline-flex items-center gap-2 border border-border px-6 py-3 rounded-xl text-sm font-semibold hover:bg-muted transition-colors">
                View pricing
              </Link>
            </div>
            <div className="mt-5 flex items-center justify-center gap-4 text-xs text-muted-foreground flex-wrap">
              {['No credit card', 'Self-host or cloud', 'Cancel anytime'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {t}</span>
              ))}
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
