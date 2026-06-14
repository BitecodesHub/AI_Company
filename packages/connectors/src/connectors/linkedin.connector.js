"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkedInConnector = void 0;
/**
 * LinkedIn connector — post, comment, get analytics.
 * (ARCHITECTURE.md §10, P4-12)
 */
const zod_1 = require("zod");
const CreatePostSchema = zod_1.z.object({
    text: zod_1.z.string().min(1).max(3000),
    visibility: zod_1.z.enum(['PUBLIC', 'CONNECTIONS']).default('PUBLIC'),
    organizationId: zod_1.z.string().optional(), // If posting as org page
});
const CreateCommentSchema = zod_1.z.object({
    postUrn: zod_1.z.string(),
    text: zod_1.z.string().min(1).max(1250),
});
async function liApiCall(endpoint, method, ctx, body) {
    const res = await fetch(`https://api.linkedin.com/v2${endpoint}`, {
        method,
        headers: {
            Authorization: `Bearer ${ctx.accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok)
        throw new Error(`LinkedIn API error: ${res.status} ${await res.text()}`);
    return res.json();
}
exports.LinkedInConnector = {
    type: 'linkedin',
    displayName: 'LinkedIn',
    authKind: 'oauth2',
    scopes: ['w_member_social', 'r_liteprofile', 'r_emailaddress'],
    actions: {
        createPost: {
            description: 'Create a LinkedIn post',
            inputSchema: CreatePostSchema,
            outputSchema: zod_1.z.object({ postUrn: zod_1.z.string() }),
            riskClass: 'write',
            handler: async (input, ctx) => {
                const body = CreatePostSchema.parse(input);
                // Get the author URN (person or org)
                const me = await liApiCall('/me', 'GET', ctx);
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
                const headers = {};
                const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${ctx.accessToken}`,
                        'Content-Type': 'application/json',
                        'X-Restli-Protocol-Version': '2.0.0',
                    },
                    body: JSON.stringify(payload),
                });
                const data = await res.json();
                return { postUrn: data['id'] ?? '' };
            },
        },
        createComment: {
            description: 'Comment on a LinkedIn post',
            inputSchema: CreateCommentSchema,
            outputSchema: zod_1.z.object({ commentUrn: zod_1.z.string() }),
            riskClass: 'write',
            handler: async (input, ctx) => {
                const body = CreateCommentSchema.parse(input);
                const me = await liApiCall('/me', 'GET', ctx);
                const payload = {
                    actor: `urn:li:person:${me.id}`,
                    message: { text: body.text },
                    object: body.postUrn,
                };
                const data = await liApiCall('/socialActions/comments', 'POST', ctx, payload);
                return { commentUrn: data['id'] ?? '' };
            },
        },
        getProfile: {
            description: 'Get the authenticated LinkedIn user profile',
            inputSchema: zod_1.z.object({}),
            outputSchema: zod_1.z.object({ id: zod_1.z.string(), name: zod_1.z.string() }),
            riskClass: 'read',
            handler: async (_input, ctx) => {
                const data = await liApiCall('/me', 'GET', ctx);
                const localizedName = data['localizedFirstName'] ?? '';
                const localizedLast = data['localizedLastName'] ?? '';
                return { id: String(data['id'] ?? ''), name: `${localizedName} ${localizedLast}`.trim() };
            },
        },
    },
    riskClass(action) {
        return action === 'getProfile' ? 'read' : 'write';
    },
};
//# sourceMappingURL=linkedin.connector.js.map