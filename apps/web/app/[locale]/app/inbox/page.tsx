import type { Metadata } from 'next';
import { MessageSquare, Filter, Sparkles } from 'lucide-react';

export const metadata: Metadata = { title: 'Inbox' };

export default function InboxPage() {
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-72 border-r border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-bold text-lg">Inbox</h1>
          <button className="text-muted-foreground hover:text-foreground">
            <Filter className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1">
          {['All', 'Comments', 'DMs', 'Mentions', 'Reviews'].map((f) => (
            <button key={f}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${f === 'All' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
        <MessageSquare className="w-12 h-12 text-muted-foreground/40" />
        <h2 className="font-semibold text-lg">No messages yet</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          Connect social accounts to start seeing comments, DMs, and mentions here.
        </p>
        <button className="flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
          <Sparkles className="w-4 h-4 text-primary" /> Connect accounts
        </button>
      </div>
    </div>
  );
}
