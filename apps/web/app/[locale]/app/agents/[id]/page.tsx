'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Play, Settings, Loader2, Send as SendIcon, Bot, User } from 'lucide-react';
import {
  agentsApi, runsApi, ApiError, type AgentRun, type RunWithSteps,
} from '../../../../../src/lib/api-client';
import { ControlPanel } from '../../../../../src/components/employee/control-panel';
import { OrgGraph } from '../../../../../src/components/employee/org-graph';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const DONE = ['completed', 'succeeded', 'success'];
const FAILED = ['failed', 'error', 'cancelled', 'canceled'];

function renderOutput(output: unknown): string {
  if (output == null) return '';
  if (typeof output === 'string') return output;
  if (typeof output === 'object') {
    const o = output as Record<string, unknown>;
    for (const k of ['text', 'message', 'content', 'output', 'result', 'response', 'answer']) {
      if (typeof o[k] === 'string') return o[k] as string;
    }
    try { return JSON.stringify(output, null, 2); } catch { return String(output); }
  }
  return String(output);
}

type ChatMsg = { role: 'user' | 'agent' | 'error'; text: string };
type Tab = 'Playground' | 'Configuration' | 'Run history' | 'Knowledge';

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('Playground');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  const agentQ = useQuery({ queryKey: ['agent', id], queryFn: () => agentsApi.get(id) });
  const agent = agentQ.data;
  const runsQ = useQuery({
    queryKey: ['agent-runs', id],
    queryFn: () => runsApi.list(),
    enabled: tab === 'Run history',
  });
  const agentRuns = ((runsQ.data?.items ?? []) as AgentRun[]).filter((r) => r.agentId === id);

  async function send() {
    const text = input.trim();
    if (!text || running) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setRunning(true);
    try {
      const { runId } = await agentsApi.run(id, text);
      let run: RunWithSteps | undefined;
      for (let i = 0; i < 60; i++) {
        await wait(1500);
        if (!aliveRef.current) return;
        run = await runsApi.get(runId);
        const s = (run.status ?? '').toLowerCase();
        if (DONE.includes(s) || FAILED.includes(s)) break;
      }
      if (!aliveRef.current) return;
      const s = (run?.status ?? '').toLowerCase();
      if (run && DONE.includes(s)) {
        setMessages((m) => [...m, { role: 'agent', text: renderOutput(run!.output) || '(the agent returned no text)' }]);
      } else if (run && FAILED.includes(s)) {
        const reason = (run as { failureReason?: string }).failureReason;
        setMessages((m) => [...m, { role: 'error', text: `Run ${run!.status}${reason ? `: ${reason}` : ''}` }]);
      } else {
        setMessages((m) => [...m, { role: 'error', text: 'Still processing — the run was queued. Check Run history shortly.' }]);
      }
    } catch (e) {
      if (!aliveRef.current) return;
      setMessages((m) => [...m, { role: 'error', text: e instanceof ApiError ? e.message : 'Failed to start the run.' }]);
    } finally {
      if (aliveRef.current) setRunning(false);
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/app/agents" className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm">
          <ArrowLeft className="w-4 h-4" /> Agents
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{agent?.name ?? 'Agent'}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{agent?.name ?? 'Agent'}</h1>
          <p className="text-muted-foreground mt-1">{agent?.goal || agent?.role || 'Configure and run this agent'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('Configuration')}
            className="flex items-center gap-2 border border-border px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
            <Settings className="w-4 h-4" /> Configure
          </button>
          <button onClick={() => { setTab('Playground'); inputRef.current?.focus(); }}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Play className="w-4 h-4" /> Run
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
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="bg-muted/30 px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium">Playground</span>
            <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-0.5 rounded-full capitalize">
              {agent?.mode ?? 'sandbox'} mode
            </span>
          </div>
          <div className="min-h-60 max-h-[28rem] overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && !running ? (
              <div className="h-full min-h-52 flex items-center justify-center text-center text-muted-foreground">
                <div>
                  <Play className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Send a message to run this agent</p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role !== 'user' && (
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                      m.role === 'user' ? 'bg-primary text-primary-foreground'
                        : m.role === 'error' ? 'bg-destructive/10 text-destructive border border-destructive/20'
                          : 'bg-muted'
                    }`}>{m.text}</div>
                    {m.role === 'user' && (
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {running && (
                  <div className="flex gap-2.5 justify-start">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-xl px-3.5 py-2 text-sm flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Thinking…
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="border-t border-border p-3 flex gap-2">
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Type a message to this agent…" disabled={running}
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground disabled:opacity-60" />
            <button onClick={send} disabled={running || !input.trim()}
              className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5">
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SendIcon className="w-3.5 h-3.5" />} Send
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

      {tab === 'Knowledge' && (
        <div className="border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          Attach knowledge bases so this agent can search and cite your documents.{' '}
          <Link href="/app/knowledge" className="text-primary hover:underline">Manage knowledge →</Link>
        </div>
      )}

      {/* Employee controls (activation, approvals, guardrails) */}
      <div className="mt-6">
        <ControlPanel agentId={id} />
      </div>

      {/* Organization graph — supervises / watches / delegates edges */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Organization</h2>
        <OrgGraph highlightAgentId={id} />
      </div>
    </div>
  );
}
