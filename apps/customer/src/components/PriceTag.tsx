import { formatMoney, periodWord } from '../lib/format';

export interface PriceTagProps {
  amount: number;
  currency?: string;
  unitLabel?: string | null;
  period?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showPer?: boolean;
}

export function PriceTag({ amount, currency = 'INR', unitLabel, period, size = 'md', showPer = true }: PriceTagProps) {
  const suffix = unitLabel || (period && showPer ? `per ${periodWord(period)}` : '');
  return (
    <span className={`price-tag price-${size}`}>
      <span className="price-amount">{formatMoney(amount, currency)}</span>
      {suffix ? <span className="price-unit">{suffix}</span> : null}
    </span>
  );
}
