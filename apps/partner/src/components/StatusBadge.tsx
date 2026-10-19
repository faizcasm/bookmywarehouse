import { humanize, statusTone, type BadgeKind } from '../lib/format';

export function StatusBadge({ value, kind = 'generic', className = '' }: { value: string | null | undefined; kind?: BadgeKind; className?: string }) {
  if (!value) return <span className="badge badge--neutral">—</span>;
  const tone = statusTone(kind, value);
  return (
    <span className={`badge badge--${tone} ${className}`.trim()} data-status={value}>
      {humanize(value)}
    </span>
  );
}

export function RatingStars({ value, count }: { value: number; count?: number }) {
  const rounded = Math.round(value);
  return (
    <span className="rating" title={`${value} out of 5`}>
      <span aria-hidden="true" className="rating__stars">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className={index < rounded ? 'rating__star rating__star--on' : 'rating__star'}>
            ★
          </span>
        ))}
      </span>
      <span className="rating__value">
        {value > 0 ? value.toFixed(1) : 'New'}
        {count !== undefined ? ` (${count})` : ''}
      </span>
    </span>
  );
}
