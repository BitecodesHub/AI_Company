/**
 * JSON-LD structured data builders (typed via schema-dts).
 * (ARCHITECTURE.md §15, P10-02)
 *
 * Supports: Organization, WebSite, Article/BlogPosting,
 * SoftwareApplication, BreadcrumbList, FAQPage, Product/Offer, ProfilePage.
 */
import type { Organization, WebSite, BlogPosting, SoftwareApplication, BreadcrumbList, FAQPage, ProfilePage, WithContext } from 'schema-dts';
export type JsonLdScript<T extends Record<string, unknown> = Record<string, unknown>> = {
    '@context': 'https://schema.org';
} & T;
export declare function buildOrganization(opts: {
    name: string;
    url: string;
    logo?: string;
    description?: string;
    sameAs?: string[];
}): WithContext<Organization>;
export declare function buildWebSite(opts: {
    name: string;
    url: string;
    searchUrl?: string;
}): WithContext<WebSite>;
export declare function buildBlogPosting(opts: {
    headline: string;
    url: string;
    description?: string;
    authorName: string;
    publishedAt: string;
    modifiedAt?: string;
    imageUrl?: string;
    keywords?: string[];
}): WithContext<BlogPosting>;
export declare function buildSoftwareApplication(opts: {
    name: string;
    url: string;
    description: string;
    operatingSystem?: string;
    applicationCategory?: string;
    price?: string;
    priceCurrency?: string;
}): WithContext<SoftwareApplication>;
export declare function buildBreadcrumbList(items: {
    name: string;
    url: string;
}[]): WithContext<BreadcrumbList>;
export declare function buildFAQPage(faqItems: {
    question: string;
    answer: string;
}[]): WithContext<FAQPage>;
export declare function buildProfilePage(opts: {
    identifier: string;
    name: string;
    description?: string;
    url: string;
    imageUrl?: string;
}): WithContext<ProfilePage>;
/** Serialize a JSON-LD object to a <script> tag string for injection into HTML. */
export declare function toScriptTag(jsonld: unknown): string;
//# sourceMappingURL=jsonld.d.ts.map