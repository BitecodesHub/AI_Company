import type { Metadata } from 'next';
import Link from 'next/link';
import { Building, Users, Mail, Plug, SlidersHorizontal, Activity } from 'lucide-react';
import { BrandingCard } from '../../../../src/components/settings/branding-card';

export const metadata: Metadata = { title: 'Settings' };

// Each section links to a destination that actually exists — no dead ends.
const sections = [
  { icon: Building, label: 'Organization', desc: 'Workspace name, slug, and branding', href: '/app/admin/workspace' },
  { icon: Users, label: 'Team & members', desc: 'Invite, manage roles, and deactivate members', href: '/app/admin/members' },
  { icon: Mail, label: 'Invitations', desc: 'Pending invites to your workspace', href: '/app/admin/invitations' },
  { icon: Plug, label: 'Connectors', desc: 'Connect social accounts and third-party tools', href: '/app/connectors' },
  { icon: SlidersHorizontal, label: 'Advanced', desc: 'API keys, security, and power-user settings', href: '/app/admin/advanced' },
  { icon: Activity, label: 'System health', desc: 'Database, cache, and provider status', href: '/app/admin/system' },
];

export default function SettingsPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your workspace and account preferences.</p>
      </div>
      <BrandingCard />
      <div className="space-y-2">
        {sections.map((s) => (
          <Link key={s.label} href={s.href}
            className="w-full flex items-center gap-4 p-4 border border-border rounded-xl text-left hover:border-primary/40 hover:bg-muted/50 transition-colors group">
            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <s.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <div className="font-medium text-sm">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.desc}</div>
            </div>
            <span className="ml-auto text-muted-foreground group-hover:text-foreground">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
