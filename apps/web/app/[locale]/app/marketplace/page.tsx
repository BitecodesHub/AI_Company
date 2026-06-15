'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Download, Loader2, Store } from 'lucide-react';
import { toast } from 'sonner';
import { marketplaceApi, ApiError, type Template } from '../../../../src/lib/api-client';

const CATEGORIES: Array<{ label: string; kind: string | null }> = [
  { label: 'All', kind: null },
  { label: 'Agents', kind: 'agent' },
  { label: 'Workflows', kind: 'workflow' },
  { label: 'Brand Voices', kind: 'brand_voice' },
  { label: 'Prompts', kind: 'prompt' },
];

export default function MarketplacePage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<string>('All');
  const [installing, setInstalling] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['templates'], queryFn: () => marketplaceApi.list() });
  const templates = (data?.items ?? []) as Template[];

  const activeCat = CATEGORIES.find((c) => c.label === cat) ?? CATEGORIES[0]!;
  const visible = templates.filter((t) => {
    const matchesCat = activeCat.kind === null || (t.kind ?? '').toLowerCase().startsWith(activeCat.kind);
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || t.title.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const installMut = useMutation({
    mutationFn: (id: string) => marketplaceApi.install(id),
    onMutate: (id: string) => setInstalling(id),
    onSuccess: () => {
      toast.success('Template installed — find it in your workspace.');
      qc.invalidateQueries({ queryKey: ['agents'] });
      qc.invalidateQueries({ queryKey: ['workflows'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Install failed'),
    onSettled: () => setInstalling(null),
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <p className="text-muted-foreground mt-1">Pre-built agents, workflows, and brand voices — install in one click.</p>
      </div>

      {/* Search + categories */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates…"
          className="flex-1 border border-border rounded-lg px-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((c) => (
            <button key={c.label} onClick={() => setCat(c.label)}
              className={`px-3 py-2 rounded-lg text-sm border transition-colors ${c.label === cat ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border border-border rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-3" />
              <div className="h-4 bg-muted rounded w-2/3 mb-2" />
              <div className="h-3 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-2xl p-16 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">{search || cat !== 'All' ? 'No matching templates' : 'No templates yet'}</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            {search || cat !== 'All' ? 'Try a different search or category.' : 'Published templates will appear here for one-click install.'}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {visible.map((t) => (
            <div key={t.id} className="bg-card border border-border rounded-xl p-6 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full capitalize">{(t.kind ?? 'template').replace('_', ' ')}</span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="w-3 h-3" />{t.ratingAvg ?? '—'}
                </div>
              </div>
              <h3 className="font-semibold mb-2">{t.title}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[2.5rem]">{t.description || 'No description.'}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Download className="w-3 h-3" />{t.installCount} installs</span>
                <button onClick={() => installMut.mutate(t.id)} disabled={installing === t.id}
                  className="text-sm text-primary font-medium hover:underline disabled:opacity-60 flex items-center gap-1">
                  {installing === t.id ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Installing…</> : (
                    <>{t.priceCents > 0 ? `Install $${(t.priceCents / 100).toFixed(2)}` : 'Install free'} →</>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
