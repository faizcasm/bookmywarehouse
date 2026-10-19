import type { CSSProperties, ReactNode } from 'react';
import { errorMessage } from '../lib/api';

export function Skeleton({
  width = '100%',
  height = '1rem',
  radius = 'var(--radius-sm)',
  style,
}: {
  width?: string;
  height?: string;
  radius?: string;
  style?: CSSProperties;
}) {
  return <span className="skeleton" style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />;
}

export function ListSkeleton({ rows = 5, height = '3.25rem' }: { rows?: number; height?: string }) {
  return (
    <div className="skeleton-list" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height={height} />
      ))}
    </div>
  );
}

export function StatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="stat-grid" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, index) => (
        <div className="card stat-card" key={index}>
          <Skeleton width="60%" height="0.8rem" />
          <Skeleton width="40%" height="1.7rem" style={{ marginTop: '0.75rem' }} />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        {icon ?? '□'}
      </div>
      <h3 className="empty-state__title">{title}</h3>
      {description ? <p className="empty-state__description">{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Could not load data' }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div className="error-state" role="alert">
      <div className="error-state__icon" aria-hidden="true">
        !
      </div>
      <div className="error-state__body">
        <strong>{title}</strong>
        <p>{errorMessage(error)}</p>
      </div>
      {onRetry ? (
        <button type="button" className="btn btn--secondary" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
