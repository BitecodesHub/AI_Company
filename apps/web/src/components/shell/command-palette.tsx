'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import {
  Bot, Rss, Inbox, BookOpen, Workflow, Settings, Zap, Plus, Store, BarChart2,
  LayoutDashboard, ArrowLeft, Loader2, Send as SendIcon, CheckCircle2, Circle, AlertCircle, Navigation,
} from 'lucide-react';
import { controllerApi, type ControllerResult, type ControllerPlannedAction } from '../../lib/api-client';

const commands = [
  { group: 'Navigate', items: [
    { label: 'Go to Dashboard',   icon: LayoutDashboard, action: '/app/dashboard' },
    { label: 'Go to Agents',      icon: Bot,             action: '/app/agents' },
    { label: 'Go to Content',     icon: Rss,             action: '/app/content' },
    { label: 'Go to Inbox',       icon: Inbox,           action: '/app/inbox' },
    { label: 'Go to Knowledge',   icon: BookOpen,        action: '/app/knowledge' },
    { label: 'Go to Workflows',   icon: Workflow,        action: '/app/workflows' },
    { label: 'Go to Marketplace', icon: Store,           action: '/app/marketplace' },
    { label: 'Go to Analytics',   icon: BarChart2,       action: '/app/analytics' },
    { label: 'Go to Settings',    icon: Settings,        action: '/app/settings' },
  ]},
  { group: 'Create', items: [
    { label: 'New Agent',              icon: Plus,     action: '/app/agents/new' },
    { label: 'Generate Content Week',  icon: Rss,      action: '/app/content?action=generate' },
    { label: 'New Workflow',           icon: Workflow, action: '/app/workflows/new' },
  ]},
  { group: 'AI Controller', items: [
    { label: 'Ask the AI Controller to do something', icon: Zap, action: 'controller' },
  ]},
];

const STATUS_STYLE: Record<ControllerPlannedAction['status'], { cls: string; label: string; Icon: typeof CheckCircle2 }> = {
  executed:     { cls: 'text-emerald-600 dark:text-emerald-400', label: 'Done',     Icon: CheckCircle2 },
  ready:        { cls: 'text-blue-600 dark:text-blue-400',       label: 'Opening',  Icon: Navigation },
  acknowledged: { cls: 'text-amber-600 dark:text-amber-400',     label: 'Planned',  Icon: Circle },
  invalid:      { cls: 'text-red-600 dark:text-red-400',         label: 'Skipped',  Icon: AlertCircle },
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'menu' | 'controller'>('menu');
  const [cmd, setCmd] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ControllerResult | null>(null);
  const [error, setError] = useState('');
  const sessionRef = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    // Let other surfaces (e.g. the sidebar) open the Controller directly.
    const openController = () => { setOpen(true); setMode('controller'); };
    window.addEventListener('bitecodes:open-controller', openController);
    return () => {
      document.removeEventListener('keydown', handler);
      window.removeEventListener('bitecodes:open-controller', openController);
    };
  }, []);

  const reset = useCallback(() => {
    setMode('menu'); setCmd(''); setResult(null); setError(''); setBusy(false); setSearch('');
  }, []);

  const close = useCallback(() => { setOpen(false); reset(); }, [reset]);

  const runCommand = useCallback((action: string) => {
    if (action === 'controller') { setMode('controller'); return; }
    close();
    router.push(action);
  }, [router, close]);

  const sendController = useCallback(async () => {
    const text = cmd.trim();
    if (!text || busy) return;
    setBusy(true); setError(''); setResult(null);
    try {
      if (!sessionRef.current) {
        const s = await controllerApi.start();
        sessionRef.current = s.sessionId;
      }
      const res = await controllerApi.command(sessionRef.current, text);
      setResult(res);
      // Perform the browser-side actions the Controller planned.
      for (const c of res.clientActions ?? []) {
        if (c.to) router.push(c.to);
      }
      // If we navigated somewhere, dismiss shortly so the user lands on the page.
      if ((res.clientActions ?? []).length > 0) {
        setTimeout(() => close(), 1200);
      }
    } catch {
      setError('Could not reach the AI Controller. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [cmd, busy, router, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[20vh]"
      onClick={close}
    >
      <div
        className="w-full max-w-lg bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === 'menu' ? (
          <Command>
            <div className="flex items-center border-b border-border px-4 gap-2">
              <span className="text-muted-foreground text-sm">⌘</span>
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Type a command or search..."
                className="flex-1 py-4 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              />
              <kbd className="text-xs bg-muted border border-border px-1.5 py-0.5 rounded text-muted-foreground">ESC</kbd>
            </div>
            <Command.List className="max-h-80 overflow-y-auto py-2">
              <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                No results found.
              </Command.Empty>
              {commands.map((group) => (
                <Command.Group key={group.group} heading={group.group}
                  className="px-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:font-medium">
                  {group.items.map((item) => (
                    <Command.Item
                      key={item.label}
                      value={item.label}
                      onSelect={() => runCommand(item.action)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer hover:bg-muted data-[selected=true]:bg-muted"
                    >
                      <item.icon className="w-4 h-4 text-muted-foreground" />
                      {item.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        ) : (
          <div>
            <div className="flex items-center border-b border-border px-3 gap-2 py-2.5">
              <button onClick={() => { setMode('menu'); setResult(null); setError(''); }}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground" aria-label="Back">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">AI Controller</span>
            </div>

            <div className="p-3">
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={cmd}
                  onChange={(e) => setCmd(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void sendController(); } }}
                  placeholder="e.g. create an employee called Maya in marketing, or go to knowledge"
                  disabled={busy}
                  className="flex-1 text-sm bg-background border border-border rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors placeholder:text-muted-foreground disabled:opacity-60"
                />
                <button onClick={() => void sendController()} disabled={busy || !cmd.trim()}
                  className="bg-primary text-primary-foreground px-3.5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendIcon className="w-4 h-4" />}
                </button>
              </div>

              {!result && !error && !busy && (
                <p className="text-xs text-muted-foreground mt-2 px-1">
                  Tell the Controller what to do in plain English. It can create employees, run them, and open any part of the app.
                </p>
              )}

              {error && <p className="text-sm text-destructive mt-3 px-1">{error}</p>}

              {result && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm px-1">{result.summary}</p>
                  {result.actions.length > 0 && (
                    <ul className="space-y-1">
                      {result.actions.map((a, i) => {
                        const s = STATUS_STYLE[a.status];
                        return (
                          <li key={i} className="flex items-start gap-2 text-sm px-1 py-1">
                            <s.Icon className={`w-4 h-4 mt-0.5 shrink-0 ${s.cls}`} />
                            <span className="flex-1">
                              <span className="font-medium">{a.name}</span>
                              <span className={`ml-2 text-xs ${s.cls}`}>{s.label}</span>
                              {(a.note || a.error) && (
                                <span className="block text-xs text-muted-foreground">{a.error ?? a.note}</span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
