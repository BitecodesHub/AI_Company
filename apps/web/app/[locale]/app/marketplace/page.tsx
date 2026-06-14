import type { Metadata } from 'next';
import { Star, Download } from 'lucide-react';

export const metadata: Metadata = { title: 'Marketplace' };

const categories = ['All','Agents','Workflows','Brand Voices','Prompts'];

const featured = [
  { title: 'Social Media Manager', description: 'Full social media pipeline: brand voice, content calendar, inbox replies.', category: 'Agents', installs: 0, stars: 0 },
  { title: 'Blog Publisher', description: 'AI writes, optimizes SEO, and publishes blog posts on a schedule.', category: 'Agents', installs: 0, stars: 0 },
  { title: 'Customer Support Bot', description: 'Handles DMs, comments, and reviews across all connected platforms.', category: 'Agents', installs: 0, stars: 0 },
  { title: 'Content Repurposer', description: 'Turn one blog post into a week of social media content.', category: 'Workflows', installs: 0, stars: 0 },
];

export default function MarketplacePage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <p className="text-muted-foreground mt-1">Pre-built agents, workflows, and brand voices from the community</p>
      </div>

      {/* Search + categories */}
      <div className="flex gap-4 mb-8">
        <input placeholder="Search templates…" className="flex-1 border border-border rounded-lg px-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
        <div className="flex gap-2">
          {categories.map(c => (
            <button key={c} className={`px-3 py-2 rounded-lg text-sm border transition-colors ${c === 'All' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>{c}</button>
          ))}
        </div>
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-2 gap-4">
        {featured.map(t => (
          <div key={t.title} className="bg-card border border-border rounded-xl p-6 hover:border-primary/40 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{t.category}</span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="w-3 h-3" />{t.stars}
              </div>
            </div>
            <h3 className="font-semibold mb-2">{t.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Download className="w-3 h-3" />{t.installs} installs</span>
              <button className="text-sm text-primary font-medium hover:underline">Install free →</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
