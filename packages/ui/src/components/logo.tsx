import * as React from 'react';
import { cn } from '../lib/utils';

export interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Wordmark text. Apps should pass `process.env.NEXT_PUBLIC_BRAND_NAME` so the
   * mark white-labels per tenant. Defaults to "Bitecodes".
   */
  name?: string;
  /** Render only the square mark, without the wordmark text. */
  markOnly?: boolean;
  /** Square mark size in px. */
  size?: number;
}

/**
 * Theme-aware brand mark. The mark uses the `--color-primary` token (via the
 * `bg-primary` utility) so it follows the active theme and any white-label
 * primary-colour override. The wordmark is text-driven for i18n / white-label.
 */
export const Logo = React.forwardRef<HTMLDivElement, LogoProps>(
  ({ name = 'Bitecodes', markOnly = false, size = 32, className, ...props }, ref) => {
    const initial = (name.trim()[0] ?? 'B').toUpperCase();
    return (
      <div ref={ref} className={cn('flex items-center gap-2.5', className)} {...props}>
        <span
          aria-hidden
          className="flex flex-shrink-0 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground shadow-sm shadow-primary/25 transition-transform"
          style={{ width: size, height: size, fontSize: size * 0.44 }}
        >
          {initial}
        </span>
        {!markOnly && (
          <span className="text-lg font-bold tracking-tight text-foreground">{name}</span>
        )}
      </div>
    );
  },
);
Logo.displayName = 'Logo';
