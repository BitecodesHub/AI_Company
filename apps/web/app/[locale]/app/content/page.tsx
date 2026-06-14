import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Sparkles, Calendar, Kanban } from 'lucide-react';

export const metadata: Metadata = { title: 'Content' };

export default function ContentPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Content</h1>
          <p className="text-muted-foreground mt-1">Plan, draft, schedule, and publish social content.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
            <Sparkles className="w-4 h-4 text-primary" /> Generate week
          </button>
          <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> New post
          </button>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 mb-6 bg-muted p-1 rounded-lg w-fit">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background text-sm font-medium shadow-sm">
          <Calendar className="w-3.5 h-3.5" /> Calendar
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground">
          <Kanban className="w-3.5 h-3.5" /> Kanban
        </button>
      </div>

      <div className="border-2 border-dashed border-border rounded-xl p-16 text-center">
        <Calendar className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
        <h2 className="font-semibold text-lg mb-2">No content scheduled</h2>
        <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
          Connect a social account and use AI to generate a week of content drafts.
        </p>
        <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm mx-auto hover:bg-primary/90 transition-colors">
          <Sparkles className="w-4 h-4" /> Generate this week
        </button>
      </div>
    </div>
  );
}
