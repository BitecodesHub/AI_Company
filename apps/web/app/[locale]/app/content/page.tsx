'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Plus, Sparkles, Loader2, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { contentApi, ApiError, type ContentItem } from '../../../../src/lib/api-client';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

export default function ContentPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [type, setType] = useState('post');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['content-items'], queryFn: () => contentApi.list() });
  const items = data?.items ?? [];

  const createMut = useMutation({
    mutationFn: () => contentApi.create({
      type,
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(body.trim() ? { body: body.trim() } : {}),
    }),
    onSuccess: () => {
      toast.success('Draft created');
      setModalOpen(false); setTitle(''); setBody(''); setType('post');
      qc.invalidateQueries({ queryKey: ['content-items'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to create draft'),
  });

  const generateMut = useMutation({
    mutationFn: () => contentApi.generateWeek(),
    onSuccess: () => toast.success('Generating a week of drafts — they will appear here shortly.'),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not start generation'),
  });

  function closeModal() {
    if (createMut.isPending) return;
    setModalOpen(false);
  }

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !createMut.isPending) setModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, createMut.isPending]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Content</h1>
          <p className="text-muted-foreground mt-1">Plan, draft, and publish social content.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => generateMut.mutate()} disabled={generateMut.isPending}
            className="flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-60">
            {generateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary" />} Generate week
          </button>
          <button onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> New post
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border border-border rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-3" />
              <div className="h-3 bg-muted rounded w-full mb-1.5" />
              <div className="h-3 bg-muted rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-16 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h2 className="font-semibold text-lg mb-2">No content yet</h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
            Draft a post yourself, or let AI generate a full week of content for you.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => generateMut.mutate()} disabled={generateMut.isPending}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-60">
              {generateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generate this week
            </button>
            <button onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
              <Plus className="w-4 h-4" /> New post
            </button>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(items as ContentItem[]).map((c) => (
            <div key={c.id} className="border border-border rounded-xl p-5 bg-card hover:border-primary/30 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
                  <FileText className="w-3.5 h-3.5" /> {c.type}
                </span>
                <span className={`text-[10px] font-medium px-2 py-1 rounded-full capitalize ${STATUS_STYLES[c.status] ?? STATUS_STYLES.draft}`}>
                  {c.status}
                </span>
              </div>
              <h3 className="font-semibold mb-1 line-clamp-1">{c.title || 'Untitled'}</h3>
              <p className="text-sm text-muted-foreground line-clamp-3 min-h-[3.75rem]">{c.body || 'No content yet.'}</p>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeModal}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New post</h2>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="c-type">Type</label>
                <select id="c-type" value={type} onChange={(e) => setType(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="post">Social post</option>
                  <option value="thread">Thread</option>
                  <option value="carousel">Carousel</option>
                  <option value="reel">Reel</option>
                  <option value="blog">Blog / article</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="c-title">Title</label>
                <input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
                  placeholder="e.g. Launch announcement"
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="c-body">Content</label>
                <textarea id="c-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5}
                  placeholder="Write your post, or leave blank and let an agent draft it later."
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal} className="flex-1 border border-border px-4 py-2.5 rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" disabled={createMut.isPending}
                  className="flex-1 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {createMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
