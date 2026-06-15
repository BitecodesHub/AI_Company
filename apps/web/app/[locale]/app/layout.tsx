import type { ReactNode } from 'react';
import { Sidebar } from '../../../src/components/shell/sidebar';
import { ChecklistDock } from '../../../src/components/onboarding/checklist-dock';
import { CommandPalette } from '../../../src/components/shell/command-palette';

interface AppLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AppLayout({ children, params }: AppLayoutProps) {
  const { locale } = await params;
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar locale={locale} />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
      {/* Floating getting-started checklist (hides once complete). */}
      <ChecklistDock />
      {/* AI Controller + command palette (⌘K, sidebar button, bitecodes:open-controller event). */}
      <CommandPalette />
    </div>
  );
}
