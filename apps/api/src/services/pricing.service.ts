import type { PricingModel, PricingPeriod } from '@bmw/shared-types';
import type { SettingsDoc } from './settings.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PricingSource {
  model: PricingModel;
  amountMinor: number;
  currency: string;
  period: PricingPeriod | null;
  unitLabel?: string | null;
  additionalCharges?: { label: string; amountMinor: number; taxable: boolean }[];
  operatorChargePerDayMinor?: number | null;
}

export interface QuoteInput {
  price: PricingSource;
  startDate: Date;
  endDate?: Date | null;
  /** Requested capacity (sq.ft, pallets, ...) for capacity-priced listings. */
  capacity?: number | null;
  quantity: number;
  operatorRequired?: boolean;
  settings: Pick<SettingsDoc, 'platformFeePercent' | 'taxPercent' | 'customerFeePercent'>;
}

export interface QuoteLine {
  label: string;
  amountMinor: number;
}

export interface QuoteResult {
  currency: string;
  subtotalMinor: number;
  platformFeeMinor: number;
  taxesMinor: number;
  discountMinor: number;
  totalMinor: number;
  breakdown: QuoteLine[];
  rateDescription: string;
  billableUnits: number;
  billableUnitLabel: string;
  periods: number;
  periodUnit: PricingPeriod;
}

export function billableDays(start: Date, end?: Date | null): number {
  if (!end) return 1;
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diff / DAY_MS));
}

/** Number of chargeable periods (min 1) for the requested interval. */
export function periodCount(
  start: Date,
  end: Date | null | undefined,
  period: PricingPeriod,
): number {
  if (!end) return 1;
  const days = billableDays(start, end);
  switch (period) {
    case 'HOUR': {
      const hours = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (60 * 60 * 1000)));
      return hours;
    }
    case 'DAY':
      return days;
    case 'WEEK':
      return Math.max(1, Math.ceil(days / 7));
    case 'MONTH': {
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      const anchor = new Date(start);
      anchor.setMonth(anchor.getMonth() + months);
      const partial = end.getTime() > anchor.getTime();
      return Math.max(1, months + (partial ? 1 : 0));
    }
    case 'YEAR': {
      const years = end.getFullYear() - start.getFullYear();
      const anchor = new Date(start);
      anchor.setFullYear(anchor.getFullYear() + years);
      const partial = end.getTime() > anchor.getTime();
      return Math.max(1, years + (partial ? 1 : 0));
    }
    default:
      return Math.max(1, days);
  }
}

const UNIT_LABELS: Record<PricingModel, string> = {
  FIXED: 'booking',
  PER_SQFT: 'sq.ft',
  PER_SQMT: 'sq.m',
  PER_PALLET: 'pallet',
  PER_UNIT: 'unit',
  PER_HOUR: 'hour',
  PER_DAY: 'day',
};

/**
 * Server-side pricing engine. All arithmetic happens on integer minor units to
 * avoid floating point drift in money handling.
 */
export function computeQuote(input: QuoteInput): QuoteResult {
  const { price, settings } = input;
  const period: PricingPeriod = price.period ?? 'DAY';
  const periods = periodCount(input.startDate, input.endDate, period);

  let units = Math.max(1, input.quantity);
  let unitLabel = UNIT_LABELS[price.model];

  switch (price.model) {
    case 'FIXED':
      units = 1;
      unitLabel = period.toLowerCase();
      break;
    case 'PER_SQFT':
    case 'PER_SQMT':
      units = Math.max(1, Math.ceil(input.capacity ?? 0));
      break;
    case 'PER_PALLET':
    case 'PER_UNIT':
      units = Math.max(1, input.quantity);
      break;
    case 'PER_HOUR':
    case 'PER_DAY':
      units = Math.max(1, input.quantity);
      break;
  }

  const baseAmount = price.amountMinor * units * periods;

  const breakdown: QuoteLine[] = [
    {
      label: `${price.unitLabel ?? `${price.model.toLowerCase().replace('_', ' ')} rate`} × ${units} ${unitLabel} × ${periods} ${period.toLowerCase()}`,
      amountMinor: baseAmount,
    },
  ];

  let subtotal = baseAmount;

  if (input.operatorRequired && price.operatorChargePerDayMinor) {
    const days = billableDays(input.startDate, input.endDate);
    const operatorAmount = price.operatorChargePerDayMinor * days;
    subtotal += operatorAmount;
    breakdown.push({ label: `Operator charge × ${days} day(s)`, amountMinor: operatorAmount });
  }

  for (const charge of price.additionalCharges ?? []) {
    if (charge.amountMinor <= 0) continue;
    subtotal += charge.amountMinor;
    breakdown.push({ label: charge.label, amountMinor: charge.amountMinor });
  }

  const platformFee = Math.round((subtotal * settings.platformFeePercent) / 100);
  const customerFee =
    settings.customerFeePercent > 0
      ? Math.round((subtotal * settings.customerFeePercent) / 100)
      : 0;
  if (customerFee > 0) {
    breakdown.push({ label: 'Service fee', amountMinor: customerFee });
  }
  const taxes = Math.round(((subtotal + customerFee) * settings.taxPercent) / 100);
  if (taxes > 0) {
    breakdown.push({ label: `GST @ ${settings.taxPercent}%`, amountMinor: taxes });
  }

  const total = subtotal + taxes;

  const rateDescription = `${(price.amountMinor / 100).toLocaleString('en-IN', {
    style: 'currency',
    currency: price.currency || 'INR',
  })} ${price.unitLabel ?? `per ${unitLabel}`} × ${units} × ${periods} ${period.toLowerCase()}`;

  return {
    currency: price.currency || 'INR',
    subtotalMinor: subtotal,
    platformFeeMinor: platformFee,
    taxesMinor: taxes,
    discountMinor: 0,
    totalMinor: total,
    breakdown,
    rateDescription,
    billableUnits: units,
    billableUnitLabel: unitLabel,
    periods,
    periodUnit: period,
  };
}

/** Payout owed to the partner for a completed booking. */
export function partnerPayoutMinor(quote: Pick<QuoteResult, 'subtotalMinor' | 'platformFeeMinor'>): number {
  return Math.max(0, quote.subtotalMinor - quote.platformFeeMinor);
}
