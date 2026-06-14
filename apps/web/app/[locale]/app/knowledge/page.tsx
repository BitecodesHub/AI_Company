import type { Metadata } from 'next';
import { BookOpen, Plus, Upload, Globe } from 'lucide-react';

export const metadata: Metadata = { title: 'Knowledge Base' };

export default function KnowledgePage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground mt-1">Upload documents, URLs, and text for your agents to search</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> New knowledge base
        </button>
      </div>

      {/* Empty state */}
      <div className="border-2 border-dashed border-border rounded-2xl p-16 text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Add your first knowledge base</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Upload PDFs, connect URLs, or paste text. Your agents can search and cite from any knowledge base you create.
        </p>
        <div className="flex gap-3 justify-center">
          <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Upload className="w-4 h-4" /> Upload files
          </button>
          <button className="inline-flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
            <Globe className="w-4 h-4" /> Add URL / crawl
          </button>
        </div>
      </div>
    </div>
  );
}
