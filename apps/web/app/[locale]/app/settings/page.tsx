import type { Metadata } from 'next';
import { User, Building, Plug, Shield, CreditCard, Palette, Bell } from 'lucide-react';

export const metadata: Metadata = { title: 'Settings' };

const sections = [
  { icon: User, label: 'Profile', desc: 'Manage your name, email, and password' },
  { icon: Building, label: 'Organization', desc: 'Organization name, slug, and branding' },
  { icon: Plug, label: 'Connectors', desc: 'Connect social accounts and third-party tools' },
  { icon: Shield, label: 'Security', desc: 'API keys, 2FA, and session management' },
  { icon: CreditCard, label: 'Billing', desc: 'Plan, usage, and invoices' },
  { icon: Palette, label: 'Appearance', desc: 'Theme, language, and display preferences' },
  { icon: Bell, label: 'Notifications', desc: 'Email and in-app notification settings' },
];

export default function SettingsPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your workspace and account preferences.</p>
      </div>
      <div className="space-y-2">
        {sections.map((s) => (
          <button key={s.label}
            className="w-full flex items-center gap-4 p-4 border border-border rounded-xl text-left hover:border-primary/40 hover:bg-muted/50 transition-colors group">
            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <s.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <div className="font-medium text-sm">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.desc}</div>
            </div>
            <span className="ml-auto text-muted-foreground group-hover:text-foreground">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}
