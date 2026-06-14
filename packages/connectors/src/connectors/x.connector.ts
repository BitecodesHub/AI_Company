/**
 * X (Twitter) connector — post, reply, read mentions/DMs.
 * (ARCHITECTURE.md §10, P4-11)
 */
import { z } from 'zod';
import type { Connector, ConnectorAction, ConnectorContext, ConnectorRiskClass } from '../connector.interface.js';

const PostTweetSchema = z.object({
  text: z.string().min(1).max(280),
  replyToId: z.string().optional(),
  mediaIds: z.array(z.string()).optional(),
});

const GetMentionsSchema = z.object({ maxResults: z.number().int().min(1).max(100).default(10) });
const GetDMsSchema = z.object({ maxResults: z.number().int().min(1).max(50).default(10) });
const DeleteTweetSchema = z.object({ tweetId: z.string() });

async function xApiCall(
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE',
  ctx: ConnectorContext,
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`https://api.twitter.com/2${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${ctx.accessToken}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`X API error: ${res.status} ${await res.text()}`);
  return res.json();
}

export const XConnector: Connector = {
  type: 'x',
  displayName: 'X (Twitter)',
  authKind: 'oauth2',
  scopes: ['tweet.read', 'tweet.write', 'users.read', 'dm.read', 'dm.write', 'offline.access'],

  actions: {
    postTweet: {
      description: 'Post a tweet (up to 280 chars)',
      inputSchema: PostTweetSchema,
      outputSchema: z.object({ id: z.string(), text: z.string() }),
      riskClass: 'write' as ConnectorRiskClass,
      handler: async (input, ctx) => {
        const body = PostTweetSchema.parse(input);
        const payload: Record<string, unknown> = { text: body.text };
        if (body.replyToId) payload.reply = { in_reply_to_tweet_id: body.replyToId };
        const data = await xApiCall('/tweets', 'POST', ctx, payload) as { data: { id: string; text: string } };
        return data.data;
      },
    },

    deleteTweet: {
      description: 'Delete a tweet by ID',
      inputSchema: DeleteTweetSchema,
      outputSchema: z.object({ deleted: z.boolean() }),
      riskClass: 'destructive' as ConnectorRiskClass,
      handler: async (input, ctx) => {
        const { tweetId } = DeleteTweetSchema.parse(input);
        await xApiCall(`/tweets/${tweetId}`, 'DELETE', ctx);
        return { deleted: true };
      },
    },

    getMentions: {
      description: 'Get recent mentions of the authenticated user',
      inputSchema: GetMentionsSchema,
      outputSchema: z.object({ tweets: z.array(z.object({ id: z.string(), text: z.string() })) }),
      riskClass: 'read' as ConnectorRiskClass,
      handler: async (input, ctx) => {
        const { maxResults } = GetMentionsSchema.parse(input);
        // Get authenticated user ID first
        const me = await xApiCall('/users/me', 'GET', ctx) as { data: { id: string } };
        const data = await xApiCall(
          `/users/${me.data.id}/mentions?max_results=${maxResults}&tweet.fields=id,text,created_at`,
          'GET', ctx,
        ) as { data: Array<{ id: string; text: string }> };
        return { tweets: data.data ?? [] };
      },
    },

    getDMs: {
      description: 'Get direct messages',
      inputSchema: GetDMsSchema,
      outputSchema: z.object({ messages: z.array(z.unknown()) }),
      riskClass: 'read' as ConnectorRiskClass,
      handler: async (input, ctx) => {
        const { maxResults } = GetDMsSchema.parse(input);
        const data = await xApiCall(`/dm_conversations?max_results=${maxResults}`, 'GET', ctx) as { data: unknown[] };
        return { messages: data.data ?? [] };
      },
    },
  },

  riskClass(action: string): ConnectorRiskClass {
    if (['deleteTweet'].includes(action)) return 'destructive';
    if (['postTweet'].includes(action)) return 'write';
    return 'read';
  },
};
