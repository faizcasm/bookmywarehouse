import { randomBytes } from 'node:crypto';

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 110)
    .replace(/-+$/g, '');
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode(length = 6): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

export function bookingReference(): string {
  return `BMW-${randomCode(8)}`;
}

export function paymentReference(): string {
  return `PAY-${randomCode(8)}`;
}

export function invoiceNumber(): string {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `INV-${ym}-${randomCode(6)}`;
}

export function disputeReference(): string {
  return `DSP-${randomCode(6)}`;
}

/** Human-friendly codes for emails and admin review queues. */
export function shortCode(): string {
  return randomCode(6);
}

/** URL-safe random suffix for synthetic ids. */
export function randomSuffix(length = 10): string {
  return randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}
