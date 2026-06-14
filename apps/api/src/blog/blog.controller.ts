import { Controller, Get, Post, Patch, Param, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { inngest } from '../inngest/client.js';

const GenerateBlogSchema = z.object({
  topic: z.string().min(1),
  keywords: z.array(z.string()).optional(),
  tone: z.string().optional(),
  wordCount: z.number().int().min(300).max(5000).default(800),
});

const CreateBlogSchema = z.object({
  title: z.string().min(1),
  bodyMd: z.string(),
  excerpt: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'published']).default('draft'),
  publishedAt: z.coerce.date().optional(),
});

const SeoPagePatchSchema = z.object({
  title: z.string().optional(),
  metaDescription: z.string().optional(),
  noindex: z.boolean().optional(),
  canonical: z.string().url().optional(),
});

@ApiTags('blog')
@ApiBearerAuth()
@Controller('v1')
export class BlogController {
  // ── Blog posts ────────────────────────────────────────────────────────────────
  @Post('blog-posts')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a blog post' })
  create(@Body(new ZodValidationPipe(CreateBlogSchema)) body: z.infer<typeof CreateBlogSchema>) {
    return { id: `blog-${Date.now()}`, ...body };
  }

  @Get('blog-posts')
  @ApiOperation({ summary: 'List blog posts' })
  list() { return { items: [], nextCursor: null }; }

  @Patch('blog-posts/:id')
  @ApiOperation({ summary: 'Update a blog post' })
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) { return { id, ...body }; }

  @Post('blog-posts/generate')
  @HttpCode(202)
  @ApiOperation({ summary: 'AI-generate a blog post from a topic' })
  async generate(@Body(new ZodValidationPipe(GenerateBlogSchema)) body: z.infer<typeof GenerateBlogSchema>) {
    const runId = `run-blog-${Date.now()}`;
    await inngest.send({ name: 'agent/run', data: { runId, task: 'generate_blog_post', ...body } });
    return { runId, status: 'queued', topic: body.topic };
  }

  @Post('blog-posts/:id/publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Publish a blog post' })
  async publish(@Param('id') id: string) {
    await inngest.send({ name: 'seo/generate', data: { kind: 'blog_post', id } });
    return { id, status: 'published', publishedAt: new Date() };
  }

  // ── SEO pages ─────────────────────────────────────────────────────────────────
  @Get('seo-pages')
  @ApiOperation({ summary: 'List SEO pages' })
  listSeoPages() { return { items: [], nextCursor: null }; }

  @Patch('seo-pages/:id')
  @ApiOperation({ summary: 'Update SEO metadata for a page' })
  updateSeoPage(@Param('id') id: string, @Body(new ZodValidationPipe(SeoPagePatchSchema)) body: z.infer<typeof SeoPagePatchSchema>) {
    return { id, ...body };
  }
}
