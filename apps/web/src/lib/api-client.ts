/**
 * Typed API client for the Bitecodes REST API.
 *
 * The browser calls same-origin relative paths (/v1/*); the Next.js server
 * proxies them to the API (see next.config.ts rewrites), so no API URL is baked
 * into the client bundle. The Better Auth session cookie rides credentials:'include'.
 * The TenantGuard resolves the user's default workspace automatically;
 * pass workspaceId in RequestOptions to switch workspaces.
 */

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  workspaceId?: string;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.workspaceId) headers['x-bitecodes-workspace'] = opts.workspaceId;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  const init: RequestInit = { method, headers, credentials: 'include' };
  if (body != null) init.body = JSON.stringify(body);
  if (opts.signal) init.signal = opts.signal;

  const res = await fetch(path, init);

  if (res.status === 204) return undefined as T;

  let data: unknown;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : undefined; } catch { data = text; }

  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } })?.error;
    if (res.status === 401 && typeof window !== 'undefined') {
      const locale = window.location.pathname.split('/')[1] ?? '';
      const loginPath = /^[a-z]{2}$/.test(locale) ? `/${locale}/login` : '/login';
      window.location.href = loginPath;
    }
    throw new ApiError(
      err?.code ?? 'UPSTREAM_ERROR',
      err?.message ?? `Request failed (${res.status})`,
      res.status,
      err?.details,
    );
  }

  return data as T;
}

export const api = {
  get:    <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, undefined, opts),
  post:   <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('POST', path, body, opts),
  patch:  <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PATCH', path, body, opts),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, undefined, opts),
};

// ── Domain types ──────────────────────────────────────────────────────────────

export interface Agent {
  id: string; name: string; role: string; goal?: string; avatar?: string | null;
  mode: 'sandbox' | 'production'; costTier: 'fast' | 'smart' | 'auto'; createdAt: string;
}
export interface AgentRun {
  id: string; agentId: string; status: string; input?: unknown; output?: unknown;
  costUsd?: string; tokensIn?: number; tokensOut?: number; startedAt?: string; finishedAt?: string; createdAt: string;
}
export interface Workflow {
  id: string; name: string; slug?: string; status: string;
  graph: { nodes: unknown[]; edges: unknown[] }; createdAt: string;
}
export interface KnowledgeBase { id: string; name: string; description?: string; embeddingModel: string; createdAt: string; }
export interface Document { id: string; knowledgeBaseId: string; sourceType: string; sourceRef?: string; title?: string; status: string; createdAt: string; }
export interface ContentItem {
  id: string; type: string; title?: string; body?: string;
  status: string; scheduledFor?: string; publishedAt?: string; createdAt: string;
}
export interface InboxMessage {
  id: string; platform: string; kind: string; author: unknown;
  text: string; sentiment?: unknown; isLead: boolean; status: string; createdAt: string;
}
export interface Connector { id: string; type: string; name: string; status: string; createdAt: string; }
export interface Template {
  id: string; kind: string; title: string; slug: string;
  description?: string; priceCents: number; installCount: number; ratingAvg?: string; status: string;
}
export interface Subscription { plan: string; seats: number; status: string; currentPeriodEnd?: string; balanceCredits?: number; }
export interface Member { id: string; userId: string; role: string; user?: { name: string; email: string }; createdAt: string; }
export interface Workspace { id: string; organizationId: string; name: string; slug: string; createdAt: string; }

// ── Domain helpers ────────────────────────────────────────────────────────────

export interface AgentTrigger { id: string; type: string; config?: Record<string, unknown> | null; enabled: boolean; }

export const agentsApi = {
  list:           () => api.get<{ items: Agent[]; nextCursor: string | null }>('/v1/agents'),
  get:            (id: string) => api.get<Agent>(`/v1/agents/${id}`),
  create:         (input: {
                    name: string; role: string; goal?: string;
                    systemPrompt?: string; defaultModel?: string;
                    costTier?: string; mode?: string;
                    guardrails?: { piiMask?: boolean; promptInjectionScan?: boolean; maxCostUsdPerRun?: number };
                  }) =>
                    api.post<Agent>('/v1/agents', input),
  hire:           (input: { name: string; role: string; goal?: string; systemPrompt?: string; costTier?: string; avatar?: string; isRouter?: boolean; routingKeywords?: string[] }) =>
                    api.post<Agent>('/v1/agents/hire', input),
  update:         (id: string, input: Partial<Agent>) => api.patch<Agent>(`/v1/agents/${id}`, input),
  remove:         (id: string) => api.delete<void>(`/v1/agents/${id}`),
  run:            (id: string, input?: unknown) => api.post<{ runId: string }>(`/v1/agents/${id}/runs`, { input }),
  listVersions:   (id: string) => api.get<{ items: unknown[] }>(`/v1/agents/${id}/versions`),
  getKnowledge:   (id: string) => api.get<{ knowledgeBaseIds: string[] }>(`/v1/agents/${id}/knowledge`),
  setKnowledge:   (id: string, knowledgeBaseIds: string[]) =>
                    api.patch<{ knowledgeBaseIds: string[] }>(`/v1/agents/${id}/knowledge`, { knowledgeBaseIds }),
  getConnectors:  (id: string) => api.get<{ connectorIds: string[] }>(`/v1/agents/${id}/connectors`),
  setConnectors:  (id: string, connectorIds: string[]) =>
                    api.patch<{ connectorIds: string[] }>(`/v1/agents/${id}/connectors`, { connectorIds }),
  listTriggers:   (id: string) => api.get<{ items: AgentTrigger[]; nextCursor: string | null }>(`/v1/agents/${id}/triggers`),
  createTrigger:  (id: string, input: { type: string; config?: Record<string, unknown>; enabled?: boolean }) =>
                    api.post<AgentTrigger>(`/v1/agents/${id}/triggers`, input),
  updateTrigger:  (id: string, triggerId: string, input: { config?: Record<string, unknown>; enabled?: boolean }) =>
                    api.patch<AgentTrigger>(`/v1/agents/${id}/triggers/${triggerId}`, input),
  deleteTrigger:  (id: string, triggerId: string) => api.delete<void>(`/v1/agents/${id}/triggers/${triggerId}`),
};

export interface RunStep {
  id: string; index: number; type: string; name: string;
  status: string; model?: string | null; tokensIn?: number | null; tokensOut?: number | null;
  costUsd?: string | null; output?: unknown; error?: unknown;
  startedAt?: string | null; finishedAt?: string | null;
}
export interface RunWithSteps extends AgentRun {
  agentVersionId?: string; triggerType?: string; failureReason?: string | null; steps: RunStep[];
}
export interface Approval {
  id: string; runId: string; kind: string; status: string;
  payload?: { toolName?: string; arguments?: string | null } | null;
  expiresAt?: string | null; createdAt: string;
}

export const runsApi = {
  list:           () => api.get<{ items: AgentRun[]; nextCursor: string | null }>('/v1/runs'),
  get:            (id: string) => api.get<RunWithSteps>(`/v1/runs/${id}`),
  pause:          (id: string) => api.post<void>(`/v1/runs/${id}/pause`),
  resume:         (id: string) => api.post<void>(`/v1/runs/${id}/resume`),
  cancel:         (id: string) => api.post<void>(`/v1/runs/${id}/cancel`),
  replay:         (id: string) => api.post<{ runId: string }>(`/v1/runs/${id}/replay`),
  listApprovals:  () => api.get<{ items: Approval[]; nextCursor: string | null }>('/v1/approvals'),
  decide:         (id: string, decision: 'approved' | 'rejected', reason?: string) =>
                    api.post<{ ok: boolean; runId?: string; emitted?: boolean }>(`/v1/approvals/${id}/decide`, { decision, reason }),
};

// ── Employee controls (GET/PATCH /v1/agents/:id/controls) ───────────────────
export interface EmployeeControls {
  agentId: string;
  activationState: 'active' | 'paused' | 'deactivated';
  approvalMode: 'always' | 'risky' | 'never';
  bypassPermission: boolean;
  planMode: boolean;
  maxRunsPerDay: number | null;
  dailyCostCapUsd: number | null;
}
export const controlsApi = {
  get:        (agentId: string) => api.get<EmployeeControls>(`/v1/agents/${agentId}/controls`),
  update:     (agentId: string, patch: Partial<EmployeeControls>) => api.patch<EmployeeControls>(`/v1/agents/${agentId}/controls`, patch),
  activate:   (agentId: string) => api.post<EmployeeControls>(`/v1/agents/${agentId}/controls/activate`),
  deactivate: (agentId: string) => api.post<EmployeeControls>(`/v1/agents/${agentId}/controls/deactivate`),
};

// ── AI Controller (natural-language command bus) ────────────────────────────
export interface ControllerPlannedAction {
  name: string;
  args: Record<string, unknown>;
  target: 'browser' | 'server' | 'both';
  riskClass: 'safe' | 'confirm' | 'destructive';
  status: 'executed' | 'ready' | 'acknowledged' | 'invalid';
  result?: unknown;
  note?: string;
  error?: string;
}
export interface ControllerClientAction { to: string; label: string; }
export interface ControllerResult {
  sessionId: string;
  command: string;
  summary: string;
  actions: ControllerPlannedAction[];
  clientActions: ControllerClientAction[];
}
export const controllerApi = {
  start:   () => api.post<{ sessionId: string }>('/v1/controller/sessions', {}),
  command: (sessionId: string, command: string) =>
             api.post<ControllerResult>(`/v1/controller/sessions/${sessionId}/command`, { command }),
};

// ── Orchestration (hierarchy + routing) ─────────────────────────────────────
export interface AgentRelationship { id: string; fromAgentId: string; toAgentId: string; kind: 'supervises' | 'watches' | 'delegates_to'; }
export interface RoutingDecision {
  id: string; requestText: string; proposedAgentId: string | null; chosenAgentId: string | null;
  confidence: string | null; status: string; reasoning: string | null; runId: string | null;
  autoDispatched?: boolean;
}
export const orchestrationApi = {
  listRelationships:  () => api.get<{ items: AgentRelationship[] }>('/v1/agent-relationships'),
  createRelationship: (b: { fromAgentId: string; toAgentId: string; kind: AgentRelationship['kind'] }) => api.post<AgentRelationship>('/v1/agent-relationships', b),
  removeRelationship: (id: string) => api.delete<void>(`/v1/agent-relationships/${id}`),
  route:              (request: string) => api.post<RoutingDecision>('/v1/orchestration/route', { request }),
  listDecisions:      () => api.get<{ items: RoutingDecision[] }>('/v1/orchestration/decisions'),
  confirm:            (id: string, divertToAgentId?: string) => api.post<{ runId?: string }>(`/v1/orchestration/decisions/${id}/confirm`, divertToAgentId ? { divertToAgentId } : {}),
};

// ── Company chat (conversations + inter-agent bus) ──────────────────────────
export interface Conversation { id: string; subject: string | null; status: string; createdAt: string; updatedAt: string; }
export interface TimelineItem {
  kind: 'turn' | 'bus';
  at: string;
  data: {
    id: string; body?: string | null; authorType?: string; authorId?: string | null;
    fromAgentId?: string | null; toAgentId?: string | null; runId?: string | null;
    kind?: string; metadata?: unknown; createdAt: string;
  };
}
export const companyApi = {
  listConversations: () => api.get<{ items: Conversation[] }>('/v1/conversations'),
  createConversation: (subject?: string) => api.post<Conversation>('/v1/conversations', subject ? { subject } : {}),
  messages: (id: string) => api.get<{ items: TimelineItem[] }>(`/v1/conversations/${id}/messages`),
  postMessage: (id: string, body: string) => api.post(`/v1/conversations/${id}/messages`, { body }),
  handoffs: () => api.get<{ items: unknown[] }>('/v1/agent-handoffs'),
};

// ── Contact (public marketing form) ─────────────────────────────────────────
export const contactApi = {
  submit: (input: { name: string; email: string; message: string; company?: string }) =>
    api.post<{ received: boolean }>('/v1/contact', input),
};

// ── Onboarding ───────────────────────────────────────────────────────────────
export interface OnboardingState {
  completedSteps: string[];
  currentStep: string | null;
  completedAt: string | null;
  steps: Array<{ step: string; done: boolean; required: boolean }>;
}
export const onboardingApi = {
  get: () => api.get<OnboardingState>('/v1/onboarding'),
  advance: (step: string) => api.post<OnboardingState>('/v1/onboarding/advance', { step }),
};

// ── System health (GET /v1/system-health) ───────────────────────────────────
export interface HealthProbe { name: string; status: 'ok' | 'degraded' | 'down'; latencyMs?: number; detail?: string; error?: string; }
export interface SystemHealth { status: 'ok' | 'degraded' | 'down'; checkedAt: string; probes: HealthProbe[]; }
export const systemHealthApi = {
  get: (deep = false) => api.get<SystemHealth>(`/v1/system-health${deep ? '?deep=1' : ''}`),
};

export const workflowsApi = {
  list:           () => api.get<{ items: Workflow[]; nextCursor: string | null }>('/v1/workflows'),
  get:            (id: string) => api.get<Workflow>(`/v1/workflows/${id}`),
  create:         (input: { name: string; slug?: string; graph?: unknown }) => api.post<Workflow>('/v1/workflows', input),
  update:         (id: string, input: Partial<Workflow>) => api.patch<Workflow>(`/v1/workflows/${id}`, input),
  run:            (id: string, input?: unknown) => api.post<{ workflowRunId: string }>(`/v1/workflows/${id}/run`, { input }),
  listRuns:       () => api.get<{ items: unknown[] }>('/v1/workflows/runs'),
};

export const inboxApi = {
  list:           (params?: { status?: string; platform?: string }) =>
                    api.get<{ items: InboxMessage[]; nextCursor: string | null }>('/v1/inbox' + (params ? `?${new URLSearchParams(params as Record<string, string>)}` : '')),
  reply:          (id: string, draft: string, sendImmediately = false) =>
                    api.post<void>(`/v1/inbox/${id}/reply`, { draft, sendImmediately }),
  draftAll:       () => api.post<{ runId: string }>('/v1/inbox/draft-all'),
};

export const knowledgeApi = {
  list:           () => api.get<{ items: KnowledgeBase[]; nextCursor: string | null }>('/v1/knowledge-bases'),
  create:         (input: { name: string; description?: string }) => api.post<KnowledgeBase>('/v1/knowledge-bases', input),
  listDocuments:  (id: string) => api.get<{ items: Document[] }>(`/v1/knowledge-bases/${id}/documents`),
  addDocument:    (id: string, input: { sourceType: string; sourceRef?: string; title?: string; content?: string }) =>
                    api.post<Document>(`/v1/knowledge-bases/${id}/documents`, input),
  addUrl:         (id: string, url: string, depth?: number) =>
                    api.post<Document>(`/v1/knowledge-bases/${id}/urls`, { url, depth }),
  reindex:        (docId: string) => api.post<{ queued: boolean }>(`/v1/documents/${docId}/reindex`),
};

export const contentApi = {
  list:           () => api.get<{ items: ContentItem[]; nextCursor: string | null }>('/v1/content-items'),
  create:         (input: { type?: string; title?: string; body?: string }) => api.post<ContentItem>('/v1/content-items', input),
  update:         (id: string, input: Partial<ContentItem>) => api.patch<ContentItem>(`/v1/content-items/${id}`, input),
  approve:        (id: string) => api.post<void>(`/v1/content-items/${id}/approve`),
  generateWeek:   () => api.post<{ runId: string }>('/v1/content/generate-week'),
  listBrandVoices: () => api.get<{ items: unknown[] }>('/v1/brand-voices'),
  createBrandVoice: (input: { name: string; samplePosts?: string[] }) => api.post('/v1/brand-voices', input),
};

export const connectorsApi = {
  list:           () => api.get<{ items: Connector[]; nextCursor: string | null }>('/v1/connectors'),
  oauthStart:     (type: string) => api.post<{ authUrl?: string; authorizationUrl?: string; connected?: boolean; configured?: boolean; noConfig?: boolean }>(`/v1/connectors/${type}/oauth/start`),
  update:         (id: string, input: unknown) => api.patch<Connector>(`/v1/connectors/${id}`, input),
  remove:         (id: string) => api.delete<void>(`/v1/connectors/${id}`),
};

export const marketplaceApi = {
  list:           (params?: { kind?: string; visibility?: string }) =>
                    api.get<{ items: Template[]; nextCursor: string | null }>('/v1/templates' + (params ? `?${new URLSearchParams(params as Record<string, string>)}` : '')),
  create:         (input: { kind: string; title: string; description?: string; sourceId: string }) =>
                    api.post<Template>('/v1/templates', input),
  install:        (id: string) => api.post<{ resourceId: string }>(`/v1/templates/${id}/install`),
  rate:           (id: string, stars: number, comment?: string) =>
                    api.post<void>(`/v1/templates/${id}/ratings`, { stars, comment }),
};

export const billingApi = {
  subscription:   () => api.get<Subscription>('/v1/billing/subscription'),
  checkout:       (plan: string) => api.post<{ url: string }>('/v1/billing/checkout', { plan }),
  portal:         () => api.post<{ url: string }>('/v1/billing/portal'),
};

export const membersApi = {
  list:            () => api.get<{ items: Member[] }>('/v1/members'),
  listInvitations: () => api.get<{ items: Invitation[] }>('/v1/invitations'),
  invite:          (email: string, role: string) => api.post('/v1/invitations', { email, role }),
  acceptInvite:    (token: string) => api.post(`/v1/invitations/${token}/accept`),
  updateRole:      (id: string, role: string) => api.patch(`/v1/members/${id}/role`, { role }),
  remove:          (id: string) => api.delete<void>(`/v1/members/${id}`),
};

// ── Session (GET /v1/me) ────────────────────────────────────────────────────
export type Role = 'owner' | 'admin' | 'member' | 'viewer';
export interface MeWorkspace {
  id: string; name: string; slug: string;
  organizationId: string; organizationName: string; role: Role;
}
export interface Me {
  user: { id: string; email: string | null; name: string | null } | null;
  org: { id: string; name: string; slug: string | null; branding?: { brandName?: string; logo?: string } | null } | null;
  workspace: { id: string; name: string; slug: string } | null;
  role: Role | null;
  workspaces: MeWorkspace[];
}
export interface Invitation {
  id: string; email: string; role: Role;
  expiresAt: string; acceptedAt: string | null; createdAt: string;
}

export const meApi = {
  get: (workspaceId?: string) => api.get<Me>('/v1/me', workspaceId ? { workspaceId } : undefined),
};

export const workspacesApi = {
  list:           () => api.get<{ items: Workspace[] }>('/v1/workspaces'),
  create:         (input: { name: string; slug?: string }) => api.post<Workspace>('/v1/workspaces', input),
  update:         (id: string, input: Partial<Workspace>) => api.patch<Workspace>(`/v1/workspaces/${id}`, input),
};

export const analyticsApi = {
  runs:           () => api.get<{ items: unknown[] }>('/v1/runs?limit=100'),
  usage:          () => api.get<Subscription>('/v1/billing/subscription'),
};

export const adminApi = {
  getSettings:    () => api.get<{ settings: unknown[] }>('/v1/admin/settings'),
  updateSetting:  (key: string, value: unknown) => api.patch('/v1/admin/settings', { key, value }),
  killSwitch:     (active: boolean, reason?: string) => api.post('/v1/admin/kill-switch', { active, reason }),
  instance:       () => api.get('/v1/admin/instance'),
};

export const orgsApi = {
  list:           () => api.get<{ items: unknown[] }>('/v1/orgs'),
  get:            (id: string) => api.get<unknown>(`/v1/orgs/${id}`),
  update:         (id: string, input: unknown) => api.patch(`/v1/orgs/${id}`, input),
};
