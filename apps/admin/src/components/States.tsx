import type { ReactNode } from 'react';
import { ApiError } from '../lib/api';

export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton__row" style={{ width: `${94 - (i % 4) * 8}%` }} />
      ))}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        ∅
      </div>
      <h3 className="empty-state__title">{title}</h3>
      {hint ? <p className="empty-state__hint">{hint}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Something went wrong.';
  const issues = error instanceof ApiError && error.issues.length > 0 ? error.issues : null;
  return (
    <div className="error-state" role="alert">
      <div className="error-state__icon" aria-hidden="true">
        !
      </div>
      <div>
        <h3 className="error-state__title">Couldn&apos;t load this view</h3>
        <p className="error-state__message">{message}</p>
        {issues ? (
          <ul className="error-state__issues">
            {issues.map((iss, i) => (
              <li key={i}>
                <strong>{iss.path}</strong>: {iss.message}
              </li>
            ))}
          </ul>
        ) : null}
        {onRetry ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-header__title">{title}</h1>
        {subtitle ? <p className="page-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
