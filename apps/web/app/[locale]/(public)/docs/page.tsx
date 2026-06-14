import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Code, Plug, Zap, Shield, ExternalLink } from 'lucide-react';

export const metadata: Metadata = { title: 'Documentation — Bitecodes' };

const sections = [
  { icon: Zap, title: 'Quick start', description: 'Get your first agent running in 5 minutes.', href: '#quick-start' },
  { icon: Code, title: 'API reference', description: 'Full REST API docs served at /api/docs (Swagger).', href: `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'}/docs`, external: true },
  { icon: Plug, title: 'Connector guide', description: 'Connect social accounts, email, Slack, and more.', href: '#connectors' },
  { icon: Shield, title: 'Self-hosting', description: 'Deploy Bitecodes on your own infrastructure.', href: '#self-hosting' },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground mb-8 inline-block">← Back</Link>
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-8 h-8 text-primary" />
          <h1 className="text-4xl font-bold">Documentation</h1>
        </div>
        <p className="text-muted-foreground mb-10">Everything you need to build with Bitecodes.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          {sections.map((s) => (
            <a
              key={s.title}
              href={s.href}
              target={s.external ? '_blank' : undefined}
              rel={s.external ? 'noopener noreferrer' : undefined}
              className="flex gap-4 p-5 border border-border rounded-2xl hover:border-primary/30 hover:bg-primary/5 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <s.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-semibold mb-0.5">
                  {s.title}
                  {s.external && <ExternalLink className="w-3 h-3 text-muted-foreground" />}
                </div>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </div>
            </a>
          ))}
        </div>

        <section id="quick-start" className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Quick start</h2>
          <div className="bg-muted/50 rounded-2xl p-5 font-mono text-sm space-y-1">
            <p><span className="text-muted-foreground"># 1. Clone and install</span></p>
            <p>git clone https://github.com/bitecodes/bitecodes && cd bitecodes</p>
            <p>cp .env.example .env && pnpm install</p>
            <p className="mt-2"><span className="text-muted-foreground"># 2. Start infrastructure + API</span></p>
            <p>pnpm --filter @bitecodes/api dev</p>
            <p className="mt-2"><span className="text-muted-foreground"># 3. Start the web app</span></p>
            <p>pnpm --filter @bitecodes/web dev</p>
          </div>
        </section>
      </div>
    </div>
  );
}
