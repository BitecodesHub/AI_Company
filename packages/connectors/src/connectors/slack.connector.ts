/**
 * Slack connector — postMessage, listChannels, event trigger.
 * (ARCHITECTURE.md §10, P4-06)
 */
import { z } from 'zod';
import type { Connector, ConnectorContext, ConnectorRiskClass } from '../connector.interface.js';

const PostMessageSchema = z.object({
  channel: z.string(),
  text: z.string().min(1),
  blocks: z.array(z.unknown()).optional(),
  threadTs: z.string().optional(),
});

const ListChannelsSchema = z.object({ limit: z.number().int().min(1).max(200).default(100) });

async function slackApi(method: string, ctx: ConnectorContext, body: unknown): Promise<unknown> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ctx.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json() as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(`Slack API error: ${data.error}`);
  return data;
}

export const SlackConnector: Connector = {
  type: 'slack',
  displayName: 'Slack',
  authKind: 'oauth2',
  scopes: ['chat:write', 'channels:read', 'im:read', 'im:write'],

  actions: {
    postMessage: {
      description: 'Send a message to a Slack channel',
      inputSchema: PostMessageSchema,
      outputSchema: z.object({ ts: z.string(), channel: z.string() }),
      riskClass: 'write' as ConnectorRiskClass,
      handler: async (input, ctx) => {
        const body = PostMessageSchema.parse(input);
        const data = await slackApi('chat.postMessage', ctx, {
          channel: body.channel,
          text: body.text,
          blocks: body.blocks,
          thread_ts: body.threadTs,
        }) as { ts: string; channel: string };
        return { ts: data.ts, channel: data.channel };
      },
    },

    listChannels: {
      description: 'List available Slack channels',
      inputSchema: ListChannelsSchema,
      outputSchema: z.object({ channels: z.array(z.object({ id: z.string(), name: z.string() })) }),
      riskClass: 'read' as ConnectorRiskClass,
      handler: async (input, ctx) => {
        const { limit } = ListChannelsSchema.parse(input);
        const data = await slackApi('conversations.list', ctx, { limit, types: 'public_channel,private_channel' }) as {
          channels: Array<{ id: string; name: string }>;
        };
        return { channels: data.channels ?? [] };
      },
    },
  },

  triggers: {
    messageReceived: {
      kind: 'webhook',
      description: 'Fires when a message is received in a subscribed channel',
      handler: async (payload, _ctx) => {
        // TODO: route to inbox/ingest or agent trigger
        console.log('[Slack trigger] message received', payload);
      },
    },
  },

  riskClass(action: string): ConnectorRiskClass {
    return action === 'postMessage' ? 'write' : 'read';
  },
};
