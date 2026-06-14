/**
 * Gmail connector — send, search, read; risk-classed.
 * (ARCHITECTURE.md §10, P4-07)
 */
import { z } from 'zod';
import type { Connector, ConnectorContext, ConnectorRiskClass } from '../connector.interface.js';

const SendEmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1).max(998),
  body: z.string().min(1),
  isHtml: z.boolean().default(false),
  cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
});

const SearchEmailSchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().int().min(1).max(100).default(10),
});

const ReadEmailSchema = z.object({ messageId: z.string() });

function buildMimeMessage(opts: {
  to: string | string[];
  from: string;
  subject: string;
  body: string;
  isHtml: boolean;
  cc?: string | string[];
}): string {
  const toStr = Array.isArray(opts.to) ? opts.to.join(', ') : opts.to;
  const ccStr = opts.cc ? (Array.isArray(opts.cc) ? opts.cc.join(', ') : opts.cc) : '';
  const contentType = opts.isHtml ? 'text/html' : 'text/plain';
  const raw = [
    `From: ${opts.from}`,
    `To: ${toStr}`,
    ccStr ? `Cc: ${ccStr}` : '',
    `Subject: ${opts.subject}`,
    `Content-Type: ${contentType}; charset=utf-8`,
    '',
    opts.body,
  ].filter(Boolean).join('\r\n');
  return Buffer.from(raw).toString('base64url');
}

export const GmailConnector: Connector = {
  type: 'gmail',
  displayName: 'Gmail',
  authKind: 'oauth2',
  scopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'],

  actions: {
    sendEmail: {
      description: 'Send an email via Gmail',
      inputSchema: SendEmailSchema,
      outputSchema: z.object({ messageId: z.string() }),
      riskClass: 'write' as ConnectorRiskClass,
      handler: async (input, ctx) => {
        const body = SendEmailSchema.parse(input);
        // Get user profile for From address
        const profile = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { Authorization: `Bearer ${ctx.accessToken}` },
        }).then(r => r.json()) as { emailAddress: string };

        const raw = buildMimeMessage({
          to: body.to,
          from: profile.emailAddress,
          subject: body.subject,
          body: body.body,
          isHtml: body.isHtml,
          cc: body.cc,
        });

        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: { Authorization: `Bearer ${ctx.accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw }),
        });
        const data = await res.json() as { id: string };
        return { messageId: data.id };
      },
    },

    searchEmails: {
      description: 'Search emails with a Gmail query string',
      inputSchema: SearchEmailSchema,
      outputSchema: z.object({ messages: z.array(z.object({ id: z.string(), threadId: z.string() })) }),
      riskClass: 'read' as ConnectorRiskClass,
      handler: async (input, ctx) => {
        const { query, maxResults } = SearchEmailSchema.parse(input);
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
          { headers: { Authorization: `Bearer ${ctx.accessToken}` } },
        );
        const data = await res.json() as { messages?: Array<{ id: string; threadId: string }> };
        return { messages: data.messages ?? [] };
      },
    },

    readEmail: {
      description: 'Read a Gmail message by ID',
      inputSchema: ReadEmailSchema,
      outputSchema: z.object({ subject: z.string(), from: z.string(), body: z.string(), date: z.string() }),
      riskClass: 'read' as ConnectorRiskClass,
      handler: async (input, ctx) => {
        const { messageId } = ReadEmailSchema.parse(input);
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
          { headers: { Authorization: `Bearer ${ctx.accessToken}` } },
        );
        const data = await res.json() as {
          payload: {
            headers: Array<{ name: string; value: string }>;
            parts?: Array<{ mimeType: string; body: { data: string } }>;
            body?: { data: string };
          };
        };
        const getHeader = (name: string) =>
          data.payload.headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
        const bodyData = data.payload.parts?.find(p => p.mimeType === 'text/plain')?.body.data
          ?? data.payload.body?.data ?? '';
        return {
          subject: getHeader('Subject'),
          from: getHeader('From'),
          date: getHeader('Date'),
          body: Buffer.from(bodyData, 'base64').toString('utf-8'),
        };
      },
    },
  },

  riskClass(action: string): ConnectorRiskClass {
    return action === 'sendEmail' ? 'write' : 'read';
  },
};
