import type { ReactNode } from 'react';
import { MarketingNav } from '../../../src/components/marketing/marketing-nav';
import { MarketingFooter } from '../../../src/components/marketing/marketing-footer';

// Public marketing shell — shared nav + footer for home, features, pricing,
// about, contact, docs, and legal pages.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
