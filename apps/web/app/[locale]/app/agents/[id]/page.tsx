'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Play, Settings, Loader2, Send as SendIcon, Bot, User, Sparkles, Users, CornerDownRight } from 'lucide-react';
import {
  agentsApi, runsApi, knowledgeApi, ApiError, type Agent, type AgentRun, type RunWithSteps, type KnowledgeBase,
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

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

type ChatMsg = { role: 'user' | 'agent' | 'error' | 'handoff'; text: string; at: string; from?: { name: string; avatar?: string | null } };
type Tab = 'Playground' | 'Configuration' | 'Run history' | 'Knowledge';

// Map an employee's domain to the everyday words a user might use when a question
// really belongs to that domain — powers the "bring in a colleague" suggestion.
const ROLE_HINTS: Record<string, string[]> = {
  finance: ['finance', 'budget', 'invoice', 'expense', 'cost', 'revenue', 'payment', 'accounting', 'tax', 'payroll', 'pricing'],
  hr: ['hr', 'hire', 'hiring', 'recruit', 'employee', 'leave', 'onboarding', 'people', 'culture'],
  marketing: ['marketing', 'campaign', 'content', 'social', 'brand', 'audience'],
  sales: ['sales', 'lead', 'deal', 'pipeline', 'prospect', 'quota', 'crm'],
  support: ['support', 'ticket', 'issue', 'complaint', 'help'],
  legal: ['legal', 'contract', 'compliance', 'policy', 'terms', 'gdpr', 'privacy'],
  product: ['product', 'feature', 'roadmap', 'design', 'spec'],
  engineering: ['engineering', 'code', 'deploy', 'bug', 'infra', 'technical'],
  operations: ['operations', 'process', 'logistics', 'vendor', 'procurement'],
};
function scoreColleague(question: string, a: { name: string; role: string }): number {
  const q = question.toLowerCase();
  let score = 0;
  const words = `${a.role} ${a.name}`.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4);
  for (const w of words) if (q.includes(w)) score += 2;
  for (const [key, syns] of Object.entries(ROLE_HINTS)) {
    if (a.role.toLowerCase().includes(key) && syns.some((s) => q.includes(s))) { score += 1; break; }
  }
  return score;
}

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
  const suggested = (() => {
    if (!lastIsAnswer || !lastUserMsg || others.length === 0) return null;
    let best: { a: Agent; score: number } | null = null;
    for (const a of others) {
      const sc = scoreColleague(lastUserMsg, a);
      if (sc > 0 && (!best || sc > best.score)) best = { a, score: sc };
    }
    return best?.a ?? null;
  })();

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
    setMessages((m) => [...m, { role: 'user', text, at: now() }]);
    setRunning(true);
    try {
      const r = await dispatchTo(id, text);
      if (!aliveRef.current) return;
      setMessages((m) => [...m, r.ok ? { role: 'agent', text: r.text, at: now() } : { role: 'error', text: r.text, at: now() }]);
    } catch (e) {
      if (!aliveRef.current) return;
      setMessages((m) => [...m, { role: 'error', text: e instanceof ApiError ? e.message : 'Could not reach the agent. Please try again.', at: now() }]);
    } finally {
      if (aliveRef.current) setRunning(false);
    }
  }

  /** Bring a colleague into the SAME chat to answer a question outside this employee's lane. */
  async function consult(colleague: Agent, question: string) {
    if (running || !question) return;
    setMessages((m) => [...m, { role: 'handoff', text: `${agent?.name ?? 'This employee'} brought in ${colleague.name} — ${colleague.role}`, at: now() }]);
    setRunning(true);
    try {
      const prompt = `${question}\n\n(Context: ${agent?.name ?? 'A colleague'}${agent?.role ? ` (${agent.role})` : ''} referred this to you because it is in your area. Answer the user directly and concisely.)`;
      const r = await dispatchTo(colleague.id, prompt);
      if (!aliveRef.current) return;
      setMessages((m) => [...m, r.ok
        ? { role: 'agent', from: { name: colleague.name, avatar: colleague.avatar ?? null }, text: r.text, at: now() }
        : { role: 'error', text: `${colleague.name}: ${r.text}`, at: now() }]);
    } catch (e) {
      if (!aliveRef.current) return;
      setMessages((m) => [...m, { role: 'error', text: e instanceof ApiError ? e.message : `Could not reach ${colleague.name}.`, at: now() }]);
    } finally {
      if (aliveRef.current) setRunning(false);
    }
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
        {(['Playground', 'Configuration', 'Run history', 'Knowledge'] as Tab[]).map((t) => (
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
                  if (m.role === 'handoff') {
                    return (
                      <div key={i} className="flex items-center gap-2 justify-center py-1">
                        <span className="h-px flex-1 bg-border/70" />
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 border border-border rounded-full px-3 py-1 shrink-0">
                          <CornerDownRight className="w-3.5 h-3.5 text-primary" /> {m.text}
                        </span>
                        <span className="h-px flex-1 bg-border/70" />
                      </div>
                    );
                  }
                  const avatarText = m.role === 'error' ? '!' : (m.from?.avatar || m.from?.name?.charAt(0) || agent?.avatar || initial);
                  return (
                    <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
                {running && (
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
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0"><Users className="w-3.5 h-3.5" /> Bring in a teammate:</span>
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
