/**
 * LinkedIn connector — post, comment, get analytics.
 * (ARCHITECTURE.md §10, P4-12)
 */
import { z } from 'zod';
import type { Connector, ConnectorContext, ConnectorRiskClass } from '../connector.interface.js';

const CreatePostSchema = z.object({
  text: z.string().min(1).max(3000),
  visibility: z.enum(['PUBLIC', 'CONNECTIONS']).default('PUBLIC'),
  organizationId: z.string().optional(), // If posting as org page
});

const CreateCommentSchema = z.object({
  postUrn: z.string(),
  text: z.string().min(1).max(1250),
});

async function liApiCall(endpoint: string, method: string, ctx: ConnectorContext, body?: unknown): Promise<unknown> {
  const res = await fetch(`https://api.linkedin.com/v2${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${ctx.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`LinkedIn API error: ${res.status} ${await res.text()}`);
  return res.json();
}

export const LinkedInConnector: Connector = {
  type: 'linkedin',
  displayName: 'LinkedIn',
  authKind: 'oauth2',
  scopes: ['w_member_social', 'r_liteprofile', 'r_emailaddress'],

  actions: {
    createPost: {
      description: 'Create a LinkedIn post',
      inputSchema: CreatePostSchema,
      outputSchema: z.object({ postUrn: z.string() }),
      riskClass: 'write' as ConnectorRiskClass,
      handler: async (input, ctx) => {
        const body = CreatePostSchema.parse(input);
        // Get the author URN (person or org)
        const me = await liApiCall('/me', 'GET', ctx) as { id: string };
        const authorUrn = body.organizationId
          ? `urn:li:organization:${body.organizationId}`
          : `urn:li:person:${me.id}`;

        const payload = {
          author: authorUrn,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text: body.text },
              shareMediaCategory: 'NONE',
            },
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': body.visibility,
          },
        };
        const headers: Record<string, string> = {};
        const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ctx.accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json() as Record<string, string>;
        return { postUrn: data['id'] ?? '' };
      },
    },

    createComment: {
      description: 'Comment on a LinkedIn post',
      inputSchema: CreateCommentSchema,
      outputSchema: z.object({ commentUrn: z.string() }),
      riskClass: 'write' as ConnectorRiskClass,
      handler: async (input, ctx) => {
        const body = CreateCommentSchema.parse(input);
        const me = await liApiCall('/me', 'GET', ctx) as { id: string };
        const payload = {
          actor: `urn:li:person:${me.id}`,
          message: { text: body.text },
          object: body.postUrn,
        };
        const data = await liApiCall('/socialActions/comments', 'POST', ctx, payload) as Record<string, string>;
        return { commentUrn: data['id'] ?? '' };
      },
    },

    getProfile: {
      description: 'Get the authenticated LinkedIn user profile',
      inputSchema: z.object({}),
      outputSchema: z.object({ id: z.string(), name: z.string() }),
      riskClass: 'read' as ConnectorRiskClass,
      handler: async (_input, ctx) => {
        const data = await liApiCall('/me', 'GET', ctx) as Record<string, unknown>;
        const localizedName = data['localizedFirstName'] ?? '';
        const localizedLast = data['localizedLastName'] ?? '';
        return { id: String(data['id'] ?? ''), name: `${localizedName} ${localizedLast}`.trim() };
      },
    },
  },

  riskClass(action: string): ConnectorRiskClass {
    return action === 'getProfile' ? 'read' : 'write';
  },
};
