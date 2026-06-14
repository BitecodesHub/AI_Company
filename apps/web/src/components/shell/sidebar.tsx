'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Users, Workflow, Inbox, LayoutDashboard, BookOpen,
  Rss, Settings, ChevronDown, Zap, BarChart2, Store, Plug,
  LogOut, Moon, Sun, ShieldCheck, BadgeCheck, MessagesSquare,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Logo } from '@bitecodes/ui';
import { signOut } from '../../lib/auth-client';
import { roleAtLeast, type Role } from '../../lib/rbac';
import { useMe } from '../../hooks/use-me';

type NavItem = {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  exact?: boolean;
  minRole: Role;
};

// The five primary "AI company" destinations. "Employees" is a LABEL only — the
// route stays /app/agents (the agents table / agent/run event are never renamed).
// Primary destinations are the core app and stay visible to everyone (floor
// `viewer`); privileged actions inside each page are gated server-side.
const PRIMARY_NAV: NavItem[] = [
  { href: '/app/dashboard',  icon: LayoutDashboard, label: 'Dashboard',  exact: true, minRole: 'viewer' },
  { href: '/app/agents',     icon: Users,           label: 'Employees',               minRole: 'viewer' },
  { href: '/app/knowledge',  icon: BookOpen,        label: 'Knowledge',               minRole: 'viewer' },
  { href: '/app/connectors', icon: Plug,            label: 'Connectors',              minRole: 'viewer' },
  { href: '/app/settings',   icon: Settings,        label: 'Settings',                minRole: 'viewer' },
];

// Secondary / advanced surfaces, demoted into a collapsible "More" group so
// beginners see only the five essentials. Routes are unchanged and remain
// directly reachable; nothing is deleted.
const MORE_NAV: NavItem[] = [
  { href: '/app/company',     icon: MessagesSquare, label: 'Company chat', minRole: 'member' },
  { href: '/app/approvals',   icon: BadgeCheck, label: 'Approvals',  minRole: 'member' },
  { href: '/app/workflows',   icon: Workflow,  label: 'Workflows',  minRole: 'member' },
  { href: '/app/content',     icon: Rss,       label: 'Content',    minRole: 'member' },
  { href: '/app/inbox',       icon: Inbox,     label: 'Inbox',      minRole: 'member' },
  { href: '/app/marketplace', icon: Store,     label: 'Templates',  minRole: 'member' },
  { href: '/app/analytics',   icon: BarChart2, label: 'Analytics',  minRole: 'viewer' },
];

const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Bitecodes';

interface SidebarProps {
  locale: string;
}

export function Sidebar({ locale }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Real session (GET /v1/me). Until it resolves, fail CLOSED at `viewer` so
  // privileged nav stays hidden; server-side RBAC is the real enforcement.
  const { data } = useMe();
  const me = {
    role: (data?.role ?? 'viewer') as Role,
    workspaceName: data?.workspace?.name ?? data?.org?.name ?? 'Workspace',
    plan: data?.org ? 'Workspace' : 'Free plan',
    userName: data?.user?.name ?? 'Account',
    userEmail: data?.user?.email ?? '',
  };
  const isAdmin = roleAtLeast(me.role, 'admin');

  const visibleMore = MORE_NAV.filter((item) => roleAtLeast(me.role, item.minRole));

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  function renderItem(item: NavItem) {
    const href = `/${locale}${item.href}`;
    const isActive = item.exact ? pathname === href : pathname.startsWith(href);
    return (
      <Link
        key={item.href}
        href={href}
        data-testid={`nav-${item.label.toLowerCase()}`}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
          isActive
            ? 'bg-primary text-white font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent'
        }`}
      >
        <item.icon className="w-4 h-4 flex-shrink-0" />
        {item.label}
      </Link>
    );
  }

  return (
    <aside className="w-64 flex flex-col h-screen sticky top-0 border-r border-border bg-sidebar">
      {/* Header */}
      <div className="px-4 pt-5 pb-4">
        <Link href={`/${locale}`} className="flex items-center group">
          <Logo name={BRAND_NAME} size={32} className="transition-transform group-hover:scale-[1.03]" />
        </Link>
      </div>

      {/* Workspace */}
      <div className="px-3 pb-3">
        <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm hover:bg-sidebar-accent transition-colors group">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
            {me.workspaceName.charAt(0)}
          </div>
          <div className="min-w-0 text-left flex-1">
            <p className="truncate text-sm font-medium leading-none">{me.workspaceName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{me.plan}</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        </button>
      </div>

      <div className="h-px bg-border mx-3 mb-2" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto" data-testid="primary-nav">
        {PRIMARY_NAV.filter((item) => roleAtLeast(me.role, item.minRole)).map(renderItem)}

        {visibleMore.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              data-testid="more-toggle"
              aria-expanded={moreOpen}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all duration-150"
            >
              <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${moreOpen ? '' : '-rotate-90'}`} />
              More
            </button>
            {moreOpen && (
              <div className="mt-0.5 space-y-0.5" data-testid="more-nav">
                {visibleMore.map(renderItem)}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Admin — visible only to admins/owners (client gate is cosmetic; the
          server enforces RBAC on every /v1/admin and /v1/members mutation). */}
      {isAdmin && (
        <div className="px-3 pb-2">
          <Link
            href={`/${locale}/app/admin/members`}
            data-testid="nav-admin"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
              pathname.startsWith(`/${locale}/admin`)
                ? 'bg-primary text-white font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent'
            }`}
          >
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            Admin
          </Link>
        </div>
      )}

      {/* Footer */}
      <div className="px-3 py-3 space-y-1.5 border-t border-border">
        <button className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400 rounded-xl text-sm font-medium transition-colors border border-violet-200/50 dark:border-violet-500/20">
          <Zap className="w-4 h-4" />
          AI Controller
          <kbd className="ml-auto text-[10px] bg-white/50 dark:bg-black/20 px-1.5 py-0.5 rounded-md opacity-60">⌘K</kbd>
        </button>

        <div className="relative">
          <button onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm hover:bg-sidebar-accent transition-colors">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
              {me.userName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium truncate leading-none">{me.userName}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{me.userEmail}</p>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>

          {showUserMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-xl shadow-xl p-1 z-50">
              <button onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setShowUserMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <div className="h-px bg-border my-1" />
              <button onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-destructive/10 transition-colors text-destructive">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
