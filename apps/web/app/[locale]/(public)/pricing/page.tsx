import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import { Reveal } from '../../../../src/components/marketing/reveal';
import { buildFAQPage } from '@bitecodes/seo';

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Bitecodes';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bitecodes.com';
const DESCRIPTION = 'Simple, transparent pricing. Start free, self-host for nothing, or scale with Pro and Team. One AI provider key powers everything.';

export const metadata: Metadata = {
  title: 'Pricing',
  description: DESCRIPTION,
  alternates: { canonical: `${APP_URL}/pricing` },
  openGraph: { title: `Pricing | ${BRAND}`, description: DESCRIPTION, url: `${APP_URL}/pricing`, type: 'website' },
};

const PLANS = [
  { name: 'Free', price: '$0', cadence: 'forever', desc: 'For individuals exploring AI employees.', cta: 'Start free', primary: false,
    features: ['1 workspace', '3 employees', '100 task credits / mo', 'Approvals & live timeline', 'Community support'] },
  { name: 'Pro', price: '$29', cadence: 'per month', desc: 'For creators and small teams.', cta: 'Start free trial', primary: true, badge: 'Most popular',
    features: ['Unlimited employees', '5,000 task credits / mo', 'All connectors', 'Memory & learning', 'Email support', 'API access'] },
  { name: 'Team', price: '$79', cadence: 'per month', desc: 'For growing teams that ship.', cta: 'Start free trial', primary: false,
    features: ['Everything in Pro', '20,000 task credits / mo', '5 seats', 'Custom branding', 'Priority support', 'Audit export'] },
];

const FAQ = [
  { question: 'Is there really a free plan?', answer: 'Yes — the Free plan is free forever, and the whole platform is open-core (Apache 2.0) so you can self-host at no cost.' },
  { question: 'What is a task credit?', answer: 'A task credit is the billing unit for AI work. Each employee run consumes credits based on the model and tokens used; you set per-employee daily caps.' },
  { question: 'Do I need multiple AI provider keys?', answer: 'No. One OpenRouter key or a local Ollama install powers every feature.' },
  { question: 'Can I change plans anytime?', answer: 'Yes — upgrade, downgrade, or cancel at any time. No lock-in.' },
];

export default function PricingPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFAQPage(FAQ)) }} />
      <Reveal>
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Pricing that scales with your team</h1>
          <p className="text-muted-foreground mt-4 text-lg">Start free. Self-host for nothing. Upgrade when your AI company grows.</p>
        </div>
      </Reveal>

      <div className="grid md:grid-cols-3 gap-5 mt-14">
        {PLANS.map((p, i) => (
          <Reveal key={p.name} delay={i * 0.06}>
            <div className={`relative h-full rounded-2xl border p-6 flex flex-col ${p.primary ? 'border-primary shadow-lg shadow-primary/10 bg-card' : 'border-border bg-card'}`}>
              {p.badge && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-medium px-3 py-1 rounded-full">{p.badge}</span>}
              <h3 className="font-semibold text-lg">{p.name}</h3>
              <p className="text-sm text-muted-foreground mt-1 min-h-10">{p.desc}</p>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-4xl font-bold">{p.price}</span>
                <span className="text-sm text-muted-foreground mb-1">/ {p.cadence}</span>
              </div>
              <Link href="/signup" className={`mt-5 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${p.primary ? 'bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/25' : 'border border-border hover:bg-muted'}`}>
                {p.cta} <ArrowRight className="w-4 h-4" />
              </Link>
              <ul className="mt-6 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm"><Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" /> {f}</li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <p className="text-center text-sm text-muted-foreground mt-10">
          Prefer to self-host? <Link href="/docs" className="text-primary font-medium">Run it yourself</Link> — free, open-core, one provider key.
        </p>
      </Reveal>

      <div className="max-w-3xl mx-auto mt-20">
        <h2 className="text-2xl font-bold tracking-tight text-center mb-8">Pricing FAQ</h2>
        <div className="divide-y divide-border border border-border rounded-2xl bg-card">
          {FAQ.map((f) => (
            <details key={f.question} className="group p-5 [&_summary]:cursor-pointer">
              <summary className="font-medium list-none flex items-center justify-between">{f.question}<span className="text-muted-foreground group-open:rotate-45 transition-transform text-lg leading-none">+</span></summary>
              <p className="text-sm text-muted-foreground mt-3">{f.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
