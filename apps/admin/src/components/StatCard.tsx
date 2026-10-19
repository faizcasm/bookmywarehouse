import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  /** Optional link target for quick navigation. */
  to?: string;
  tone?: 'default' | 'warning' | 'danger' | 'success';
  icon?: ReactNode;
}

export function StatCard({ label, value, hint, to, tone = 'default', icon }: StatCardProps) {
  const body = (
    <>
      <div className="stat-card__head">
        <span className="stat-card__label">{label}</span>
        {icon ? <span className="stat-card__icon" aria-hidden="true">{icon}</span> : null}
      </div>
      <div className="stat-card__value">{value}</div>
      {hint ? <div className="stat-card__hint">{hint}</div> : null}
    </>
  );

  const className = `stat-card stat-card--${tone}`;

  if (to) {
    return (
      <Link to={to} className={`${className} stat-card--link`}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

interface RevenueBlockProps {
  items: { label: string; value: string; sub?: string; tone?: string }[];
  caption?: string;
}

export function RevenueBlock({ items, caption }: RevenueBlockProps) {
  return (
    <div className="revenue-block">
      {items.map((item) => (
        <div key={item.label} className={`revenue-block__item ${item.tone ? `revenue-block__item--${item.tone}` : ''}`}>
          <span className="revenue-block__label">{item.label}</span>
          <span className="revenue-block__value">{item.value}</span>
          {item.sub ? <span className="revenue-block__sub">{item.sub}</span> : null}
        </div>
      ))}
      {caption ? <p className="revenue-block__caption">{caption}</p> : null}
    </div>
  );
}
