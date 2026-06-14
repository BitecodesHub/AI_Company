'use client';

/**
 * Admin → Advanced. Destination for API keys, active sessions, and the run
 * kill-switch (moved out of the personal Settings page). Each control wires up
 * to its endpoint as it ships; this page never shows a fake/non-functional toggle.
 */
import { KeyRound, MonitorSmartphone, Power } from 'lucide-react';

const SECTIONS = [
  { icon: KeyRound, title: 'API keys', body: 'Create and revoke programmatic access keys for this organization.' },
  { icon: MonitorSmartphone, title: 'Active sessions', body: 'Review and sign out devices with an active session.' },
  { icon: Power, title: 'Run kill-switch', body: 'Immediately halt all agent runs across the organization.' },
];

export default function AdvancedPage() {
  return (
    <div data-testid="admin-advanced" className="max-w-2xl space-y-3">
      {SECTIONS.map((s) => (
        <div key={s.title} className="border border-border rounded-2xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
            <s.icon className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">{s.title}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{s.body}</p>
          </div>
          <span className="text-xs text-muted-foreground border border-border rounded-full px-2.5 py-1 self-center">
            Connects soon
          </span>
        </div>
      ))}
    </div>
  );
}
