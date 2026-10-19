import type { CSSProperties, ReactNode } from 'react';

export function Skeleton({
  height = 16,
  width = '100%',
  radius = 8,
  className = '',
}: {
  height?: number | string;
  width?: number | string;
  radius?: number;
  className?: string;
}) {
  const style: CSSProperties = { height, width, borderRadius: radius };
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cards" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="card listing-card skeleton-card" key={index}>
          <Skeleton height={170} radius={0} />
          <div className="listing-card-body">
            <Skeleton height={14} width="40%" />
            <Skeleton height={20} width="85%" />
            <Skeleton height={14} width="60%" />
            <Skeleton height={14} width="50%" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
  icon = '📭',
}: {
  title: string;
  message?: ReactNode;
  action?: ReactNode;
  icon?: string;
}) {
  return (
    <div className="state-block">
      <div className="state-icon" aria-hidden="true">
        {icon}
      </div>
      <h3 className="state-title">{title}</h3>
      {message ? <p className="state-message">{message}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-block state-error" role="alert">
      <div className="state-icon" aria-hidden="true">
        ⚠️
      </div>
      <h3 className="state-title">Something went wrong</h3>
      <p className="state-message">{message || 'Unable to load data. Please try again.'}</p>
      {onRetry ? (
        <button type="button" className="btn btn-outline" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
