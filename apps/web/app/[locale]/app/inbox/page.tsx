'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Sparkles, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { inboxApi, ApiError, type InboxMessage } from '../../../../src/lib/api-client';

const FILTERS: Array<{ label: string; match: (kind: string) => boolean }> = [
  { label: 'All', match: () => true },
  { label: 'Comments', match: (k) => k === 'comment' },
  { label: 'DMs', match: (k) => k === 'dm' || k === 'message' },
  { label: 'Mentions', match: (k) => k === 'mention' },
  { label: 'Reviews', match: (k) => k === 'review' },
];

function authorName(author: unknown): string {
  if (typeof author === 'string') return author;
  if (author && typeof author === 'object' && 'name' in author) {
    return String((author as { name?: unknown }).name ?? 'Unknown');
  }
  return 'Unknown';
}

export default function InboxPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('All');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['inbox'], queryFn: () => inboxApi.list() });
  const all = (data?.items ?? []) as InboxMessage[];
  const active = FILTERS.find((f) => f.label === filter) ?? { label: 'All', match: () => true };
  const messages = all.filter((m) => active.match((m.kind ?? '').toLowerCase()));

  const draftAllMut = useMutation({
    mutationFn: () => inboxApi.draftAll(),
    onSuccess: () => toast.success('Drafting replies for all open messages — they will appear shortly.'),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not start drafting'),
  });

  const replyMut = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => inboxApi.reply(id, text, true),
    onSuccess: () => {
      toast.success('Reply sent');
      setReplyingTo(null); setDraft('');
      qc.invalidateQueries({ queryKey: ['inbox'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to send reply'),
  });

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-border p-4 shrink-0">
        <h1 className="font-bold text-lg mb-4">Inbox</h1>
        <div className="space-y-1">
          {FILTERS.map((f) => {
            const count = all.filter((m) => f.match((m.kind ?? '').toLowerCase())).length;
            return (
              <button key={f.label} onClick={() => setFilter(f.label)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  f.label === filter ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}>
                <span>{f.label}</span>
                {count > 0 && <span className="text-xs">{count}</span>}
              </button>
            );
          })}
        </div>
        <button onClick={() => draftAllMut.mutate()} disabled={draftAllMut.isPending || all.length === 0}
          className="mt-6 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
          {draftAllMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Draft all with AI
        </button>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="border border-border rounded-xl p-4 animate-pulse">
                <div className="h-3 bg-muted rounded w-1/4 mb-2" />
                <div className="h-3 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-8">
            <MessageSquare className="w-12 h-12 text-muted-foreground/40" />
            <h2 className="font-semibold text-lg">No messages here</h2>
            <p className="text-muted-foreground text-sm max-w-xs">
              Connect social accounts to start seeing comments, DMs, mentions, and reviews — your agents can reply for you.
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-3">
            {messages.map((m) => (
              <div key={m.id} className="border border-border rounded-xl p-4 bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">{authorName(m.author)}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded-full px-2 py-0.5">{m.platform}</span>
                  <span className="text-xs text-muted-foreground capitalize">{m.kind}</span>
                  {m.isLead && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Lead</span>}
                  <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{m.status}</span>
                </div>
                <p className="text-sm text-foreground/90 mb-3">{m.text}</p>

                {replyingTo === m.id ? (
                  <div className="space-y-2">
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} autoFocus
                      placeholder="Write a reply…"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                    <div className="flex gap-2">
                      <button onClick={() => { if (draft.trim()) replyMut.mutate({ id: m.id, text: draft.trim() }); }}
                        disabled={!draft.trim() || replyMut.isPending}
                        className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                        {replyMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send
                      </button>
                      <button onClick={() => { setReplyingTo(null); setDraft(''); }}
                        className="px-3 py-1.5 rounded-lg text-xs border border-border hover:bg-muted transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setReplyingTo(m.id); setDraft(''); }}
                    className="text-xs text-primary hover:underline">Reply</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
