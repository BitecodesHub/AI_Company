'use client';

/**
 * BrandingCard — white-label the app per organization: a custom brand name and
 * logo (emoji, initials, or an image URL) shown in the sidebar. Persists to
 * organizations.branding via PATCH /v1/orgs/:id; the sidebar reads it from /v1/me.
 */
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { meApi, orgsApi, ApiError } from '../../lib/api-client';

export function BrandingCard() {
  const qc = useQueryClient();
  const meQ = useQuery({ queryKey: ['me'], queryFn: () => meApi.get() });
  const org = meQ.data?.org;
  const branding = (org?.branding ?? {}) as { brandName?: string; logo?: string };

  const [name, setName] = useState('');
  const [logo, setLogo] = useState('');
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty && org) { setName(branding.brandName ?? ''); setLogo(branding.logo ?? ''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id]);

  const saveMut = useMutation({
    mutationFn: () => orgsApi.update(org!.id, { branding: { brandName: name.trim(), logo: logo.trim() } }),
    onSuccess: () => { toast.success('Branding updated'); setDirty(false); qc.invalidateQueries({ queryKey: ['me'] }); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update branding'),
  });

  if (meQ.isLoading) {
    return <div className="border border-border rounded-2xl p-5 mb-6"><div className="h-28 bg-muted rounded-lg animate-pulse" /></div>;
  }
  if (!org) return null; // no active org to brand

  const previewName = name.trim() || 'Bitecodes';
  const previewLogo = logo.trim();
  const logoIsImage = /^(https?:|data:)/i.test(previewLogo);

  return (
    <div className="border border-border rounded-2xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Palette className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm">Branding</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">White-label the app — set the name and logo your team sees in the sidebar.</p>

      {/* Live preview */}
      <div className="flex items-center gap-2.5 mb-4 p-3 rounded-xl bg-muted/40 border border-border">
        {previewLogo ? (
          logoIsImage
            ? <span className="w-8 h-8 rounded-xl bg-cover bg-center shadow-sm" style={{ backgroundImage: `url(${previewLogo})` }} />
            : <span className="flex w-8 h-8 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-sm" style={{ fontSize: previewLogo.length > 2 ? 14 : 16 }}>{previewLogo.slice(0, 2)}</span>
        ) : (
          <span className="flex w-8 h-8 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-base shadow-sm">{previewName.charAt(0).toUpperCase()}</span>
        )}
        <span className="text-lg font-bold tracking-tight">{previewName}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">Preview</span>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="brand-name" className="block text-sm font-medium mb-1.5">Brand name</label>
          <input id="brand-name" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }}
            placeholder="Bitecodes"
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div>
          <label htmlFor="brand-logo" className="block text-sm font-medium mb-1.5">Logo</label>
          <input id="brand-logo" value={logo} onChange={(e) => { setLogo(e.target.value); setDirty(true); }}
            placeholder="An emoji, 1–2 letters, or an image URL"
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <p className="text-xs text-muted-foreground mt-1">Paste an image URL (https://…) for a custom logo, or use an emoji / initials.</p>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button onClick={() => saveMut.mutate()} disabled={!dirty || saveMut.isPending}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
          {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save branding
        </button>
      </div>
    </div>
  );
}
