import { describe, it, expect } from 'vitest';
import {
  buildOrganization,
  buildWebSite,
  buildBlogPosting,
  buildBreadcrumbList,
  buildFAQPage,
  toScriptTag,
} from '../jsonld.js';

describe('JSON-LD builders', () => {
  it('buildOrganization produces valid schema', () => {
    const result = buildOrganization({ name: 'Bitecodes', url: 'https://bitecodes.com' });
    expect(result['@context']).toBe('https://schema.org');
    expect(result['@type']).toBe('Organization');
    expect(result.name).toBe('Bitecodes');
    expect(result.url).toBe('https://bitecodes.com');
  });

  it('buildWebSite includes searchAction when searchUrl provided', () => {
    const result = buildWebSite({
      name: 'Bitecodes',
      url: 'https://bitecodes.com',
      searchUrl: 'https://bitecodes.com/search?q={search_term_string}',
    });
    expect(result.potentialAction).toBeDefined();
  });

  it('buildBlogPosting has required SEO fields', () => {
    const result = buildBlogPosting({
      headline: 'Test Post',
      url: 'https://bitecodes.com/blog/test',
      authorName: 'Jane Doe',
      publishedAt: '2026-01-01T00:00:00Z',
    });
    expect(result['@type']).toBe('BlogPosting');
    expect(result.headline).toBe('Test Post');
    expect(result.datePublished).toBe('2026-01-01T00:00:00Z');
  });

  it('buildBreadcrumbList has correct positions', () => {
    const result = buildBreadcrumbList([
      { name: 'Home', url: 'https://bitecodes.com' },
      { name: 'Blog', url: 'https://bitecodes.com/blog' },
      { name: 'Post', url: 'https://bitecodes.com/blog/post' },
    ]);
    const items = result.itemListElement as Array<{ position: number }>;
    expect(items).toHaveLength(3);
    expect(items[0]?.position).toBe(1);
    expect(items[2]?.position).toBe(3);
  });

  it('buildFAQPage generates Question/Answer pairs', () => {
    const result = buildFAQPage([{ question: 'What is Bitecodes?', answer: 'An AI platform.' }]);
    const entities = result.mainEntity as Array<{ '@type': string; name: string }>;
    expect(entities[0]?.['@type']).toBe('Question');
    expect(entities[0]?.name).toBe('What is Bitecodes?');
  });

  it('toScriptTag wraps in script tag', () => {
    const jsonld = buildOrganization({ name: 'Bitecodes', url: 'https://bitecodes.com' });
    const tag = toScriptTag(jsonld as any);
    expect(tag).toContain('<script type="application/ld+json">');
    expect(tag).toContain('Bitecodes');
    expect(tag).toContain('</script>');
  });
});
