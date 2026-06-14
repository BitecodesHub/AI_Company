import type { Metadata } from 'next';
import { buildOrganization, buildWebSite, buildSoftwareApplication, buildFAQPage } from '@bitecodes/seo';
import { HomeContent } from '../../../src/components/marketing/home-content';
import { FAQ_ITEMS } from '../../../src/lib/marketing-content';

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Bitecodes';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bitecodes.com';
const TITLE = `${BRAND} — Hire AI employees that actually do the work`;
const DESCRIPTION =
  'Build an AI company: hire role-based AI employees, delegate in plain language, and keep humans in control with approvals, memory, and a live timeline. Open-core and self-hostable.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: APP_URL + '/' },
  openGraph: {
    type: 'website', url: APP_URL + '/', title: TITLE, description: DESCRIPTION, siteName: BRAND,
    images: [{ url: `${APP_URL}/og-default.jpg`, width: 1200, height: 630, alt: BRAND }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [`${APP_URL}/og-default.jpg`] },
  keywords: ['AI employees', 'AI agents', 'agentic AI platform', 'AI workforce', 'AI orchestration', 'hire AI', 'autonomous agents'],
};

const JSONLD = [
  buildOrganization({ name: BRAND, url: APP_URL, logo: `${APP_URL}/logo.png`, description: DESCRIPTION, sameAs: ['https://github.com'] }),
  buildWebSite({ name: BRAND, url: APP_URL }),
  buildSoftwareApplication({ name: BRAND, url: APP_URL, description: DESCRIPTION, applicationCategory: 'BusinessApplication', price: '0', priceCurrency: 'USD' }),
  buildFAQPage(FAQ_ITEMS),
];

export default function HomePage() {
  return (
    <>
      {JSONLD.map((ld, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      ))}
      <HomeContent />
    </>
  );
}
