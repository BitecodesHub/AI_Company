import type { Metadata } from 'next';
import { Mail, MessageSquare, Building2 } from 'lucide-react';
import { Reveal } from '../../../../src/components/marketing/reveal';
import { ContactForm } from '../../../../src/components/marketing/contact-form';

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Bitecodes';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bitecodes.com';
const DESCRIPTION = `Talk to the ${BRAND} team — questions, demos, partnerships, or enterprise self-hosting. We reply fast.`;

export const metadata: Metadata = {
  title: 'Contact',
  description: DESCRIPTION,
  alternates: { canonical: `${APP_URL}/contact` },
  openGraph: { title: `Contact | ${BRAND}`, description: DESCRIPTION, url: `${APP_URL}/contact`, type: 'website' },
};

const REASONS = [
  { icon: MessageSquare, title: 'Product questions', body: 'Not sure if AI employees fit your workflow? Ask us anything.' },
  { icon: Building2, title: 'Enterprise & self-host', body: 'SSO, on-prem, custom branding, and volume pricing.' },
  { icon: Mail, title: 'Partnerships', body: 'Building on top of Bitecodes? Let’s talk integrations.' },
];

export default function ContactPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      <Reveal>
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Let’s talk</h1>
          <p className="text-muted-foreground mt-4 text-lg">Questions, demos, or enterprise self-hosting — we’re quick to respond.</p>
        </div>
      </Reveal>

      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 mt-14 items-start">
        <Reveal>
          <div className="space-y-4">
            {REASONS.map((r) => (
              <div key={r.title} className="flex items-start gap-3 border border-border rounded-2xl p-5 bg-card">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <r.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{r.title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{r.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <ContactForm />
        </Reveal>
      </div>
    </div>
  );
}
