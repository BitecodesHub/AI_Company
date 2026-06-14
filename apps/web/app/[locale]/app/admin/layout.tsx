'use client';

/**
 * Admin shell — a sub-nav layered inside the main app shell (sidebar stays).
 * Advanced/org-level settings live here, gated to admins/owners. The client gate
 * is cosmetic; every /v1/admin and /v1/members mutation is enforced server-side.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { Users, Mail, Building2, SlidersHorizontal, ShieldAlert, Activity } from 'lucide-react';
import { useMe } from '../../../../src/hooks/use-me';
import { roleAtLeast } from '../../../../src/lib/rbac';

const TABS = [
  { seg: 'members', label: 'Members', icon: Users },
  { seg: 'invitations', label: 'Invitations', icon: Mail },
  { seg: 'workspace', label: 'Workspace', icon: Building2 },
  { seg: 'system', label: 'System', icon: Activity },
  { seg: 'advanced', label: 'Advanced', icon: SlidersHorizontal },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.locale as string) ?? 'en';
  const { data, isLoading } = useMe();
  const isAdmin = roleAtLeast(data?.role ?? 'viewer', 'admin');

  if (isLoading) {
    return <div className="p-8 max-w-6xl mx-auto"><div className="h-8 w-40 bg-muted rounded animate-pulse" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="border-2 border-dashed border-border rounded-2xl p-16 text-center">
          <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7 text-destructive" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Admins only</h3>
          <p className="text-muted-foreground text-sm">You need an admin or owner role to manage this organization.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground mt-1 text-sm">Manage members, invitations, and workspace settings.</p>
      </div>

      <nav className="flex gap-1 border-b border-border mb-6" data-testid="admin-subnav">
        {TABS.map((t) => {
          const href = `/${locale}/app/admin/${t.seg}`;
          const active = pathname.startsWith(href);
          return (
            <Link
              key={t.seg}
              href={href}
              data-testid={`admin-tab-${t.seg}`}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
