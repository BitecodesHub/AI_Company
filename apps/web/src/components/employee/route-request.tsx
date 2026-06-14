'use client';

/**
 * RouteRequest — "ask the company" box. A request is classified to the best-fit
 * employee. High confidence auto-dispatches; otherwise a divert card lets you
 * confirm the proposal or pick a different employee (the divert flow).
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { orchestrationApi, agentsApi, type Agent, type RoutingDecision } from '../../lib/api-client';
import { toast } from 'sonner';

export function RouteRequest() {
  const qc = useQueryClient();
  const [request, setRequest] = useState('');
  const [decision, setDecision] = useState<RoutingDecision | null>(null);
  const [divertTo, setDivertTo] = useState('');

  const { data: agentsData } = useQuery({ queryKey: ['agents'], queryFn: () => agentsApi.list() });
  const agents = (agentsData?.items ?? []) as Agent[];
  const nameOf = (id?: string | null) => agents.find((a) => a.id === id)?.name ?? 'an employee';

  const route = useMutation({
    mutationFn: () => orchestrationApi.route(request.trim()),
    onSuccess: (d) => {
      setDecision(d);
      if (d.status === 'auto_dispatched') {
        toast.success(`Routed to ${nameOf(d.chosenAgentId)} — run started`);
        setRequest('');
        qc.invalidateQueries({ queryKey: ['runs'] });
      }
    },
    onError: (e: Error) => toast.error(e.message || 'Routing failed'),
  });

  const confirm = useMutation({
    mutationFn: (divert?: string) => {
      if (!decision) throw new Error('No routing decision');
      return orchestrationApi.confirm(decision.id, divert);
    },
    onSuccess: (_r, divert) => {
      toast.success(divert ? `Diverted to ${nameOf(divert)}` : `Confirmed — sent to ${nameOf(decision?.proposedAgentId)}`);
      setDecision(null); setRequest(''); setDivertTo('');
      qc.invalidateQueries({ queryKey: ['runs'] });
    },
    onError: (e: Error) => toast.error(e.message || 'Could not dispatch'),
  });

  const confidencePct = decision?.confidence ? Math.round(Number(decision.confidence) * 100) : 0;

  return (
    <div className="border border-border rounded-2xl p-5 mb-6" data-testid="route-request">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Ask the company</h3>
      </div>
      <div className="flex gap-2">
        <input
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && request.trim()) route.mutate(); }}
          placeholder="Describe what you need — we'll route it to the right employee…"
          className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          onClick={() => route.mutate()}
          disabled={!request.trim() || route.isPending}
          className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {route.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />} Route
        </button>
      </div>

      {decision && decision.status === 'proposed' && (
        <div className="mt-4 border border-amber-500/30 bg-amber-500/5 rounded-xl p-4" data-testid="divert-card">
          <p className="text-sm">
            Best match: <strong>{nameOf(decision.proposedAgentId)}</strong>
            <span className="text-muted-foreground"> · {confidencePct}% confidence</span>
          </p>
          {decision.reasoning && <p className="text-xs text-muted-foreground mt-1">{decision.reasoning}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              onClick={() => confirm.mutate(undefined)}
              disabled={confirm.isPending}
              className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" /> Confirm
            </button>
            <span className="text-xs text-muted-foreground">or divert to</span>
            <select value={divertTo} onChange={(e) => setDivertTo(e.target.value)} className="px-2 py-1.5 rounded-lg border border-border bg-background text-sm">
              <option value="">choose…</option>
              {agents.filter((a) => a.id !== decision.proposedAgentId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button
              onClick={() => divertTo && confirm.mutate(divertTo)}
              disabled={!divertTo || confirm.isPending}
              className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Divert
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
