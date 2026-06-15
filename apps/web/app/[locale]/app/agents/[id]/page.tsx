'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useRef, useEffect, useId, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Play, Settings, Loader2, Send as SendIcon, Bot, User, Sparkles, Users, ChevronDown } from 'lucide-react';
import {
  agentsApi, runsApi, knowledgeApi, connectorsApi, ApiError, type Agent, type AgentRun, type RunWithSteps, type KnowledgeBase, type Connector, type AgentTrigger,
} from '../../../../../src/lib/api-client';
import { ControlPanel } from '../../../../../src/components/employee/control-panel';
import { OrgGraph } from '../../../../../src/components/employee/org-graph';
import { toast } from 'sonner';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const DONE = ['completed', 'succeeded', 'success'];
const FAILED = ['failed', 'error', 'cancelled', 'canceled'];

function renderOutput(output: unknown): string {
  if (output == null) return '';
  if (typeof output === 'string') return output;
  if (typeof output === 'object') {
    const o = output as Record<string, unknown>;
    for (const k of ['text', 'message', 'content', 'output', 'result', 'response', 'answer', 'reply']) {
      if (typeof o[k] === 'string') return o[k] as string;
    }
    try { return JSON.stringify(output, null, 2); } catch { return String(output); }
  }
  return String(output);
}

// Lightweight, dependency-free markdown renderer for chat bubbles. Handles the
// subset agents actually emit: headings, bold, inline code, links, bullet/ordered
// lists, and fenced code blocks. (Avoids a fragile react-markdown install.)
function mdInline(text: string): ReactNode {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) {
      out.push(<strong key={k++} className="font-semibold">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('`')) {
      out.push(<code key={k++} className="bg-black/10 dark:bg-white/15 rounded px-1 py-0.5 text-[0.85em]">{tok.slice(1, -1)}</code>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      if (link) out.push(<a key={k++} href={link[2]} target="_blank" rel="noreferrer" className="text-primary underline">{link[1]}</a>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let listActive = false;
  let codeLines: string[] | null = null;
  const flushList = (key: string) => {
    if (!listActive) return;
    const items = listItems.map((t, i) => <li key={i}>{mdInline(t)}</li>);
    blocks.push(
      listOrdered
        ? <ol key={key} className="list-decimal pl-5 mb-2 space-y-0.5">{items}</ol>
        : <ul key={key} className="list-disc pl-5 mb-2 space-y-0.5">{items}</ul>,
    );
    listItems = [];
    listActive = false;
  };
  lines.forEach((line, i) => {
    if (line.trim().startsWith('```')) {
      if (codeLines) {
        blocks.push(<pre key={`c${i}`} className="bg-black/10 dark:bg-white/10 rounded-lg p-3 overflow-x-auto text-xs my-2"><code>{codeLines.join('\n')}</code></pre>);
        codeLines = null;
      } else {
        flushList(`l${i}`);
        codeLines = [];
      }
      return;
    }
    if (codeLines) { codeLines.push(line); return; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flushList(`l${i}`);
      const lvl = (h[1] ?? '').length;
      blocks.push(<p key={`h${i}`} className={lvl <= 2 ? 'text-base font-semibold mt-2 mb-1' : 'font-semibold mt-2 mb-1'}>{mdInline(h[2] ?? '')}</p>);
      return;
    }
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (ul) {
      if (listActive && listOrdered) flushList(`l${i}`);
      listActive = true; listOrdered = false; listItems.push(ul[1] ?? '');
      return;
    }
    if (ol) {
      if (listActive && !listOrdered) flushList(`l${i}`);
      listActive = true; listOrdered = true; listItems.push(ol[1] ?? '');
      return;
    }
    flushList(`l${i}`);
    if (line.trim() !== '') blocks.push(<p key={`p${i}`} className="mb-2 last:mb-0">{mdInline(line)}</p>);
  });
  flushList('lend');
  if (codeLines) blocks.push(<pre key="cend" className="bg-black/10 dark:bg-white/10 rounded-lg p-3 overflow-x-auto text-xs my-2"><code>{(codeLines as string[]).join('\n')}</code></pre>);
  return <>{blocks}</>;
}

/** Inter-agent collaboration card: collapsed by default; expands to reveal the
 *  full conversation between the two employees, with a live "consulting" state. */
function CollabCard({ data }: { data: CollabData }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const consulting = data.status === 'consulting';
  const error = data.status === 'error';
  const colInitial = data.colleagueAvatar || data.colleagueName.charAt(0).toUpperCase();
  return (
    <div className="collab-card flex gap-2.5 justify-start" role="group"
      aria-label={`${data.colleagueName} replied, brought in by ${data.primaryName}`}>
      {/* Colleague avatar — rendered like any normal agent reply. */}
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 text-white text-xs font-semibold">
        {colInitial}
      </div>
      <div className="max-w-[80%] flex-1 min-w-0">
        {/* Collaboration line on top + a dropdown that reveals the internal conversation. */}
        <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mb-1 ml-1">
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground min-w-0">
            <Sparkles className="w-3 h-3 text-primary shrink-0" />
            <span className="font-medium text-foreground">{data.colleagueName}</span>
            <span className="truncate">· {data.colleagueRole}</span>
            <span className="text-muted-foreground/80">· brought in by {data.primaryName}</span>
          </span>
          {!consulting && !error && (
            <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={panelId}
              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline shrink-0">
              <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
              {open ? 'Hide conversation' : 'View conversation'}
            </button>
          )}
        </div>

        {/* Dropdown: how the two employees talked to each other. */}
        {!consulting && !error && (
          <div id={panelId} aria-hidden={!open}
            className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100 mb-2' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden min-h-0">
              <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-2.5 space-y-1.5 text-xs">
                <div className="text-foreground/90">
                  <span className="font-semibold">{data.primaryName} → {data.colleagueName}:</span> {data.question}
                  <span className="text-muted-foreground italic"> — this is your area, can you take it?</span>
                </div>
                <div className="text-muted-foreground">
                  <span className="font-semibold text-foreground/80">{data.colleagueName}</span> replied with the answer below.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* The colleague's reply — a normal chat bubble. */}
        <div aria-live="polite" className={`rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed ${
          error ? 'bg-destructive/10 text-destructive border border-destructive/20 whitespace-pre-wrap' : 'bg-muted'
        } ${consulting ? 'collab-consulting' : ''}`}>
          {consulting ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              {data.colleagueName} is responding
              <span className="flex gap-1" aria-hidden="true">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </span>
          ) : error ? (
            data.answer
          ) : (
            <Markdown text={data.answer} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Knowledge tab: attach workspace knowledge bases to this employee. */
function KnowledgeTab({ agentId }: { agentId: string }) {
  const qc = useQueryClient();
  const kbsQ = useQuery({ queryKey: ['knowledge-bases'], queryFn: () => knowledgeApi.list() });
  const attachedQ = useQuery({ queryKey: ['agent-knowledge', agentId], queryFn: () => agentsApi.getKnowledge(agentId) });
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (attachedQ.data && !dirty) setSel(new Set(attachedQ.data.knowledgeBaseIds));
  }, [attachedQ.data, dirty]);
  const saveMut = useMutation({
    mutationFn: () => agentsApi.setKnowledge(agentId, [...sel]),
    onSuccess: () => { toast.success('Knowledge updated'); setDirty(false); qc.invalidateQueries({ queryKey: ['agent-knowledge', agentId] }); },
    onError: () => toast.error('Could not update knowledge'),
  });
  const kbs = (kbsQ.data?.items ?? []) as KnowledgeBase[];
  function toggle(kbId: string) {
    setDirty(true);
    setSel((s) => { const n = new Set(s); if (n.has(kbId)) n.delete(kbId); else n.add(kbId); return n; });
  }

  if (kbsQ.isLoading) {
    return <div className="border border-border rounded-xl p-8"><div className="h-24 bg-muted rounded-lg animate-pulse" /></div>;
  }
  if (kbs.length === 0) {
    return (
      <div className="border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
        No knowledge bases yet. <Link href="/app/knowledge" className="text-primary hover:underline">Create one →</Link> then attach it here so this employee can search and cite it.
      </div>
    );
  }
  return (
    <div className="border border-border rounded-xl p-5 space-y-3">
      <p className="text-sm text-muted-foreground">Attach knowledge bases so this employee searches and cites your documents when answering.</p>
      <div className="space-y-2">
        {kbs.map((kb) => (
          <label key={kb.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
            <input type="checkbox" checked={sel.has(kb.id)} onChange={() => toggle(kb.id)} className="w-4 h-4" />
            <span className="flex-1">
              <span className="text-sm font-medium">{kb.name}</span>
              {kb.description && <span className="block text-xs text-muted-foreground line-clamp-1">{kb.description}</span>}
            </span>
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <button onClick={() => saveMut.mutate()} disabled={!dirty || saveMut.isPending}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
          {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save
        </button>
      </div>
    </div>
  );
}

/** Connectors tab: choose which connected tools this employee may use. */
function ConnectorsTab({ agentId }: { agentId: string }) {
  const qc = useQueryClient();
  const connsQ = useQuery({ queryKey: ['connectors'], queryFn: () => connectorsApi.list() });
  const attachedQ = useQuery({ queryKey: ['agent-connectors', agentId], queryFn: () => agentsApi.getConnectors(agentId) });
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (attachedQ.data && !dirty) setSel(new Set(attachedQ.data.connectorIds));
  }, [attachedQ.data, dirty]);
  const saveMut = useMutation({
    mutationFn: () => agentsApi.setConnectors(agentId, [...sel]),
    onSuccess: () => { toast.success('Connectors updated'); setDirty(false); qc.invalidateQueries({ queryKey: ['agent-connectors', agentId] }); },
    onError: () => toast.error('Could not update connectors'),
  });
  const conns = (connsQ.data?.items ?? []) as Connector[];
  function toggle(connId: string) {
    setDirty(true);
    setSel((s) => { const n = new Set(s); if (n.has(connId)) n.delete(connId); else n.add(connId); return n; });
  }

  if (connsQ.isLoading) {
    return <div className="border border-border rounded-xl p-8"><div className="h-24 bg-muted rounded-lg animate-pulse" /></div>;
  }
  if (conns.length === 0) {
    return (
      <div className="border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
        No connected tools yet. <Link href="/app/connectors" className="text-primary hover:underline">Connect a tool →</Link> (built-in ones need no setup), then assign it here so this employee can use it.
      </div>
    );
  }
  return (
    <div className="border border-border rounded-xl p-5 space-y-3">
      <p className="text-sm text-muted-foreground">Choose which connected tools this employee may use.</p>
      <div className="space-y-2">
        {conns.map((c) => (
          <label key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
            <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="w-4 h-4" />
            <span className="flex-1">
              <span className="text-sm font-medium">{c.name}</span>
              <span className="block text-xs text-muted-foreground capitalize">{c.type} · {c.status}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <button onClick={() => saveMut.mutate()} disabled={!dirty || saveMut.isPending}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
          {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save
        </button>
      </div>
    </div>
  );
}

/** Teams tab: assign this employee a Microsoft Teams email so people can talk to
 *  it through Teams. Stored as a `webhook` trigger with config {channel:'teams'}. */
function TeamsAssignment({ agentId }: { agentId: string }) {
  const qc = useQueryClient();
  const triggersQ = useQuery({ queryKey: ['agent-triggers', agentId], queryFn: () => agentsApi.listTriggers(agentId) });
  const existing = ((triggersQ.data?.items ?? []) as AgentTrigger[]).find(
    (t) => t.type === 'webhook' && (t.config as Record<string, unknown> | null)?.['channel'] === 'teams',
  );
  const [email, setEmail] = useState('');
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setEmail(((existing?.config as Record<string, unknown> | null)?.['teamsEmail'] as string) ?? '');
  }, [existing, dirty]);

  const save = useMutation({
    mutationFn: () => {
      const config = { channel: 'teams', teamsEmail: email.trim() };
      return existing
        ? agentsApi.updateTrigger(agentId, existing.id, { config })
        : agentsApi.createTrigger(agentId, { type: 'webhook', config });
    },
    onSuccess: () => { toast.success('Microsoft Teams identity saved'); setDirty(false); qc.invalidateQueries({ queryKey: ['agent-triggers', agentId] }); },
    onError: (e: Error) => toast.error(e.message || 'Could not save Teams identity'),
  });
  const remove = useMutation({
    mutationFn: () => (existing ? agentsApi.deleteTrigger(agentId, existing.id) : Promise.resolve()),
    onSuccess: () => { toast.success('Disconnected from Teams'); setEmail(''); setDirty(false); qc.invalidateQueries({ queryKey: ['agent-triggers', agentId] }); },
    onError: (e: Error) => toast.error(e.message || 'Could not remove'),
  });

  return (
    <div className="border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Microsoft Teams</h3>
        {existing && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Assigned</span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Assign this employee a Microsoft Teams email so your team can message it directly in Teams. Replies are sent back through Teams — and held for your approval first, unless this employee’s approval mode is set to “never”.
      </p>
      <div className="flex gap-2">
        <input
          value={email}
          onChange={(e) => { setDirty(true); setEmail(e.target.value); }}
          placeholder="employee@yourcompany.onmicrosoft.com"
          className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors placeholder:text-muted-foreground"
        />
        <button onClick={() => save.mutate()} disabled={!email.trim() || save.isPending}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0">
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save
        </button>
        {existing && (
          <button onClick={() => remove.mutate()} disabled={remove.isPending}
            className="border border-border px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors shrink-0">
            Remove
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Inbound Teams messages reach this employee via <code className="bg-black/10 dark:bg-white/15 rounded px-1 py-0.5">/hooks/teams</code> — point a Microsoft Graph change-notification subscription at that URL. Requires a connected Teams connector.
      </p>
    </div>
  );
}

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

type CollabData = {
  primaryName: string;
  primaryAvatar?: string | null;
  colleagueName: string;
  colleagueRole: string;
  colleagueAvatar?: string | null;
  question: string;
  answer: string;
  status: 'consulting' | 'done' | 'error';
};
type ChatMsg = { role: 'user' | 'agent' | 'error' | 'collab'; text: string; at: string; id?: string; from?: { name: string; avatar?: string | null }; collab?: CollabData };
type Tab = 'Playground' | 'Configuration' | 'Run history' | 'Knowledge' | 'Connectors';

// Map an employee's domain to the everyday words a user might use when a question
// really belongs to that domain — powers the "bring in a colleague" suggestion.
// Domain knowledge for routing a question to the right teammate. `role` terms
// identify which domain a colleague OWNS (matched against their role + goal);
// `q` terms are the everyday words a user uses when a question is in that domain
// (matched as WHOLE words against the question — never substrings; plurals listed
// explicitly so "leaves" matches but "leadership" never matches "lead").
const DOMAINS: Record<string, { role: string[]; q: string[] }> = {
  finance:     { role: ['finance', 'financial', 'account', 'bookkeep', 'controller', 'treasur'], q: ['finance', 'financial', 'budget', 'budgets', 'invoice', 'invoices', 'expense', 'expenses', 'revenue', 'payment', 'payments', 'payroll', 'tax', 'taxes', 'refund', 'refunds', 'pricing', 'accounting', 'reimbursement'] },
  hr:          { role: ['hr', 'human resource', 'people', 'talent', 'recruit'], q: ['hr', 'hire', 'hiring', 'recruit', 'recruiting', 'leave', 'leaves', 'pto', 'vacation', 'holiday', 'holidays', 'onboarding', 'payroll', 'benefits', 'headcount', 'employee', 'employees', 'attendance'] },
  marketing:   { role: ['marketing', 'content', 'brand', 'growth', 'seo', 'social'], q: ['marketing', 'campaign', 'campaigns', 'content', 'social', 'brand', 'branding', 'seo', 'audience', 'newsletter', 'copywriting'] },
  sales:       { role: ['sales', 'account executive', 'business development'], q: ['sales', 'lead', 'leads', 'deal', 'deals', 'pipeline', 'prospect', 'prospects', 'quota', 'crm', 'quote', 'upsell'] },
  support:     { role: ['support', 'customer success', 'customer service', 'help desk', 'helpdesk', 'success'], q: ['support', 'ticket', 'tickets', 'complaint', 'complaints', 'refund', 'refunds', 'escalation', 'escalate', 'customer', 'customers', 'cancel', 'cancellation', 'return', 'returns'] },
  legal:       { role: ['legal', 'counsel', 'compliance', 'privacy'], q: ['legal', 'contract', 'contracts', 'compliance', 'policy', 'policies', 'terms', 'gdpr', 'privacy', 'liability', 'nda'] },
  product:     { role: ['product', 'design', 'ux'], q: ['product', 'feature', 'features', 'roadmap', 'design', 'spec', 'specs', 'backlog', 'prototype'] },
  engineering: { role: ['engineer', 'engineering', 'developer', 'devops', 'technical', 'infra'], q: ['engineering', 'deploy', 'deployment', 'bug', 'bugs', 'api', 'infra', 'infrastructure', 'database', 'latency'] },
  operations:  { role: ['operations', 'ops', 'logistics', 'procurement', 'supply'], q: ['operations', 'process', 'processes', 'logistics', 'vendor', 'vendors', 'procurement', 'supply', 'inventory', 'shipping'] },
};

function tokenize(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}

/** Score how well a question fits a colleague's domain — whole-word matching only. */
function scoreColleague(question: string, a: { role: string; goal?: string | null }): number {
  const tokens = tokenize(question);
  const roleText = `${a.role} ${a.goal ?? ''}`.toLowerCase();
  let score = 0;
  for (const d of Object.values(DOMAINS)) {
    if (!d.role.some((t) => roleText.includes(t))) continue; // colleague does not own this domain
    for (const term of d.q) if (tokens.has(term)) score += 1;
  }
  return score;
}

/** Pick a colleague to AUTO-consult: a confident, unambiguous, clearly better fit. */
function pickColleague(
  question: string,
  current: { role: string; goal?: string | null } | undefined,
  others: Agent[],
): Agent | null {
  if (!question || others.length === 0) return null;
  const ranked = others
    .map((a) => ({ a, score: scoreColleague(question, a) }))
    .filter((r) => r.score > 0)
    .sort((x, y) => y.score - x.score);
  if (ranked.length === 0) return null;
  const best = ranked[0]!;
  const second = ranked[1];
  // Unknown current employee → never auto-route (decide only with full information).
  const currentScore = current ? scoreColleague(question, current) : Infinity;
  if (best.score < 2) return null;                                               // need a clear domain signal
  if (best.score < currentScore + 2) return null;                               // current employee is a comparable fit
  if (second && second.score >= 2 && best.score - second.score < 2) return null; // ambiguous across domains
  return best.a;
}

/** Pick the best SUGGESTED colleague for the manual chip (looser than auto). */
function suggestColleague(question: string, others: Agent[]): Agent | null {
  if (!question) return null;
  let best: { a: Agent; score: number } | null = null;
  for (const a of others) {
    const sc = scoreColleague(question, a);
    if (sc > 0 && (!best || sc > best.score)) best = { a, score: sc };
  }
  return best?.a ?? null;
}

// (collapsed-preview helper removed — colleague replies now render in full as a normal bubble)

const SUGGESTIONS = [
  'What can you help me with?',
  'Give me a quick status summary.',
  'Introduce yourself in two sentences.',
];

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('Playground');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const aliveRef = useRef(true);
  const msgSeq = useRef(0);
  const autoCount = useRef(0);
  const lastAutoId = useRef<string | null>(null);
  useEffect(() => () => { aliveRef.current = false; }, []);
  // Scroll the messages CONTAINER (not the page) so sending never jumps the page.
  useEffect(() => { const c = containerRef.current; if (c) c.scrollTop = c.scrollHeight; }, [messages, running]);

  const agentQ = useQuery({ queryKey: ['agent', id], queryFn: () => agentsApi.get(id) });
  const agent = agentQ.data;
  const runsQ = useQuery({
    queryKey: ['agent-runs', id],
    queryFn: () => runsApi.list(),
    enabled: tab === 'Run history',
  });
  const agentRuns = ((runsQ.data?.items ?? []) as AgentRun[]).filter((r) => r.agentId === id);
  const initial = (agent?.name ?? 'A').charAt(0).toUpperCase();

  // Roster of the user's OTHER employees — so this employee can bring a colleague
  // into the same conversation when a question is outside its lane.
  const rosterQ = useQuery({ queryKey: ['agents'], queryFn: () => agentsApi.list() });
  const others = ((rosterQ.data?.items ?? []) as Agent[]).filter((a) => a.id !== id);
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.text ?? '';
  const lastIsAnswer = messages.length > 0 && messages[messages.length - 1]?.role === 'agent';
  const suggested = lastIsAnswer && lastUserMsg && others.length > 0
    ? suggestColleague(lastUserMsg, others)
    : null;
  const lastM = messages[messages.length - 1];
  const collabBusy = lastM?.role === 'collab' && lastM.collab?.status === 'consulting';

  /** Run an employee with `text`, poll to completion, and return its answer. */
  async function dispatchTo(agentId: string, text: string): Promise<{ ok: boolean; text: string }> {
    const { runId } = await agentsApi.run(agentId, text);
    let run: RunWithSteps | undefined;
    let lastErr = 0;
    for (let i = 0; i < 80; i++) {
      await wait(1500);
      if (!aliveRef.current) return { ok: false, text: '' };
      try {
        run = await runsApi.get(runId);
      } catch {
        // The row may not be visible for a beat — tolerate a few misses.
        if (++lastErr > 5) throw new Error('lost connection to the run');
        continue;
      }
      const s = (run.status ?? '').toLowerCase();
      if (DONE.includes(s) || FAILED.includes(s)) break;
    }
    const s = (run?.status ?? '').toLowerCase();
    if (run && DONE.includes(s)) return { ok: true, text: renderOutput(run.output) || '(the agent returned no text)' };
    if (run && FAILED.includes(s)) {
      const reason = (run as { failureReason?: string }).failureReason;
      return { ok: false, text: `Run ${run.status}${reason ? `: ${reason}` : ''}` };
    }
    return { ok: false, text: 'Still working — this is taking longer than usual. Check Run history shortly.' };
  }

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || running) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text, at: now(), id: `m-${(msgSeq.current += 1)}` }]);
    setRunning(true);
    try {
      const r = await dispatchTo(id, text);
      if (!aliveRef.current) return;
      setMessages((m) => [...m, { role: r.ok ? 'agent' : 'error', text: r.text, at: now(), id: `m-${(msgSeq.current += 1)}` }]);
      // Auto inter-agent collaboration: when the question clearly belongs to a
      // colleague's domain, bring them in automatically — no clicking needed.
      // Guarded: only when the current employee is known, never the same colleague
      // twice in a row, and capped per conversation to avoid runaway runs.
      if (r.ok && agent) {
        const colleague = pickColleague(text, { role: agent.role, goal: agent.goal ?? null }, others);
        if (colleague && aliveRef.current && colleague.id !== lastAutoId.current && autoCount.current < 6) {
          lastAutoId.current = colleague.id;
          autoCount.current += 1;
          await doCollab(colleague, text);
        }
      }
    } catch (e) {
      if (!aliveRef.current) return;
      setMessages((m) => [...m, { role: 'error', text: e instanceof ApiError ? e.message : 'Could not reach the agent. Please try again.', at: now(), id: `m-${(msgSeq.current += 1)}` }]);
    } finally {
      if (aliveRef.current) setRunning(false);
    }
  }

  /** Append a collaboration card, run the colleague, then fill in their reply. */
  async function doCollab(colleague: Agent, question: string) {
    const cid = `m-${(msgSeq.current += 1)}`;
    setMessages((m) => [...m, {
      role: 'collab', id: cid, text: '', at: now(),
      collab: {
        primaryName: agent?.name ?? 'This employee',
        primaryAvatar: agent?.avatar ?? null,
        colleagueName: colleague.name,
        colleagueRole: colleague.role,
        colleagueAvatar: colleague.avatar ?? null,
        question,
        answer: '',
        status: 'consulting',
      },
    }]);
    const finish = (answer: string, status: 'done' | 'error') =>
      setMessages((m) => m.map((msg) => (msg.id === cid && msg.collab ? { ...msg, collab: { ...msg.collab, answer, status } } : msg)));
    try {
      const prompt = `${question}\n\n(Context: ${agent?.name ?? 'A colleague'}${agent?.role ? ` (${agent.role})` : ''} referred this to you because it is in your area. Answer the user directly and concisely.)`;
      const r = await dispatchTo(colleague.id, prompt);
      if (!aliveRef.current) return;
      finish(r.text, r.ok ? 'done' : 'error');
    } catch (e) {
      if (!aliveRef.current) return;
      finish(e instanceof ApiError ? e.message : `Could not reach ${colleague.name}.`, 'error');
    }
  }

  /** Manually bring a colleague into the SAME chat (same UI as the automatic hand-off). */
  async function consult(colleague: Agent, question: string) {
    if (running || !question) return;
    setRunning(true);
    try { await doCollab(colleague, question); }
    finally { if (aliveRef.current) setRunning(false); }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/app/agents" className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm">
          <ArrowLeft className="w-4 h-4" /> Employees
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{agent?.name ?? 'Agent'}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg font-semibold shrink-0">
            {agent?.avatar || initial}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight leading-tight">{agent?.name ?? 'Agent'}</h1>
            <p className="text-muted-foreground text-sm line-clamp-1 max-w-xl">{agent?.goal || agent?.role || 'Your AI employee'}</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setTab('Configuration')}
            className="flex items-center gap-2 border border-border px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
            <Settings className="w-4 h-4" /> Configure
          </button>
          <button onClick={() => { setTab('Playground'); inputRef.current?.focus(); }}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Play className="w-4 h-4" /> Communicate
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {(['Playground', 'Configuration', 'Run history', 'Knowledge', 'Connectors'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${t === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Playground' && (
        <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
          <div className="bg-muted/40 px-4 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-primary" /> Chat with {agent?.name ?? 'this agent'}</span>
            <span className="text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full capitalize">
              {agent?.mode ?? 'sandbox'} mode
            </span>
          </div>

          <div ref={containerRef} className="h-[26rem] overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !running ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Bot className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Start a conversation</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Ask {agent?.name ?? 'your employee'} anything, or try one of these:</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)}
                      className="text-xs border border-border rounded-full px-3 py-1.5 hover:border-primary/50 hover:bg-primary/5 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((m, i) => {
                  if (m.role === 'collab' && m.collab) {
                    return <CollabCard key={m.id ?? i} data={m.collab} />;
                  }
                  const avatarText = m.role === 'error' ? '!' : (m.from?.avatar || m.from?.name?.charAt(0) || agent?.avatar || initial);
                  return (
                    <div key={m.id ?? i} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {m.role !== 'user' && (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 text-white text-xs font-semibold">
                          {avatarText}
                        </div>
                      )}
                      <div className="max-w-[78%]">
                        {m.role === 'agent' && m.from && (
                          <div className="text-[11px] font-medium text-muted-foreground mb-1 ml-1">{m.from.name}</div>
                        )}
                        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          m.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-md whitespace-pre-wrap'
                            : m.role === 'error' ? 'bg-destructive/10 text-destructive border border-destructive/20 whitespace-pre-wrap'
                              : 'bg-muted rounded-bl-md'
                        }`}>{m.role === 'agent' ? <Markdown text={m.text} /> : m.text}</div>
                        <div className={`text-[10px] text-muted-foreground/70 mt-1 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>{m.at}</div>
                      </div>
                      {m.role === 'user' && (
                        <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  );
                })}
                {running && !collabBusy && (
                  <div className="flex gap-2.5 justify-start">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 text-white text-xs font-semibold">
                      {agent?.avatar || initial}
                    </div>
                    <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {others.length > 0 && messages.length > 0 && (
            <div className="border-t border-border px-3 py-2 flex items-center gap-2 overflow-x-auto">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0"><Users className="w-3.5 h-3.5" /> Ask another teammate:</span>
              {suggested && (
                <button onClick={() => consult(suggested, lastUserMsg)} disabled={running || !lastUserMsg}
                  className="shrink-0 text-xs font-medium rounded-full px-3 py-1.5 bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors disabled:opacity-50">
                  {suggested.name} · {suggested.role}
                </button>
              )}
              {others.filter((a) => a.id !== suggested?.id).slice(0, 4).map((a) => (
                <button key={a.id} onClick={() => consult(a, lastUserMsg)} disabled={running || !lastUserMsg}
                  className="shrink-0 text-xs rounded-full px-3 py-1.5 border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50">
                  {a.name}
                </button>
              ))}
            </div>
          )}
          <div className="border-t border-border p-3 flex items-center gap-2">
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={`Message ${agent?.name ?? 'this agent'}…`} disabled={running}
              className="flex-1 text-sm bg-background border border-border rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors placeholder:text-muted-foreground disabled:opacity-60" />
            <button onClick={() => send()} disabled={running || !input.trim()}
              className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0">
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendIcon className="w-4 h-4" />} Send
            </button>
          </div>
        </div>
      )}

      {tab === 'Configuration' && (
        <div className="border border-border rounded-xl p-5 space-y-3 text-sm">
          {agentQ.isLoading ? (
            <div className="h-24 bg-muted rounded-lg animate-pulse" />
          ) : (
            <>
              <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{agent?.name}</span></div>
              <div><span className="text-muted-foreground">Role:</span> {agent?.role}</div>
              {agent?.goal && <div><span className="text-muted-foreground">Goal:</span> {agent.goal}</div>}
              <div className="flex gap-6">
                <span><span className="text-muted-foreground">Mode:</span> <span className="capitalize">{agent?.mode}</span></span>
                <span><span className="text-muted-foreground">Cost tier:</span> <span className="capitalize">{agent?.costTier}</span></span>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'Configuration' && (
        <div className="mt-4">
          <TeamsAssignment agentId={id} />
        </div>
      )}

      {tab === 'Run history' && (
        <div className="border border-border rounded-xl overflow-hidden">
          {runsQ.isLoading ? (
            <div className="p-5 space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}</div>
          ) : agentRuns.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No runs yet. Send a message in the Playground.</div>
          ) : (
            <div className="divide-y divide-border">
              {agentRuns.slice(0, 25).map((r) => (
                <Link key={r.id} href={`/app/agents/${id}/runs/${r.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-sm">
                  <span className={`w-2 h-2 rounded-full ${DONE.includes((r.status ?? '').toLowerCase()) ? 'bg-emerald-500' : FAILED.includes((r.status ?? '').toLowerCase()) ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <span className="capitalize flex-1">{r.status}</span>
                  <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'Knowledge' && <KnowledgeTab agentId={id} />}

      {tab === 'Connectors' && <ConnectorsTab agentId={id} />}

      <div className="mt-6">
        <ControlPanel agentId={id} />
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Organization</h2>
        <OrgGraph highlightAgentId={id} />
      </div>
    </div>
  );
}
