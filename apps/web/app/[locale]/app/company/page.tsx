'use client';

/**
 * Company chat — one surface showing every conversation and the agents' internal
 * back-and-forth (human turns, agent observations, handoffs) as a chronological
 * timeline. Live via the /company socket with a polling fallback.
 */
import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Plus, Send, Bot, User, GitBranch, Eye, Loader2 } from 'lucide-react';
import { companyApi, type Conversation, type TimelineItem } from '../../../../src/lib/api-client';
import { useMe } from '../../../../src/hooks/use-me';
import { useCompanyStream } from '../../../../src/hooks/use-company-stream';
import { toast } from 'sonner';

export default function CompanyPage() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const { data: convData } = useQuery({ queryKey: ['conversations'], queryFn: () => companyApi.listConversations() });
  const conversations = (convData?.items ?? []) as Conversation[];
  const selected = activeId ?? conversations[0]?.id ?? null;

  const { data: timeline } = useQuery({
    queryKey: ['conversation', selected],
    queryFn: () => companyApi.messages(selected as string), // guarded by `enabled` below
    enabled: !!selected,
    refetchInterval: 10_000,
  });

  const refetch = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['conversation', selected] });
    qc.invalidateQueries({ queryKey: ['conversations'] });
  }, [qc, selected]);
  useCompanyStream(me?.workspace?.id, refetch);

  const create = useMutation({
    mutationFn: () => companyApi.createConversation(),
    onSuccess: (c: Conversation) => { setActiveId(c.id); qc.invalidateQueries({ queryKey: ['conversations'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const post = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('No conversation selected');
      return companyApi.postMessage(selected, draft.trim());
    },
    onSuccess: () => { setDraft(''); refetch(); },
    onError: (e: Error) => toast.error(e.message || 'Could not send'),
  });

  const items = (timeline?.items ?? []) as TimelineItem[];

  return (
    <div className="flex h-full" data-testid="company-page">
      {/* Conversation list */}
      <aside className="w-64 border-r border-border p-3 overflow-y-auto">
        <button onClick={() => create.mutate()} className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-xl py-2 text-sm font-medium hover:bg-primary/90 mb-3">
          <Plus className="w-4 h-4" /> New conversation
        </button>
        <div className="space-y-1">
          {conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-4 text-center">No conversations yet.</p>
          ) : conversations.map((c) => (
            <button key={c.id} onClick={() => setActiveId(c.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${selected === c.id ? 'bg-sidebar-accent font-medium' : 'hover:bg-sidebar-accent text-muted-foreground'}`}>
              <MessageSquare className="w-3.5 h-3.5 inline mr-2 opacity-60" />
              {c.subject ?? 'Untitled'}
            </button>
          ))}
        </div>
      </aside>

      {/* Timeline */}
      <div className="flex-1 flex flex-col">
        <div className="px-6 py-4 border-b border-border">
          <h1 className="font-semibold">Company chat</h1>
          <p className="text-xs text-muted-foreground">Every employee's work and hand-offs, in one timeline.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3" data-testid="company-timeline">
          {!selected ? (
            <div className="text-center text-muted-foreground text-sm py-16">Start or pick a conversation.</div>
          ) : items.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-16">No activity yet. Say something to kick things off.</div>
          ) : items.map((it) => <TimelineRow key={`${it.kind}-${it.data.id}`} item={it} />)}
        </div>

        {selected && (
          <div className="border-t border-border p-3 flex gap-2">
            <input
              value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) post.mutate(); }}
              placeholder="Message the company…"
              className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button onClick={() => post.mutate()} disabled={!draft.trim() || post.isPending}
              className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {post.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineRow({ item }: { item: TimelineItem }) {
  const isTurn = item.kind === 'turn';
  const d = item.data;
  const isHuman = isTurn && d.authorType === 'user';
  const Icon = isHuman ? User : d.kind === 'handoff' ? GitBranch : d.kind === 'observation' ? Eye : Bot;
  const tone = isHuman ? 'bg-primary/10 border-primary/20' : d.kind === 'handoff' ? 'bg-violet-500/10 border-violet-500/20' : 'bg-muted border-border';

  return (
    <div className={`border rounded-xl p-3 ${tone}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="font-medium">{isHuman ? 'You' : d.kind ?? (isTurn ? 'agent' : 'event')}</span>
        <span className="opacity-60">{new Date(d.createdAt).toLocaleTimeString()}</span>
      </div>
      <p className="text-sm whitespace-pre-wrap">{d.body ?? '—'}</p>
    </div>
  );
}
