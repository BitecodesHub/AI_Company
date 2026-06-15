/**
 * Microsoft Teams connector — read channels/chats and post messages via the
 * Microsoft Graph API. (ARCHITECTURE.md §10 — "later connectors: … Teams")
 *
 * Auth: OAuth2 (Azure AD v2 / Microsoft identity platform), delegated scopes.
 * Tokens are obtained by the central /v1/connectors/teams/oauth/* flow and
 * passed in as `ctx.accessToken` (decrypted from the vault, never logged).
 *
 * Risk model: every read action ('list*') is `read` and runs automatically;
 * every outbound write ('send*'/'reply*') is `write` and therefore flows
 * through the human approval gate before it executes.
 */
import { z } from 'zod';
import type { Connector, ConnectorContext, ConnectorRiskClass } from '../connector.interface.js';

const ListChannelsSchema = z.object({ teamId: z.string().min(1) });
const ListChannelMessagesSchema = z.object({
  teamId: z.string().min(1),
  channelId: z.string().min(1),
  top: z.number().int().min(1).max(50).default(20),
});
const SendChannelMessageSchema = z.object({
  teamId: z.string().min(1),
  channelId: z.string().min(1),
  message: z.string().min(1),
  contentType: z.enum(['text', 'html']).default('html'),
});
const ReplyChannelMessageSchema = z.object({
  teamId: z.string().min(1),
  channelId: z.string().min(1),
  messageId: z.string().min(1),
  message: z.string().min(1),
  contentType: z.enum(['text', 'html']).default('html'),
});
const SendChatMessageSchema = z.object({
  chatId: z.string().min(1),
  message: z.string().min(1),
  contentType: z.enum(['text', 'html']).default('html'),
});

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

async function graphApi(
  path: string,
  method: string,
  accessToken: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const data = (text ? JSON.parse(text) : {}) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Microsoft Graph error ${res.status}: ${JSON.stringify(data['error'] ?? data)}`);
  }
  return data;
}

const READ_ACTIONS = new Set(['listJoinedTeams', 'listChannels', 'listChannelMessages', 'listChats']);

export const TeamsConnector: Connector = {
  type: 'teams',
  displayName: 'Microsoft Teams',
  authKind: 'oauth2',
  scopes: [
    'offline_access',
    'openid',
    'profile',
    'User.Read',
    'Team.ReadBasic.All',
    'Channel.ReadBasic.All',
    'ChannelMessage.Read.All',
    'ChannelMessage.Send',
    'Chat.Read',
    'ChatMessage.Send',
  ],

  actions: {
    listJoinedTeams: {
      description: 'List the Teams the connected user is a member of',
      inputSchema: z.object({}),
      outputSchema: z.object({ teams: z.array(z.unknown()) }),
      riskClass: 'read' as ConnectorRiskClass,
      handler: async (_input, ctx) => {
        const data = await graphApi('/me/joinedTeams', 'GET', ctx.accessToken ?? '');
        return { teams: (data['value'] as unknown[]) ?? [] };
      },
    },

    listChannels: {
      description: 'List channels in a team',
      inputSchema: ListChannelsSchema,
      outputSchema: z.object({ channels: z.array(z.unknown()) }),
      riskClass: 'read' as ConnectorRiskClass,
      handler: async (input, ctx) => {
        const { teamId } = ListChannelsSchema.parse(input);
        const data = await graphApi(`/teams/${teamId}/channels`, 'GET', ctx.accessToken ?? '');
        return { channels: (data['value'] as unknown[]) ?? [] };
      },
    },

    listChannelMessages: {
      description: 'Fetch recent messages from a team channel',
      inputSchema: ListChannelMessagesSchema,
      outputSchema: z.object({ messages: z.array(z.unknown()) }),
      riskClass: 'read' as ConnectorRiskClass,
      handler: async (input, ctx) => {
        const { teamId, channelId, top } = ListChannelMessagesSchema.parse(input);
        const data = await graphApi(
          `/teams/${teamId}/channels/${channelId}/messages?$top=${top}`,
          'GET',
          ctx.accessToken ?? '',
        );
        return { messages: (data['value'] as unknown[]) ?? [] };
      },
    },

    listChats: {
      description: 'List the connected user’s 1:1 and group chats',
      inputSchema: z.object({}),
      outputSchema: z.object({ chats: z.array(z.unknown()) }),
      riskClass: 'read' as ConnectorRiskClass,
      handler: async (_input, ctx) => {
        const data = await graphApi('/me/chats', 'GET', ctx.accessToken ?? '');
        return { chats: (data['value'] as unknown[]) ?? [] };
      },
    },

    sendChannelMessage: {
      description: 'Post a message to a team channel (requires approval)',
      inputSchema: SendChannelMessageSchema,
      outputSchema: z.object({ messageId: z.string() }),
      riskClass: 'write' as ConnectorRiskClass,
      handler: async (input, ctx) => {
        const body = SendChannelMessageSchema.parse(input);
        const data = await graphApi(
          `/teams/${body.teamId}/channels/${body.channelId}/messages`,
          'POST',
          ctx.accessToken ?? '',
          { body: { contentType: body.contentType, content: body.message } },
        );
        return { messageId: String(data['id'] ?? '') };
      },
    },

    replyToChannelMessage: {
      description: 'Reply to a message in a team channel (requires approval)',
      inputSchema: ReplyChannelMessageSchema,
      outputSchema: z.object({ messageId: z.string() }),
      riskClass: 'write' as ConnectorRiskClass,
      handler: async (input, ctx) => {
        const body = ReplyChannelMessageSchema.parse(input);
        const data = await graphApi(
          `/teams/${body.teamId}/channels/${body.channelId}/messages/${body.messageId}/replies`,
          'POST',
          ctx.accessToken ?? '',
          { body: { contentType: body.contentType, content: body.message } },
        );
        return { messageId: String(data['id'] ?? '') };
      },
    },

    sendChatMessage: {
      description: 'Send a message to a Teams chat (requires approval)',
      inputSchema: SendChatMessageSchema,
      outputSchema: z.object({ messageId: z.string() }),
      riskClass: 'write' as ConnectorRiskClass,
      handler: async (input, ctx) => {
        const body = SendChatMessageSchema.parse(input);
        const data = await graphApi(
          `/chats/${body.chatId}/messages`,
          'POST',
          ctx.accessToken ?? '',
          { body: { contentType: body.contentType, content: body.message } },
        );
        return { messageId: String(data['id'] ?? '') };
      },
    },
  },

  riskClass(action: string): ConnectorRiskClass {
    return READ_ACTIONS.has(action) ? 'read' : 'write';
  },
};
