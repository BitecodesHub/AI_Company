/**
 * Meta connector — Instagram + Facebook Pages: post, fetch comments/DMs.
 * (ARCHITECTURE.md §10, P4-13)
 */
import { z } from 'zod';
import type { Connector, ConnectorContext, ConnectorRiskClass } from '../connector.interface.js';

const CreateIgPostSchema = z.object({
  imageUrl: z.string().url(),
  caption: z.string().max(2200),
  pageId: z.string(),
});

const CreateFbPostSchema = z.object({
  message: z.string().min(1).max(63206),
  pageId: z.string(),
  link: z.string().url().optional(),
});

const GetCommentsSchema = z.object({
  postId: z.string(),
  limit: z.number().int().min(1).max(100).default(25),
});

const ReplyCommentSchema = z.object({
  commentId: z.string(),
  message: z.string().min(1),
  pageAccessToken: z.string(),
});

async function graphApi(endpoint: string, method: string, accessToken: string, body?: unknown): Promise<unknown> {
  const url = `https://graph.facebook.com/v20.0${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify({ ...body as object, access_token: accessToken }) } : {}),
  });
  const data = await res.json() as Record<string, unknown>;
  if (data['error']) throw new Error(`Meta API error: ${JSON.stringify(data['error'])}`);
  return data;
}

export const MetaConnector: Connector = {
  type: 'meta',
  displayName: 'Meta (Instagram + Facebook)',
  authKind: 'oauth2',
  scopes: [
    'pages_manage_posts', 'pages_read_engagement', 'pages_messaging',
    'instagram_basic', 'instagram_content_publish', 'instagram_manage_comments',
  ],

  actions: {
    createInstagramPost: {
      description: 'Publish a photo/video post to Instagram',
      inputSchema: CreateIgPostSchema,
      outputSchema: z.object({ postId: z.string() }),
      riskClass: 'write' as ConnectorRiskClass,
      handler: async (input, ctx) => {
        const body = CreateIgPostSchema.parse(input);
        // Step 1: create media container
        const container = await graphApi(
          `/${body.pageId}/media`,
          'POST',
          ctx.accessToken ?? '',
          { image_url: body.imageUrl, caption: body.caption },
        ) as { id: string };
        // Step 2: publish
        const published = await graphApi(
          `/${body.pageId}/media_publish`,
          'POST',
          ctx.accessToken ?? '',
          { creation_id: container.id },
        ) as { id: string };
        return { postId: published.id };
      },
    },

    createFacebookPost: {
      description: 'Publish a post to a Facebook Page',
      inputSchema: CreateFbPostSchema,
      outputSchema: z.object({ postId: z.string() }),
      riskClass: 'write' as ConnectorRiskClass,
      handler: async (input, ctx) => {
        const body = CreateFbPostSchema.parse(input);
        const data = await graphApi(
          `/${body.pageId}/feed`,
          'POST',
          ctx.accessToken ?? '',
          { message: body.message, link: body.link },
        ) as { id: string };
        return { postId: data.id };
      },
    },

    getComments: {
      description: 'Fetch comments on an Instagram/Facebook post',
      inputSchema: GetCommentsSchema,
      outputSchema: z.object({ comments: z.array(z.unknown()) }),
      riskClass: 'read' as ConnectorRiskClass,
      handler: async (input, ctx) => {
        const { postId, limit } = GetCommentsSchema.parse(input);
        const data = await graphApi(
          `/${postId}/comments?limit=${limit}&fields=id,message,from,timestamp&access_token=${ctx.accessToken}`,
          'GET',
          ctx.accessToken ?? '',
        ) as { data: unknown[] };
        return { comments: data.data ?? [] };
      },
    },

    replyToComment: {
      description: 'Reply to an Instagram/Facebook comment',
      inputSchema: ReplyCommentSchema,
      outputSchema: z.object({ commentId: z.string() }),
      riskClass: 'write' as ConnectorRiskClass,
      handler: async (input, ctx) => {
        const body = ReplyCommentSchema.parse(input);
        const data = await graphApi(
          `/${body.commentId}/replies`,
          'POST',
          body.pageAccessToken,
          { message: body.message },
        ) as { id: string };
        return { commentId: data.id };
      },
    },
  },

  riskClass(action: string): ConnectorRiskClass {
    return action === 'getComments' ? 'read' : 'write';
  },
};
