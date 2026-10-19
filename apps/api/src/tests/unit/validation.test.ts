import { describe, expect, it } from 'vitest';

import {
  createBookingSchema,
  listingSearchQuerySchema,
  loginSchema,
  paginationSchema,
  registerSchema,
} from '@bmw/validation';

describe('registerSchema', () => {
  const valid = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'Password1' };

  it('accepts a valid registration and defaults to CUSTOMER', () => {
    const parsed = registerSchema.parse(valid);
    expect(parsed.role).toBe('CUSTOMER');
    expect(parsed.email).toBe('ada@example.com');
  });

  it('rejects weak passwords', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'short' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: 'allletters' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: '12345678' }).success).toBe(false);
  });

  it('rejects invalid emails', () => {
    expect(registerSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });

  it('allows partner registration with a business name', () => {
    const parsed = registerSchema.parse({ ...valid, role: 'PARTNER', businessName: 'Acme Logistics' });
    expect(parsed.role).toBe('PARTNER');
  });
});

describe('loginSchema', () => {
  it('requires an email and password', () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });
});

describe('paginationSchema', () => {
  it('applies defaults', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 12 });
  });

  it('coerces query-string numbers', () => {
    expect(paginationSchema.parse({ page: '3', limit: '50' })).toEqual({ page: 3, limit: 50 });
  });

  it('rejects out-of-range limits', () => {
    expect(paginationSchema.safeParse({ limit: '500' }).success).toBe(false);
    expect(paginationSchema.safeParse({ page: '0' }).success).toBe(false);
  });
});

describe('createBookingSchema', () => {
  const objectId = '665f1c2e8f1c2e8f1c2e8f1c';
  const base = { listingId: objectId, startDate: '2026-12-01' };

  it('accepts a one-day booking', () => {
    const parsed = createBookingSchema.parse(base);
    expect(parsed.startDate).toBeInstanceOf(Date);
    expect(parsed.quantity).toBe(1);
  });

  it('rejects an end date before the start date', () => {
    const result = createBookingSchema.safeParse({ ...base, endDate: '2026-11-01' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid listing ids', () => {
    expect(createBookingSchema.safeParse({ ...base, listingId: 'nope' }).success).toBe(false);
  });
});

describe('listingSearchQuerySchema', () => {
  it('defaults sort to relevance', () => {
    expect(listingSearchQuerySchema.parse({}).sort).toBe('relevance');
  });

  it('coerces numeric filters', () => {
    const parsed = listingSearchQuerySchema.parse({ minPrice: '100', lat: '18.5', lng: '73.8' });
    expect(parsed.minPrice).toBe(100);
    expect(parsed.lat).toBeCloseTo(18.5);
  });

  it('rejects unknown sort values', () => {
    expect(listingSearchQuerySchema.safeParse({ sort: 'cheapest' }).success).toBe(false);
  });
});
