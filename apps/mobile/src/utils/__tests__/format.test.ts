/**
 * Format contract tests — money (minor units) and the status → tone maps.
 *
 * The tone maps are a cross-console contract: the same booking/payment/…
 * status must render with the same colour in the web customer, partner and
 * admin apps and this mobile app. These values are locked to match
 * apps/customer/src/lib/format.ts.
 */

import {
  formatMoney,
  formatMoneyCompact,
  humanize,
  formatDaysOfWeek,
  BOOKING_STATUS_META,
  PAYMENT_STATUS_META,
  LISTING_STATUS_META,
  VERIFICATION_STATUS_META,
} from '../format';

describe('formatMoney', () => {
  it('formats minor units (paise) as en-IN currency', () => {
    expect(formatMoney(1593000)).toBe('₹15,930.00');
    expect(formatMoney(0)).toBe('₹0.00');
    expect(formatMoney(100)).toBe('₹1.00');
  });

  it('treats null/undefined as an em dash', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
  });

  it('supports an explicit currency', () => {
    expect(formatMoney(25000, 'USD')).toBe('$250.00');
  });

  it('compacts large values', () => {
    expect(formatMoneyCompact(150_000_000)).toBe('₹15.0 L');
    expect(formatMoneyCompact(25_000_000_000)).toBe('₹25.0 Cr');
  });
});

describe('humanize', () => {
  it('humanises SCREAMING_SNAKE_CASE', () => {
    expect(humanize('PENDING_APPROVAL')).toBe('Pending Approval');
    expect(humanize('RESOLVED_CUSTOMER')).toBe('Resolved Customer');
  });
});

describe('formatDaysOfWeek', () => {
  it('renders day abbreviations for a bitmask array', () => {
    expect(formatDaysOfWeek([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(formatDaysOfWeek([0, 6])).toBe('Weekends');
    expect(formatDaysOfWeek([])).toBe('Every day');
  });
});

describe('status → tone maps', () => {
  it('locks booking tones to the cross-console contract', () => {
    expect(BOOKING_STATUS_META.PENDING_APPROVAL).toEqual({ label: 'Pending approval', tone: 'warn' });
    expect(BOOKING_STATUS_META.AWAITING_PAYMENT).toEqual({ label: 'Awaiting payment', tone: 'info' });
    expect(BOOKING_STATUS_META.CONFIRMED).toEqual({ label: 'Confirmed', tone: 'success' });
    expect(BOOKING_STATUS_META.IN_PROGRESS).toEqual({ label: 'In progress', tone: 'info' });
    expect(BOOKING_STATUS_META.COMPLETED).toEqual({ label: 'Completed', tone: 'success' });
    expect(BOOKING_STATUS_META.CANCELLED!.tone).toBe('neutral');
    expect(BOOKING_STATUS_META.REJECTED!.tone).toBe('danger');
    expect(BOOKING_STATUS_META.DISPUTED!.tone).toBe('danger');
  });

  it('locks payment tones', () => {
    expect(PAYMENT_STATUS_META.SUCCEEDED!.tone).toBe('success');
    expect(PAYMENT_STATUS_META.FAILED!.tone).toBe('danger');
    expect(PAYMENT_STATUS_META.REFUNDED!.tone).toBe('neutral');
  });

  it('locks listing tones', () => {
    expect(LISTING_STATUS_META.PUBLISHED!.tone).toBe('success');
    expect(LISTING_STATUS_META.REJECTED!.tone).toBe('danger');
    expect(LISTING_STATUS_META.DRAFT!.tone).toBe('neutral');
  });

  it('locks verification tones', () => {
    expect(VERIFICATION_STATUS_META.VERIFIED!.tone).toBe('success');
    expect(VERIFICATION_STATUS_META.UNDER_REVIEW!.tone).toBe('info');
    expect(VERIFICATION_STATUS_META.REJECTED!.tone).toBe('danger');
  });
});
