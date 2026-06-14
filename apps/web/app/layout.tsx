import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import '../src/styles/globals.css';

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Bitecodes';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bitecodes.com';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: `${BRAND} — Hire AI employees that actually do the work`, template: `%s | ${BRAND}` },
  description: 'Build an AI company: hire role-based AI employees, delegate in plain language, and keep humans in control.',
  applicationName: BRAND,
  robots: { index: true, follow: true },
};

// Root layout — provides global CSS + default metadata. The [locale] layout
// provides theme + providers.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
