import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../components/StatusBadge';
import { formatMoney, statusTone, humanize, mapNotificationLink, toMinor, toMajor } from '../lib/format';

describe('StatusBadge — tone and label mapping', () => {
  it('maps listing statuses to the right tone and label', () => {
    render(<StatusBadge value="PENDING_REVIEW" kind="listing" />);
    const badge = screen.getByText('Pending review');
    expect(badge).toHaveClass('badge--warning');
    expect(badge).toHaveAttribute('data-status', 'PENDING_REVIEW');
  });

  it('uses the success tone for PUBLISHED listings', () => {
    render(<StatusBadge value="PUBLISHED" kind="listing" />);
    expect(screen.getByText('Published')).toHaveClass('badge--success');
  });

  it('maps booking statuses correctly', () => {
    const { rerender } = render(<StatusBadge value="PENDING_APPROVAL" kind="booking" />);
    expect(screen.getByText('Pending approval')).toHaveClass('badge--warning');
    rerender(<StatusBadge value="CONFIRMED" kind="booking" />);
    expect(screen.getByText('Confirmed')).toHaveClass('badge--success');
    rerender(<StatusBadge value="REJECTED" kind="booking" />);
    expect(screen.getByText('Rejected')).toHaveClass('badge--danger');
  });

  it('maps verification statuses correctly', () => {
    const { rerender } = render(<StatusBadge value="VERIFIED" kind="verification" />);
    expect(screen.getByText('Verified')).toHaveClass('badge--success');
    rerender(<StatusBadge value="DRAFT" kind="verification" />);
    expect(screen.getByText('Draft')).toHaveClass('badge--neutral');
  });

  it('renders an em dash for missing values', () => {
    render(<StatusBadge value={null} kind="listing" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('status tone helpers', () => {
  it('covers every booking tone', () => {
    expect(statusTone('booking', 'AWAITING_PAYMENT')).toBe('info');
    expect(statusTone('booking', 'IN_PROGRESS')).toBe('info');
    expect(statusTone('booking', 'COMPLETED')).toBe('success');
    expect(statusTone('booking', 'DISPUTED')).toBe('danger');
    expect(statusTone('booking', 'REFUNDED')).toBe('neutral');
    // Unknown values fall back to neutral instead of crashing.
    expect(statusTone('booking', 'SOMETHING_NEW')).toBe('neutral');
  });

  it('humanizes status strings', () => {
    expect(humanize('PENDING_APPROVAL')).toBe('Pending approval');
    expect(humanize('UNDER_REVIEW')).toBe('Under review');
  });
});

describe('money formatting (minor units → rupees)', () => {
  it('formats paise as rupees with en-IN grouping', () => {
    expect(formatMoney(2614644)).toContain('26,146.44');
    expect(formatMoney(0)).toContain('0');
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
  });

  it('converts between major and minor units', () => {
    expect(toMinor(1800)).toBe(180000);
    expect(toMajor(180000)).toBe(1800);
  });
});

describe('notification link mapping', () => {
  it('routes conversation links into the messages thread', () => {
    expect(mapNotificationLink('/dashboard/messages?conversation=abc123')).toBe('/messages/abc123');
  });

  it('strips /partner prefixes and falls back safely', () => {
    expect(mapNotificationLink('/partner/reviews')).toBe('/reviews');
    expect(mapNotificationLink(null)).toBe('/notifications');
    expect(mapNotificationLink('/unknown/path')).toBe('/notifications');
  });
});
