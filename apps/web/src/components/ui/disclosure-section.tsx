'use client';

/**
 * DisclosureSection — three-level progressive disclosure. Advanced fields stay
 * collapsed so beginners see only essentials; `level` lets a page hide deep
 * options entirely unless the user opts into a more advanced mode.
 *
 *   level: 'essential' always shown · 'advanced' collapsed by default ·
 *          'expert' collapsed and labelled, for power users.
 */
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';

export function DisclosureSection({
  title,
  level = 'advanced',
  defaultOpen = false,
  children,
}: {
  title: string;
  level?: 'essential' | 'advanced' | 'expert';
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || level === 'essential');

  if (level === 'essential') {
    return <div className="space-y-3">{children}</div>;
  }

  return (
    <div className="border border-border rounded-2xl overflow-hidden" data-testid={`disclosure-${level}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          {level === 'expert' && <Sparkles className="w-3.5 h-3.5 text-violet-500" />}
          {title}
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded-full px-2 py-0.5">{level}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-3">{children}</div>}
    </div>
  );
}
