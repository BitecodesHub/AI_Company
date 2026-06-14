"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XConnector = void 0;
/**
 * X (Twitter) connector — post, reply, read mentions/DMs.
 * (ARCHITECTURE.md §10, P4-11)
 */
const zod_1 = require("zod");
const PostTweetSchema = zod_1.z.object({
    text: zod_1.z.string().min(1).max(280),
    replyToId: zod_1.z.string().optional(),
    mediaIds: zod_1.z.array(zod_1.z.string()).optional(),
});
const GetMentionsSchema = zod_1.z.object({ maxResults: zod_1.z.number().int().min(1).max(100).default(10) });
const GetDMsSchema = zod_1.z.object({ maxResults: zod_1.z.number().int().min(1).max(50).default(10) });
const DeleteTweetSchema = zod_1.z.object({ tweetId: zod_1.z.string() });
async function xApiCall(endpoint, method, ctx, body) {
    const res = await fetch(`https://api.twitter.com/2${endpoint}`, {
        method,
        headers: {
            Authorization: `Bearer ${ctx.accessToken}`,
            'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok)
        throw new Error(`X API error: ${res.status} ${await res.text()}`);
    return res.json();
}
exports.XConnector = {
    type: 'x',
    displayName: 'X (Twitter)',
    authKind: 'oauth2',
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'dm.read', 'dm.write', 'offline.access'],
    actions: {
        postTweet: {
            description: 'Post a tweet (up to 280 chars)',
            inputSchema: PostTweetSchema,
            outputSchema: zod_1.z.object({ id: zod_1.z.string(), text: zod_1.z.string() }),
            riskClass: 'write',
            handler: async (input, ctx) => {
                const body = PostTweetSchema.parse(input);
                const payload = { text: body.text };
                if (body.replyToId)
                    payload.reply = { in_reply_to_tweet_id: body.replyToId };
                const data = await xApiCall('/tweets', 'POST', ctx, payload);
                return data.data;
            },
        },
        deleteTweet: {
            description: 'Delete a tweet by ID',
            inputSchema: DeleteTweetSchema,
            outputSchema: zod_1.z.object({ deleted: zod_1.z.boolean() }),
            riskClass: 'destructive',
            handler: async (input, ctx) => {
                const { tweetId } = DeleteTweetSchema.parse(input);
                await xApiCall(`/tweets/${tweetId}`, 'DELETE', ctx);
                return { deleted: true };
            },
        },
        getMentions: {
            description: 'Get recent mentions of the authenticated user',
            inputSchema: GetMentionsSchema,
            outputSchema: zod_1.z.object({ tweets: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), text: zod_1.z.string() })) }),
            riskClass: 'read',
            handler: async (input, ctx) => {
                const { maxResults } = GetMentionsSchema.parse(input);
                // Get authenticated user ID first
                const me = await xApiCall('/users/me', 'GET', ctx);
                const data = await xApiCall(`/users/${me.data.id}/mentions?max_results=${maxResults}&tweet.fields=id,text,created_at`, 'GET', ctx);
                return { tweets: data.data ?? [] };
            },
        },
        getDMs: {
            description: 'Get direct messages',
            inputSchema: GetDMsSchema,
            outputSchema: zod_1.z.object({ messages: zod_1.z.array(zod_1.z.unknown()) }),
            riskClass: 'read',
            handler: async (input, ctx) => {
                const { maxResults } = GetDMsSchema.parse(input);
                const data = await xApiCall(`/dm_conversations?max_results=${maxResults}`, 'GET', ctx);
                return { messages: data.data ?? [] };
            },
        },
    },
    riskClass(action) {
        if (['deleteTweet'].includes(action))
            return 'destructive';
        if (['postTweet'].includes(action))
            return 'write';
        return 'read';
    },
};
//# sourceMappingURL=x.connector.js.map