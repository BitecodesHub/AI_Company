"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const jsonld_js_1 = require("../jsonld.js");
(0, vitest_1.describe)('JSON-LD builders', () => {
    (0, vitest_1.it)('buildOrganization produces valid schema', () => {
        const result = (0, jsonld_js_1.buildOrganization)({ name: 'Bitecodes', url: 'https://bitecodes.com' });
        (0, vitest_1.expect)(result['@context']).toBe('https://schema.org');
        (0, vitest_1.expect)(result['@type']).toBe('Organization');
        (0, vitest_1.expect)(result.name).toBe('Bitecodes');
        (0, vitest_1.expect)(result.url).toBe('https://bitecodes.com');
    });
    (0, vitest_1.it)('buildWebSite includes searchAction when searchUrl provided', () => {
        const result = (0, jsonld_js_1.buildWebSite)({
            name: 'Bitecodes',
            url: 'https://bitecodes.com',
            searchUrl: 'https://bitecodes.com/search?q={search_term_string}',
        });
        (0, vitest_1.expect)(result.potentialAction).toBeDefined();
    });
    (0, vitest_1.it)('buildBlogPosting has required SEO fields', () => {
        const result = (0, jsonld_js_1.buildBlogPosting)({
            headline: 'Test Post',
            url: 'https://bitecodes.com/blog/test',
            authorName: 'Jane Doe',
            publishedAt: '2026-01-01T00:00:00Z',
        });
        (0, vitest_1.expect)(result['@type']).toBe('BlogPosting');
        (0, vitest_1.expect)(result.headline).toBe('Test Post');
        (0, vitest_1.expect)(result.datePublished).toBe('2026-01-01T00:00:00Z');
    });
    (0, vitest_1.it)('buildBreadcrumbList has correct positions', () => {
        const result = (0, jsonld_js_1.buildBreadcrumbList)([
            { name: 'Home', url: 'https://bitecodes.com' },
            { name: 'Blog', url: 'https://bitecodes.com/blog' },
            { name: 'Post', url: 'https://bitecodes.com/blog/post' },
        ]);
        const items = result.itemListElement;
        (0, vitest_1.expect)(items).toHaveLength(3);
        (0, vitest_1.expect)(items[0]?.position).toBe(1);
        (0, vitest_1.expect)(items[2]?.position).toBe(3);
    });
    (0, vitest_1.it)('buildFAQPage generates Question/Answer pairs', () => {
        const result = (0, jsonld_js_1.buildFAQPage)([{ question: 'What is Bitecodes?', answer: 'An AI platform.' }]);
        const entities = result.mainEntity;
        (0, vitest_1.expect)(entities[0]?.['@type']).toBe('Question');
        (0, vitest_1.expect)(entities[0]?.name).toBe('What is Bitecodes?');
    });
    (0, vitest_1.it)('toScriptTag wraps in script tag', () => {
        const jsonld = (0, jsonld_js_1.buildOrganization)({ name: 'Bitecodes', url: 'https://bitecodes.com' });
        const tag = (0, jsonld_js_1.toScriptTag)(jsonld);
        (0, vitest_1.expect)(tag).toContain('<script type="application/ld+json">');
        (0, vitest_1.expect)(tag).toContain('Bitecodes');
        (0, vitest_1.expect)(tag).toContain('</script>');
    });
});
//# sourceMappingURL=jsonld.test.js.map