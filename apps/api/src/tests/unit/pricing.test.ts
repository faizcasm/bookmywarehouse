import { describe, expect, it } from 'vitest';

import {
  billableDays,
  computeQuote,
  partnerPayoutMinor,
  periodCount,
  type QuoteInput,
} from '../../services/pricing.service.js';

const settings = { platformFeePercent: 10, taxPercent: 18, customerFeePercent: 0 } as const;

function baseInput(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
    price: { model: 'PER_DAY', amountMinor: 100_00, currency: 'INR', period: 'DAY' },
    startDate: new Date('2026-03-10T00:00:00.000Z'),
    endDate: new Date('2026-03-13T00:00:00.000Z'),
    quantity: 1,
    settings,
    ...overrides,
  };
}

describe('billableDays', () => {
  it('returns 1 when there is no end date', () => {
    expect(billableDays(new Date())).toBe(1);
  });

  it('rounds partial days up', () => {
    const start = new Date('2026-03-10T10:00:00.000Z');
    const end = new Date('2026-03-11T09:00:00.000Z'); // 23 hours
    expect(billableDays(start, end)).toBe(1);
  });

  it('counts full days for multi-day ranges', () => {
    expect(
      billableDays(new Date('2026-03-10T00:00:00.000Z'), new Date('2026-03-13T00:00:00.000Z')),
    ).toBe(3);
  });
});

describe('periodCount', () => {
  it('counts weeks by rounding up', () => {
    expect(
      periodCount(
        new Date('2026-03-10T00:00:00.000Z'),
        new Date('2026-03-25T00:00:00.000Z'),
        'WEEK',
      ),
    ).toBe(3);
  });

  it('counts months inclusively', () => {
    expect(
      periodCount(
        new Date('2026-01-15T00:00:00.000Z'),
        new Date('2026-04-01T00:00:00.000Z'),
        'MONTH',
      ),
    ).toBe(3);
  });

  it('never returns zero', () => {
    const now = new Date('2026-03-10T00:00:00.000Z');
    expect(periodCount(now, now, 'DAY')).toBe(1);
  });
});

describe('computeQuote', () => {
  it('computes day-based pricing with integer arithmetic', () => {
    const quote = computeQuote(baseInput());
    // ₹100/day × 1 × 3 days
    expect(quote.subtotalMinor).toBe(30_000);
    expect(quote.platformFeeMinor).toBe(3_000); // 10%
    expect(quote.taxesMinor).toBe(5_400); // 18% of subtotal
    expect(quote.totalMinor).toBe(35_400); // subtotal + taxes
    expect(quote.totalMinor).toBe(quote.subtotalMinor + quote.taxesMinor);
    expect(quote.periods).toBe(3);
  });

  it('applies quantity as a multiplier for PER_DAY pricing', () => {
    const quote = computeQuote(baseInput({ quantity: 3 }));
    expect(quote.subtotalMinor).toBe(90_000);
    expect(quote.billableUnits).toBe(3);
  });

  it('adds operator charges before tax', () => {
    const quote = computeQuote(
      baseInput({
        operatorRequired: true,
        price: {
          model: 'PER_DAY',
          amountMinor: 100_00,
          currency: 'INR',
          period: 'DAY',
          operatorChargePerDayMinor: 50_00,
        },
      }),
    );
    // base 300 + operator ₹50 × 3 days = 450
    expect(quote.subtotalMinor).toBe(45_000);
    expect(quote.taxesMinor).toBe(Math.round(45_000 * 0.18));
    expect(quote.breakdown.some((line) => line.label.includes('Operator'))).toBe(true);
  });

  it('includes taxable additional charges in the subtotal', () => {
    const quote = computeQuote(
      baseInput({
        price: {
          model: 'PER_DAY',
          amountMinor: 100_00,
          currency: 'INR',
          period: 'DAY',
          additionalCharges: [
            { label: 'Power surcharge', amountMinor: 1_000, taxable: true },
            { label: 'Freebie', amountMinor: 0, taxable: false },
          ],
        },
      }),
    );
    expect(quote.subtotalMinor).toBe(31_000);
    expect(quote.breakdown).toHaveLength(3); // base rate + charge + GST line
  });

  it('charges FIXED pricing once per period regardless of quantity', () => {
    const quote = computeQuote(
      baseInput({ quantity: 5, price: { model: 'FIXED', amountMinor: 200_00, currency: 'INR', period: 'DAY' } }),
    );
    expect(quote.billableUnits).toBe(1);
    expect(quote.subtotalMinor).toBe(60_000);
  });

  it('scales PER_SQFT pricing by requested capacity', () => {
    const quote = computeQuote(
      baseInput({
        capacity: 500,
        price: { model: 'PER_SQFT', amountMinor: 10, currency: 'INR', period: 'DAY' },
      }),
    );
    expect(quote.billableUnits).toBe(500);
    expect(quote.subtotalMinor).toBe(500 * 10 * 3);
  });

  it('includes customer service fee in taxes when configured', () => {
    const quote = computeQuote(baseInput({ settings: { ...settings, customerFeePercent: 5 } }));
    expect(quote.taxesMinor).toBe(Math.round((30_000 + 1_500) * 0.18));
    expect(quote.totalMinor).toBe(quote.subtotalMinor + quote.taxesMinor);
  });

  it('never produces negative or fractional minor units', () => {
    const quote = computeQuote(baseInput({ price: { model: 'PER_DAY', amountMinor: 33, currency: 'INR', period: 'DAY' } }));
    expect(Number.isInteger(quote.totalMinor)).toBe(true);
    expect(quote.totalMinor).toBeGreaterThan(0);
  });
});

describe('partnerPayoutMinor', () => {
  it('pays out subtotal minus platform fee', () => {
    expect(partnerPayoutMinor({ subtotalMinor: 100_000, platformFeeMinor: 10_000 })).toBe(90_000);
  });

  it('never goes negative', () => {
    expect(partnerPayoutMinor({ subtotalMinor: 100, platformFeeMinor: 500 })).toBe(0);
  });
});
