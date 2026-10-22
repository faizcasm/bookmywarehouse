import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  bookingStatusMeta,
  disputeStatusMeta,
  formatDayRange,
  formatMoney,
  formatNumber,
  humanize,
  invoiceStatusMeta,
  periodWord,
  statusMetaFor,
} from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';

describe('formatMoney', () => {
  it('formats integer minor units as INR currency', () => {
    expect(formatMoney(1052560)).toBe('₹10,525.60');
    expect(formatMoney(220000)).toBe('₹2,200.00');
    expect(formatMoney(0)).toBe('₹0.00');
  });

  it('supports other currencies', () => {
    expect(formatMoney(10000, 'USD')).toContain('100.00');
  });

  it('renders an em dash for missing values', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
    expect(formatMoney(Number.NaN)).toBe('—');
  });
});

describe('status badge mapping', () => {
  it('maps booking statuses to labels and tones', () => {
    expect(bookingStatusMeta('PENDING_APPROVAL')).toEqual({ label: 'Pending approval', tone: 'warn' });
    expect(bookingStatusMeta('AWAITING_PAYMENT')).toEqual({ label: 'Awaiting payment', tone: 'info' });
    expect(bookingStatusMeta('CONFIRMED')).toEqual({ label: 'Confirmed', tone: 'success' });
    expect(bookingStatusMeta('COMPLETED')).toEqual({ label: 'Completed', tone: 'success' });
    expect(bookingStatusMeta('CANCELLED')).toEqual({ label: 'Cancelled', tone: 'neutral' });
    expect(bookingStatusMeta('DISPUTED')).toEqual({ label: 'Disputed', tone: 'danger' });
    expect(bookingStatusMeta('REFUNDED')).toEqual({ label: 'Refunded', tone: 'neutral' });
  });

  it('humanizes unknown statuses as neutral', () => {
    expect(bookingStatusMeta('SOME_NEW_STATUS')).toEqual({ label: 'Some New Status', tone: 'neutral' });
    expect(bookingStatusMeta(null)).toEqual({ label: 'Unknown', tone: 'neutral' });
  });

  it('maps invoice and dispute statuses', () => {
    expect(invoiceStatusMeta('PAID')).toEqual({ label: 'Paid', tone: 'success' });
    expect(invoiceStatusMeta('VOID')).toEqual({ label: 'Void', tone: 'danger' });
    expect(disputeStatusMeta('UNDER_REVIEW')).toEqual({ label: 'Under review', tone: 'info' });
    expect(statusMetaFor('dispute', 'OPEN').tone).toBe('warn');
  });

  it('renders the StatusBadge with the tone class', () => {
    render(<StatusBadge status="PENDING_APPROVAL" />);
    const badge = screen.getByText('Pending approval');
    expect(badge).toHaveClass('badge', 'tone-warn');
    expect(badge).toHaveAttribute('data-status', 'PENDING_APPROVAL');
  });

  it('renders invoice badges by kind', () => {
    render(<StatusBadge status="PAID" kind="invoice" />);
    expect(screen.getByText('Paid')).toHaveClass('tone-success');
  });
});

describe('other formatters', () => {
  it('formats numbers and periods', () => {
    expect(formatNumber(1234.567)).toBe('1,234.6');
    expect(periodWord('DAY')).toBe('day');
    expect(humanize('COLD_STORAGE')).toBe('Cold Storage');
  });

  it('formats date ranges and guards invalid input', () => {
    expect(formatDayRange('2026-11-01', '2026-11-01')).not.toContain('→');
    expect(formatDayRange('2026-11-01', '2026-11-05')).toContain('→');
    expect(formatDayRange(null, null)).toBe('—');
  });
});
