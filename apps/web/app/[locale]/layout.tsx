import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { Providers } from '../../src/components/providers';

const DEFAULT_THEME = process.env.NEXT_PUBLIC_DEFAULT_THEME ?? 'light';

export default function LocaleLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme={DEFAULT_THEME} enableSystem>
      <Providers>
        {children}
      </Providers>
    </ThemeProvider>
  );
}
