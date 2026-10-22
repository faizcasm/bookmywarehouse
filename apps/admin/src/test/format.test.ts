import { describe, expect, it } from 'vitest';
import {
  formatMoney,
  formatMoneyCompact,
  statusLabel,
  toneFor,
} from '../lib/format';

describe('formatMoney', () => {
  it('formats minor units (paise) as en-IN currency', () => {
    expect(formatMoney(1593000)).toBe('₹15,930.00');
    expect(formatMoney(0)).toBe('₹0.00');
    expect(formatMoney(100)).toBe('₹1.00');
    expect(formatMoney(999999999)).toBe('₹99,99,999.99');
  });

  it('treats null/undefined/NaN as zero', () => {
    expect(formatMoney(null)).toBe('₹0.00');
    expect(formatMoney(undefined)).toBe('₹0.00');
    expect(formatMoney(Number.NaN)).toBe('₹0.00');
  });

  it('supports an explicit currency', () => {
    expect(formatMoney(25000, 'USD')).toBe('$250.00');
  });

  it('compacts large values', () => {
    expect(formatMoneyCompact(1593000)).toBe('₹15.9 K'); // ₹15,930
    expect(formatMoneyCompact(2905160)).toBe('₹29.1 K'); // ₹29,051.60
    expect(formatMoneyCompact(150_000_000)).toBe('₹15.0 L'); // ₹15,00,000
    expect(formatMoneyCompact(25_000_000_000)).toBe('₹25.0 Cr'); // ₹25,00,00,000
  });
});

describe('statusLabel', () => {
  it('humanises SCREAMING_SNAKE_CASE', () => {
    expect(statusLabel('PENDING_APPROVAL')).toBe('Pending approval');
    expect(statusLabel('RESOLVED_CUSTOMER')).toBe('Resolved customer');
    expect(statusLabel('ACTIVE')).toBe('Active');
  });
});

describe('badge tone maps', () => {
  it('maps booking statuses to the cross-console tone contract', () => {
    // These tones must match apps/customer and apps/partner exactly — the
    // same booking status renders with the same colour in all three apps.
    expect(toneFor('booking', 'PENDING_APPROVAL')).toBe('warning');
    expect(toneFor('booking', 'AWAITING_PAYMENT')).toBe('info');
    expect(toneFor('booking', 'CONFIRMED')).toBe('success');
    expect(toneFor('booking', 'IN_PROGRESS')).toBe('info');
    expect(toneFor('booking', 'COMPLETED')).toBe('success');
    expect(toneFor('booking', 'CANCELLED')).toBe('neutral');
    expect(toneFor('booking', 'REJECTED')).toBe('danger');
    expect(toneFor('booking', 'REFUND_PENDING')).toBe('warning');
    expect(toneFor('booking', 'REFUNDED')).toBe('neutral');
    expect(toneFor('booking', 'DISPUTED')).toBe('danger');
  });

  it('renders role badges in distinct hues', () => {
    // --info and --accent are the same blue in the token layer, so roles must
    // not rely on them interchangeably.
    expect(toneFor('role', 'CUSTOMER')).toBe('info');
    expect(toneFor('role', 'PARTNER')).not.toBe(toneFor('role', 'CUSTOMER'));
    expect(toneFor('role', 'ADMIN')).toBe('danger');
  });

  it('maps listing statuses', () => {
    expect(toneFor('listing', 'PUBLISHED')).toBe('success');
    expect(toneFor('listing', 'PENDING_REVIEW')).toBe('warning');
    expect(toneFor('listing', 'REJECTED')).toBe('danger');
    expect(toneFor('listing', 'SUSPENDED')).toBe('danger');
  });

  it('maps payment statuses', () => {
    expect(toneFor('payment', 'SUCCEEDED')).toBe('success');
    expect(toneFor('payment', 'FAILED')).toBe('danger');
    expect(toneFor('payment', 'PENDING')).toBe('warning');
  });

  it('maps account statuses', () => {
    expect(toneFor('account', 'ACTIVE')).toBe('success');
    expect(toneFor('account', 'SUSPENDED')).toBe('danger');
    expect(toneFor('account', 'DEACTIVATED')).toBe('neutral');
  });

  it('maps KYC verification statuses', () => {
    expect(toneFor('verification', 'VERIFIED')).toBe('success');
    expect(toneFor('verification', 'SUBMITTED')).toBe('info');
    expect(toneFor('verification', 'UNDER_REVIEW')).toBe('warning');
    expect(toneFor('verification', 'REJECTED')).toBe('danger');
  });

  it('falls back to neutral for unknown statuses', () => {
    expect(toneFor('booking', 'SOMETHING_NEW')).toBe('neutral');
    expect(toneFor('listing', undefined)).toBe('neutral');
    expect(toneFor('dispute', '')).toBe('neutral');
  });
});
