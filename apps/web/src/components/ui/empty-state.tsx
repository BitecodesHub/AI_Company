import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: Array<{ label: string; href?: string; onClick?: () => void; primary?: boolean }>;
}

export function EmptyState({ icon: Icon, title, description, actions }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>}
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {actions.map((a) =>
            a.href ? (
              <Link
                key={a.label}
                href={a.href}
                className={a.primary
                  ? 'px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors'
                  : 'px-4 py-2 rounded-xl text-sm font-medium border border-border hover:bg-muted transition-colors'
                }
              >
                {a.label}
              </Link>
            ) : (
              <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                className={a.primary
                  ? 'px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors'
                  : 'px-4 py-2 rounded-xl text-sm font-medium border border-border hover:bg-muted transition-colors'
                }
              >
                {a.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
