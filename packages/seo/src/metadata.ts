/**
 * Page metadata helpers — titles, descriptions, Open Graph, Twitter cards, canonical.
 * (ARCHITECTURE.md §15, P10-03, P10-05)
 */

export interface PageMetadata {
  title: string;
  description: string;
  canonical: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  twitterCard?: 'summary' | 'summary_large_image';
  noindex?: boolean;
}

const APP_NAME = process.env['NEXT_PUBLIC_APP_NAME'] ?? 'Bitecodes';
const APP_URL = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://bitecodes.com';

export function buildMetadata(opts: {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  noindex?: boolean;
  type?: 'website' | 'article';
}): PageMetadata {
  const canonical = `${APP_URL}${opts.path}`;
  return {
    title: `${opts.title} | ${APP_NAME}`,
    description: opts.description.slice(0, 160),
    canonical,
    ogTitle: opts.title,
    ogDescription: opts.description.slice(0, 200),
    ogImage: opts.ogImage ?? `${APP_URL}/og-default.jpg`,
    ogType: opts.type ?? 'website',
    twitterCard: 'summary_large_image',
    noindex: opts.noindex ?? false,
  };
}

/** Convert PageMetadata to a Next.js Metadata object shape */
export function toNextMetadata(meta: PageMetadata) {
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.canonical },
    robots: meta.noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: meta.ogTitle ?? meta.title,
      description: meta.ogDescription ?? meta.description,
      url: meta.canonical,
      siteName: APP_NAME,
      images: meta.ogImage ? [{ url: meta.ogImage }] : [],
      type: meta.ogType ?? 'website',
    },
    twitter: {
      card: meta.twitterCard ?? 'summary_large_image',
      title: meta.ogTitle ?? meta.title,
      description: meta.ogDescription ?? meta.description,
      images: meta.ogImage ? [meta.ogImage] : [],
    },
  };
}
