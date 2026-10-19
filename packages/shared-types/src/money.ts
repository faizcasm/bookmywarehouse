/** Currency is stored explicitly; all amounts are integer minor units (paise for INR). */
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = 'INR';

const MINOR_UNITS: Record<Currency, number> = {
  INR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  AED: 2,
};

/** Convert a major-unit amount (e.g. 1250.50) into minor units (125050). */
export function toMinorUnits(major: number, currency: Currency = DEFAULT_CURRENCY): number {
  const factor = 10 ** MINOR_UNITS[currency];
  return Math.round(major * factor);
}

/** Convert minor units back to a major-unit number. Only for display/serialization. */
export function toMajorUnits(minor: number, currency: Currency = DEFAULT_CURRENCY): number {
  const factor = 10 ** MINOR_UNITS[currency];
  return minor / factor;
}

/**
 * Deterministic banker-free rounding for tax/fee splits.
 * Keeps the sum of parts equal to the total (last part absorbs the remainder).
 */
export function splitProportionally(total: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return [];
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  if (weightSum <= 0) return weights.map(() => 0);
  const parts = weights.map((w) => Math.floor((total * w) / weightSum));
  let remainder = total - parts.reduce((sum, p) => sum + p, 0);
  for (let i = 0; parts.length > 0 && remainder > 0; i = (i + 1) % parts.length) {
    parts[i] += 1;
    remainder -= 1;
  }
  return parts;
}

export function formatMoney(
  minor: number,
  currency: Currency = DEFAULT_CURRENCY,
  locale = 'en-IN',
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: MINOR_UNITS[currency],
    }).format(toMajorUnits(minor, currency));
  } catch {
    return `${currency} ${toMajorUnits(minor, currency).toFixed(2)}`;
  }
}
