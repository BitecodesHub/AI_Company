import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '../../../../src/components/marketing/reveal';

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Bitecodes';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bitecodes.com';
const DESCRIPTION = `${BRAND} is an open-core platform for building an AI company — hire AI employees that do real work, with the controls and visibility a real team needs.`;

export const metadata: Metadata = {
  title: 'About',
  description: DESCRIPTION,
  alternates: { canonical: `${APP_URL}/about` },
  openGraph: { title: `About | ${BRAND}`, description: DESCRIPTION, url: `${APP_URL}/about`, type: 'website' },
};

const VALUES = [
  { title: 'Trust by design', body: 'Approvals, audit trails, tenant isolation, and spend caps are not add-ons — they are the foundation.' },
  { title: 'Real work, not demos', body: 'Every feature is built to survive production: durable runs, honest failures, no fake success states.' },
  { title: 'Open and ownable', body: 'Apache 2.0 open-core, self-hostable, and operable on a single provider key. Your company, your control.' },
];

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <Reveal>
        <span className="text-sm font-medium text-primary">Our mission</span>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mt-3">Give every team an AI workforce they can trust.</h1>
        <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
          {BRAND} turns AI agents into accountable employees. You hire them by role, delegate in plain language,
          and stay in control with approvals, memory, and a live timeline of everything they do — so AI does the
          work without taking the wheel.
        </p>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="grid sm:grid-cols-3 gap-4 mt-14">
          {VALUES.map((v) => (
            <div key={v.title} className="border border-border rounded-2xl p-5 bg-card">
              <h3 className="font-semibold mb-1.5">{v.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{v.body}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.15}>
        <div className="mt-16 rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-transparent p-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Build your AI company</h2>
          <p className="text-muted-foreground mt-2">Hire your first employee in under a minute.</p>
          <Link href="/signup" className="mt-5 inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25">
            Start free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
