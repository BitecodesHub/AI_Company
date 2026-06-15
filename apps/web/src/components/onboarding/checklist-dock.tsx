'use client';

/**
 * ChecklistDock — a floating getting-started checklist. Reflects the server-owned
 * onboarding state (so it survives refresh) and disappears once complete. Steps
 * link to the action that completes them. Dismissable per session.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, Circle, X, Rocket } from 'lucide-react';
import { useOnboarding } from '../../hooks/use-onboarding';

const STEP_META: Record<string, { label: string; href: string }> = {
  hire_employee: { label: 'Hire your first employee', href: '/app/agents/new' },
  first_run: { label: 'Communicate with an employee', href: '/app/agents' },
  connect_tool: { label: 'Connect a tool', href: '/app/connectors' },
  invite_team: { label: 'Invite a teammate', href: '/app/admin/invitations' },
};

export function ChecklistDock() {
  const { data } = useOnboarding();
  const params = useParams();
  const locale = (params?.locale as string) ?? 'en';
  const [dismissed, setDismissed] = useState(false);

  if (!data || dismissed || data.completedAt) return null;
  const steps = data.steps ?? [];
  if (steps.length === 0) return null;

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="fixed bottom-4 right-4 w-72 z-40 bg-popover border border-border rounded-2xl shadow-xl p-4" data-testid="checklist-dock">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Get started</span>
        </div>
        <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="h-1.5 bg-muted rounded-full mb-3 overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ul className="space-y-1.5">
        {steps.map((s) => {
          const meta = STEP_META[s.step] ?? { label: s.step, href: '/app/dashboard' };
          return (
            <li key={s.step}>
              <Link href={`/${locale}${meta.href}`}
                className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-muted ${s.done ? 'text-muted-foreground line-through' : ''}`}>
                {s.done ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                {meta.label}
                {!s.required && <span className="text-[10px] text-muted-foreground ml-auto">optional</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
