'use client';

/**
 * MarketingNav — the public site header. Glass on scroll, theme toggle, animated
 * mobile sheet. Links to the marketing pages and the app entry points.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, Moon, Sun, ArrowRight } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Logo } from '@bitecodes/ui';

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Bitecodes';
const LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/docs', label: 'Docs' },
  { href: '/contact', label: 'Contact' },
];

export function MarketingNav() {
  const params = useParams();
  const pathname = usePathname();
  const locale = (params?.locale as string) ?? 'en';
  const { resolvedTheme, setTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]);

  const l = (href: string) => `/${locale}${href}`;

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-background/80 backdrop-blur-xl border-b border-border' : 'bg-transparent'}`}>
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href={l('')} className="flex items-center group" aria-label={BRAND}>
          <Logo name={BRAND} size={30} className="transition-transform group-hover:scale-[1.03]" />
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {LINKS.map((item) => (
            <Link key={item.href} href={l(item.href)}
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg transition-colors">
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {mounted && (
            <button onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Toggle theme">
              {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}
          <Link href={l('/login')} className="hidden sm:inline-flex px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Sign in
          </Link>
          <Link href={l('/signup')}
            className="hidden sm:inline-flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm shadow-primary/25">
            Get started <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button onClick={() => setOpen((v) => !v)} className="md:hidden p-2 rounded-lg hover:bg-muted" aria-label="Menu">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl overflow-hidden"
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <div className="px-6 py-4 space-y-1">
              {LINKS.map((item) => (
                <Link key={item.href} href={l(item.href)} className="block px-3 py-2.5 rounded-lg text-sm hover:bg-muted">{item.label}</Link>
              ))}
              <div className="flex gap-2 pt-2">
                <Link href={l('/login')} className="flex-1 text-center px-3 py-2.5 rounded-xl border border-border text-sm font-medium">Sign in</Link>
                <Link href={l('/signup')} className="flex-1 text-center px-3 py-2.5 rounded-xl bg-primary text-white text-sm font-medium">Get started</Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
