'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Logo } from '@bitecodes/ui';
import { Github, Twitter, Linkedin } from 'lucide-react';

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Bitecodes';

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  { title: 'Product', links: [{ href: '/features', label: 'Features' }, { href: '/pricing', label: 'Pricing' }, { href: '/signup', label: 'Get started' }, { href: '/login', label: 'Sign in' }] },
  { title: 'Company', links: [{ href: '/about', label: 'About' }, { href: '/contact', label: 'Contact' }, { href: '/docs', label: 'Docs' }] },
  { title: 'Legal', links: [{ href: '/privacy', label: 'Privacy' }, { href: '/terms', label: 'Terms' }] },
];

export function MarketingFooter() {
  const params = useParams();
  const locale = (params?.locale as string) ?? 'en';
  const l = (href: string) => `/${locale}${href}`;

  return (
    <footer className="border-t border-border bg-surface-2/30">
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid md:grid-cols-[2fr_1fr_1fr_1fr] gap-10">
          <div>
            <Logo name={BRAND} size={30} />
            <p className="text-sm text-muted-foreground mt-4 max-w-xs">
              Hire AI employees that do real work — with the controls, memory, and oversight a real team needs.
            </p>
            <div className="flex gap-3 mt-5">
              {[Github, Twitter, Linkedin].map((Icon, i) => (
                <a key={i} href="#" aria-label="social" className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold mb-3">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={l(link.href)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">© {BRAND}. Open-core, Apache 2.0. Built for teams who ship.</p>
          <p className="text-xs text-muted-foreground">Made with intent — not templates.</p>
        </div>
      </div>
    </footer>
  );
}
