'use client';

/**
 * UpgradeNudge — plan / white-label gating. Wrap a premium feature; when the
 * current plan lacks it, render a tasteful nudge INSTEAD of the feature (never a
 * crash or a dead control). When unlocked, render the children as-is.
 *
 * Plan is read from useMe().org (best-effort); unknown/free plans are gated.
 */
import type { ReactNode } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { useMe } from '../../hooks/use-me';

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, team: 2, enterprise: 3 };

export function UpgradeNudge({
  feature,
  requires = 'pro',
  children,
}: {
  feature: string;
  requires?: 'pro' | 'team' | 'enterprise';
  children: ReactNode;
}) {
  const { data } = useMe();
  // org has no plan field in /v1/me yet → treat as 'free' (gated) until billing wires it.
  const plan = ((data?.org as { plan?: string } | null)?.plan ?? 'free').toLowerCase();
  const unlocked = (PLAN_RANK[plan] ?? 0) >= (PLAN_RANK[requires] ?? 1);

  if (unlocked) return <>{children}</>;

  return (
    <div className="border border-dashed border-border rounded-2xl p-6 text-center" data-testid="upgrade-nudge">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/10 to-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
        <Lock className="w-5 h-5 text-primary" />
      </div>
      <h3 className="font-semibold mb-1">{feature}</h3>
      <p className="text-sm text-muted-foreground mb-4">Available on the {requires.charAt(0).toUpperCase() + requires.slice(1)} plan and above.</p>
      <button className="inline-flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90">
        <Sparkles className="w-4 h-4" /> Upgrade
      </button>
    </div>
  );
}
