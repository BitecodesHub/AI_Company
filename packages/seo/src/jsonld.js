"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOrganization = buildOrganization;
exports.buildWebSite = buildWebSite;
exports.buildBlogPosting = buildBlogPosting;
exports.buildSoftwareApplication = buildSoftwareApplication;
exports.buildBreadcrumbList = buildBreadcrumbList;
exports.buildFAQPage = buildFAQPage;
exports.buildProfilePage = buildProfilePage;
exports.toScriptTag = toScriptTag;
function buildOrganization(opts) {
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
function buildWebSite(opts) {
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
            },
        }),
    };
}
function buildBlogPosting(opts) {
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
function buildSoftwareApplication(opts) {
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
function buildBreadcrumbList(items) {
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
function buildFAQPage(faqItems) {
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
function buildProfilePage(opts) {
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
function toScriptTag(jsonld) {
    return `<script type="application/ld+json">${JSON.stringify(jsonld, null, 0)}</script>`;
}
//# sourceMappingURL=jsonld.js.map