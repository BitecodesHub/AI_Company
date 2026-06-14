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
export declare function buildMetadata(opts: {
    title: string;
    description: string;
    path: string;
    ogImage?: string;
    noindex?: boolean;
    type?: 'website' | 'article';
}): PageMetadata;
/** Convert PageMetadata to a Next.js Metadata object shape */
export declare function toNextMetadata(meta: PageMetadata): {
    title: string;
    description: string;
    alternates: {
        canonical: string;
    };
    robots: {
        index: boolean;
        follow: boolean;
    };
    openGraph: {
        title: string;
        description: string;
        url: string;
        siteName: string;
        images: {
            url: string;
        }[];
        type: "website" | "article";
    };
    twitter: {
        card: "summary" | "summary_large_image";
        title: string;
        description: string;
        images: string[];
    };
};
//# sourceMappingURL=metadata.d.ts.map