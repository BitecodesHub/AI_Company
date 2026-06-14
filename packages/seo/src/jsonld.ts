/**
 * JSON-LD structured data builders (typed via schema-dts).
 * (ARCHITECTURE.md §15, P10-02)
 *
 * Supports: Organization, WebSite, Article/BlogPosting,
 * SoftwareApplication, BreadcrumbList, FAQPage, Product/Offer, ProfilePage.
 */
import type {
  Organization,
  WebSite,
  BlogPosting,
  Article,
  SoftwareApplication,
  BreadcrumbList,
  FAQPage,
  ProfilePage,
  WithContext,
} from 'schema-dts';

export type JsonLdScript<T extends Record<string, unknown> = Record<string, unknown>> = {
  '@context': 'https://schema.org';
} & T;

export function buildOrganization(opts: {
  name: string;
  url: string;
  logo?: string;
  description?: string;
  sameAs?: string[];
}): WithContext<Organization> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: opts.name,
    url: opts.url,
    ...(opts.logo && { logo: { '@type': 'ImageObject', url: opts.logo } }),
    ...(opts.description && { description: opts.description }),
    ...(opts.sameAs?.length && { sameAs: opts.sameAs }),
  };
}

export function buildWebSite(opts: {
  name: string;
  url: string;
  searchUrl?: string;
}): WithContext<WebSite> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: opts.name,
    url: opts.url,
    ...(opts.searchUrl && {
      // SearchAction shape — cast because schema-dts does not fully model query-input
      potentialAction: {
        '@type': 'SearchAction',
        target: opts.searchUrl,
      } as unknown as import('schema-dts').SearchAction,
    }),
  };
}

export function buildBlogPosting(opts: {
  headline: string;
  url: string;
  description?: string;
  authorName: string;
  publishedAt: string;    // ISO 8601
  modifiedAt?: string;
  imageUrl?: string;
  keywords?: string[];
}): WithContext<BlogPosting> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: opts.headline,
    url: opts.url,
    ...(opts.description && { description: opts.description }),
    author: { '@type': 'Person', name: opts.authorName },
    datePublished: opts.publishedAt,
    ...(opts.modifiedAt && { dateModified: opts.modifiedAt }),
    ...(opts.imageUrl && { image: opts.imageUrl }),
    ...(opts.keywords?.length && { keywords: opts.keywords.join(', ') }),
  };
}

export function buildSoftwareApplication(opts: {
  name: string;
  url: string;
  description: string;
  operatingSystem?: string;
  applicationCategory?: string;
  price?: string;
  priceCurrency?: string;
}): WithContext<SoftwareApplication> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: opts.name,
    url: opts.url,
    description: opts.description,
    operatingSystem: opts.operatingSystem ?? 'Web',
    applicationCategory: opts.applicationCategory ?? 'BusinessApplication',
    offers: {
      '@type': 'Offer',
      price: opts.price ?? '0',
      priceCurrency: opts.priceCurrency ?? 'USD',
    },
  };
}

export function buildBreadcrumbList(items: { name: string; url: string }[]): WithContext<BreadcrumbList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildFAQPage(faqItems: { question: string; answer: string }[]): WithContext<FAQPage> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function buildProfilePage(opts: {
  identifier: string;
  name: string;
  description?: string;
  url: string;
  imageUrl?: string;
}): WithContext<ProfilePage> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    identifier: opts.identifier,
    name: opts.name,
    url: opts.url,
    ...(opts.description && { description: opts.description }),
    ...(opts.imageUrl && { image: opts.imageUrl }),
  };
}

/** Serialize a JSON-LD object to a <script> tag string for injection into HTML. */
export function toScriptTag(jsonld: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(jsonld, null, 0)}</script>`;
}
