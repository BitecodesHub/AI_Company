"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaConnector = void 0;
/**
 * Meta connector — Instagram + Facebook Pages: post, fetch comments/DMs.
 * (ARCHITECTURE.md §10, P4-13)
 */
const zod_1 = require("zod");
const CreateIgPostSchema = zod_1.z.object({
    imageUrl: zod_1.z.string().url(),
    caption: zod_1.z.string().max(2200),
    pageId: zod_1.z.string(),
});
const CreateFbPostSchema = zod_1.z.object({
    message: zod_1.z.string().min(1).max(63206),
    pageId: zod_1.z.string(),
    link: zod_1.z.string().url().optional(),
});
const GetCommentsSchema = zod_1.z.object({
    postId: zod_1.z.string(),
    limit: zod_1.z.number().int().min(1).max(100).default(25),
});
const ReplyCommentSchema = zod_1.z.object({
    commentId: zod_1.z.string(),
    message: zod_1.z.string().min(1),
    pageAccessToken: zod_1.z.string(),
});
async function graphApi(endpoint, method, accessToken, body) {
    const url = `https://graph.facebook.com/v20.0${endpoint}`;
    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify({ ...body, access_token: accessToken }) } : {}),
    });
    const data = await res.json();
    if (data['error'])
        throw new Error(`Meta API error: ${JSON.stringify(data['error'])}`);
    return data;
}
exports.MetaConnector = {
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
            outputSchema: zod_1.z.object({ postId: zod_1.z.string() }),
            riskClass: 'write',
            handler: async (input, ctx) => {
                const body = CreateIgPostSchema.parse(input);
                // Step 1: create media container
                const container = await graphApi(`/${body.pageId}/media`, 'POST', ctx.accessToken ?? '', { image_url: body.imageUrl, caption: body.caption });
                // Step 2: publish
                const published = await graphApi(`/${body.pageId}/media_publish`, 'POST', ctx.accessToken ?? '', { creation_id: container.id });
                return { postId: published.id };
            },
        },
        createFacebookPost: {
            description: 'Publish a post to a Facebook Page',
            inputSchema: CreateFbPostSchema,
            outputSchema: zod_1.z.object({ postId: zod_1.z.string() }),
            riskClass: 'write',
            handler: async (input, ctx) => {
                const body = CreateFbPostSchema.parse(input);
                const data = await graphApi(`/${body.pageId}/feed`, 'POST', ctx.accessToken ?? '', { message: body.message, link: body.link });
                return { postId: data.id };
            },
        },
        getComments: {
            description: 'Fetch comments on an Instagram/Facebook post',
            inputSchema: GetCommentsSchema,
            outputSchema: zod_1.z.object({ comments: zod_1.z.array(zod_1.z.unknown()) }),
            riskClass: 'read',
            handler: async (input, ctx) => {
                const { postId, limit } = GetCommentsSchema.parse(input);
                const data = await graphApi(`/${postId}/comments?limit=${limit}&fields=id,message,from,timestamp&access_token=${ctx.accessToken}`, 'GET', ctx.accessToken ?? '');
                return { comments: data.data ?? [] };
            },
        },
        replyToComment: {
            description: 'Reply to an Instagram/Facebook comment',
            inputSchema: ReplyCommentSchema,
            outputSchema: zod_1.z.object({ commentId: zod_1.z.string() }),
            riskClass: 'write',
            handler: async (input, ctx) => {
                const body = ReplyCommentSchema.parse(input);
                const data = await graphApi(`/${body.commentId}/replies`, 'POST', body.pageAccessToken, { message: body.message });
                return { commentId: data.id };
            },
        },
    },
    riskClass(action) {
        return action === 'getComments' ? 'read' : 'write';
    },
};
//# sourceMappingURL=meta.connector.js.map