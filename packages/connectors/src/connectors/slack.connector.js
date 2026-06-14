"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlackConnector = void 0;
/**
 * Slack connector — postMessage, listChannels, event trigger.
 * (ARCHITECTURE.md §10, P4-06)
 */
const zod_1 = require("zod");
const PostMessageSchema = zod_1.z.object({
    channel: zod_1.z.string(),
    text: zod_1.z.string().min(1),
    blocks: zod_1.z.array(zod_1.z.unknown()).optional(),
    threadTs: zod_1.z.string().optional(),
});
const ListChannelsSchema = zod_1.z.object({ limit: zod_1.z.number().int().min(1).max(200).default(100) });
async function slackApi(method, ctx, body) {
    const res = await fetch(`https://slack.com/api/${method}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${ctx.accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok)
        throw new Error(`Slack API error: ${data.error}`);
    return data;
}
exports.SlackConnector = {
    type: 'slack',
    displayName: 'Slack',
    authKind: 'oauth2',
    scopes: ['chat:write', 'channels:read', 'im:read', 'im:write'],
    actions: {
        postMessage: {
            description: 'Send a message to a Slack channel',
            inputSchema: PostMessageSchema,
            outputSchema: zod_1.z.object({ ts: zod_1.z.string(), channel: zod_1.z.string() }),
            riskClass: 'write',
            handler: async (input, ctx) => {
                const body = PostMessageSchema.parse(input);
                const data = await slackApi('chat.postMessage', ctx, {
                    channel: body.channel,
                    text: body.text,
                    blocks: body.blocks,
                    thread_ts: body.threadTs,
                });
                return { ts: data.ts, channel: data.channel };
            },
        },
        listChannels: {
            description: 'List available Slack channels',
            inputSchema: ListChannelsSchema,
            outputSchema: zod_1.z.object({ channels: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), name: zod_1.z.string() })) }),
            riskClass: 'read',
            handler: async (input, ctx) => {
                const { limit } = ListChannelsSchema.parse(input);
                const data = await slackApi('conversations.list', ctx, { limit, types: 'public_channel,private_channel' });
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
    riskClass(action) {
        return action === 'postMessage' ? 'write' : 'read';
    },
};
//# sourceMappingURL=slack.connector.js.map