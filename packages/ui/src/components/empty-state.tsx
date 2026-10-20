import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../cn';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message?: ReactNode;
  action?: ReactNode;
  /** Softer treatment for in-card empties. */
  compact?: boolean;
  className?: string;
}

/** Attractive empty state with icon halo + optional action. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-6 py-10' : 'px-6 py-16',
        className
      )}
    >
      <span className="relative mb-4 flex h-14 w-14 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-brand-soft" aria-hidden="true" />
        <span className="absolute inset-2 rounded-full bg-surface opacity-60 blur-[2px]" aria-hidden="true" />
        <Icon size={22} aria-hidden="true" className="relative text-brand-soft-fg" />
      </span>
      <h3 className="text-[15px] font-semibold text-fg-strong">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-sm text-muted">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Centered error state with retry affordance. */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
  className,
}: {
  title?: string;
  message?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5" strokeLinecap="round" />
          <path d="M12 16.5v.5" strokeLinecap="round" />
        </svg>
      </span>
      <h3 className="text-[15px] font-semibold text-fg-strong">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-sm text-muted">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-md border border-line bg-surface px-4 py-2 text-sm font-semibold text-fg shadow-sm transition-all duration-fast hover:border-line-strong hover:shadow-md active:scale-[0.98]"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
