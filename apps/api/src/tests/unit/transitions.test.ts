import { describe, expect, it } from 'vitest';

import {
  BOOKING_TRANSITIONS,
  TERMINAL_BOOKING_STATUSES,
  canTransition,
} from '@bmw/shared-types';

describe('booking state machine', () => {
  it('allows the happy path: request → payment → confirmed → progress → done', () => {
    expect(canTransition('PENDING_APPROVAL', 'AWAITING_PAYMENT')).toBe(true);
    expect(canTransition('AWAITING_PAYMENT', 'CONFIRMED')).toBe(true);
    expect(canTransition('CONFIRMED', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
  });

  it('supports partner rejection and customer cancellation', () => {
    expect(canTransition('PENDING_APPROVAL', 'REJECTED')).toBe(true);
    expect(canTransition('PENDING_APPROVAL', 'CANCELLED')).toBe(true);
    expect(canTransition('CONFIRMED', 'CANCELLED')).toBe(true);
  });

  it('forbids skipping payment approval', () => {
    expect(canTransition('PENDING_APPROVAL', 'COMPLETED')).toBe(false);
    expect(canTransition('PENDING_APPROVAL', 'IN_PROGRESS')).toBe(false);
  });

  it('forbids reopening terminal states', () => {
    for (const status of TERMINAL_BOOKING_STATUSES) {
      expect(BOOKING_TRANSITIONS[status]).toHaveLength(0);
      expect(canTransition(status, 'CONFIRMED')).toBe(false);
    }
  });

  it('requires disputes to resolve into a valid downstream state', () => {
    expect(canTransition('COMPLETED', 'DISPUTED')).toBe(true);
    expect(canTransition('DISPUTED', 'REFUNDED')).toBe(true);
    expect(canTransition('DISPUTED', 'COMPLETED')).toBe(true);
    expect(canTransition('DISPUTED', 'AWAITING_PAYMENT')).toBe(false);
  });

  it('never allows a status to transition to itself', () => {
    for (const [status, targets] of Object.entries(BOOKING_TRANSITIONS)) {
      expect(targets).not.toContain(status);
    }
  });
});
