'use client';

import { useEffect, useState, useCallback } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { Bot, Rss, Inbox, BookOpen, Workflow, Settings, Zap, Plus, Store, BarChart2, LayoutDashboard } from 'lucide-react';

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
    { label: 'Open AI Controller', icon: Zap, action: 'controller' },
  ]},
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
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
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const runCommand = useCallback((action: string) => {
    setOpen(false);
    setSearch('');
    if (action === 'controller') {
      // TODO: dispatch AI Controller session
      return;
    }
    router.push(action);
  }, [router]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[20vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
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
      </div>
    </div>
  );
}
