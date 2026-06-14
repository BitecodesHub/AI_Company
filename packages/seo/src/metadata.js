"use strict";
/**
 * Page metadata helpers — titles, descriptions, Open Graph, Twitter cards, canonical.
 * (ARCHITECTURE.md §15, P10-03, P10-05)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMetadata = buildMetadata;
exports.toNextMetadata = toNextMetadata;
const APP_NAME = process.env['NEXT_PUBLIC_APP_NAME'] ?? 'Bitecodes';
const APP_URL = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://bitecodes.com';
function buildMetadata(opts) {
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
function toNextMetadata(meta) {
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
//# sourceMappingURL=metadata.js.map