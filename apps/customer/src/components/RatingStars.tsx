import { useState } from 'react';
import { formatNumber } from '../lib/format';

export interface RatingStarsProps {
  value: number;
  count?: number;
  size?: 'sm' | 'md';
  interactive?: boolean;
  onChange?: (value: number) => void;
  label?: string;
}

function starClass(filled: number, index: number): 'star-filled' | 'star-half' | 'star-empty' {
  if (filled >= index + 1) return 'star-filled';
  if (filled >= index + 0.5) return 'star-half';
  return 'star-empty';
}

export function RatingStars({ value, count, size = 'sm', interactive, onChange, label }: RatingStarsProps) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;

  if (interactive) {
    return (
      <div className="rating-stars rating-interactive" role="radiogroup" aria-label={label ?? 'Rating'}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            className={`star-btn ${star <= display ? 'is-filled' : ''}`}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(star)}
            onBlur={() => setHover(null)}
            onClick={() => onChange?.(star)}
          >
            {star <= display ? '★' : '☆'}
          </button>
        ))}
      </div>
    );
  }

  return (
    <span className={`rating-stars rating-${size}`} title={`${formatNumber(value, 1)} out of 5`}>
      <span aria-hidden="true" className="stars">
        {[0, 1, 2, 3, 4].map((index) => (
          <span key={index} className={starClass(value, index)}>
            {value >= index + 0.5 ? '★' : '☆'}
          </span>
        ))}
      </span>
      <span className="rating-value">{formatNumber(value, 1)}</span>
      {count !== undefined ? <span className="rating-count">({count})</span> : null}
    </span>
  );
}
