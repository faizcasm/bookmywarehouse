import type { ReactNode } from 'react';

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  to,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  to?: string;
}) {
  const body = (
    <>
      <div className="stat-card__top">
        <span className="stat-card__label">{label}</span>
        {icon ? (
          <span className={`stat-card__icon stat-card__icon--${tone}`} aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="stat-card__value">{value}</div>
      {hint ? <div className="stat-card__hint">{hint}</div> : null}
    </>
  );
  if (to) {
    return (
      <a className={`card stat-card stat-card--link stat-card--${tone}`} href={to}>
        {body}
      </a>
    );
  }
  return <div className={`card stat-card stat-card--${tone}`}>{body}</div>;
}
