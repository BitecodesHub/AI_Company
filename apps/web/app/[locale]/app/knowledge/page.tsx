'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, Loader2, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { knowledgeApi, ApiError } from '../../../../src/lib/api-client';

export default function KnowledgePage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['knowledge-bases'], queryFn: () => knowledgeApi.list() });
  const bases = data?.items ?? [];

  const createMut = useMutation({
    mutationFn: () => knowledgeApi.create({
      name: name.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
    }),
    onSuccess: () => {
      toast.success('Knowledge base created');
      setModalOpen(false); setName(''); setDescription('');
      qc.invalidateQueries({ queryKey: ['knowledge-bases'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to create knowledge base'),
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
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground mt-1">Documents, URLs, and text your agents can search and cite.</p>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> New knowledge base
        </button>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border border-border rounded-2xl p-5 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-muted mb-4" />
              <div className="h-4 bg-muted rounded w-2/3 mb-2" />
              <div className="h-3 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      ) : bases.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-2xl p-16 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Add your first knowledge base</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Create a knowledge base, then add PDFs, URLs, or text. Your agents can search and cite from it.
          </p>
          <button onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> New knowledge base
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bases.map((kb) => (
            <div key={kb.id} className="border border-border rounded-2xl p-5 bg-card hover:border-primary/30 hover:shadow-md transition-all">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">{kb.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">{kb.description || 'No description'}</p>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
                <FileText className="w-3.5 h-3.5" /> {kb.embeddingModel}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeModal}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New knowledge base</h2>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) createMut.mutate(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="kb-name">Name <span className="text-destructive">*</span></label>
                <input id="kb-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus
                  placeholder="e.g. Product docs"
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="kb-desc">Description</label>
                <textarea id="kb-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                  placeholder="What is in this knowledge base?"
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal} className="flex-1 border border-border px-4 py-2.5 rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" disabled={!name.trim() || createMut.isPending}
                  className="flex-1 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {createMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
