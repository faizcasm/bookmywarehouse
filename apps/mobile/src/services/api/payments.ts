/** Payment endpoints (config, initiate, sandbox simulate, invoices). */

import type { InvoiceDTO, PaymentDTO } from '@bmw/shared-types';

import { api, apiText } from './client';
import { toInvoice, toPayment } from './normalize';
import type { Payment, PaymentConfig, Invoice, Paginated } from '@/types';
import type { QueryParams } from './client';

export function getPaymentConfig(): Promise<PaymentConfig> {
  return api.get<PaymentConfig>('/payments/config');
}

export interface InitiateResult {
  /** The payment id to drive the sandbox simulator with. */
  paymentId: string;
  provider: string;
  sandbox: boolean;
  checkoutUrl?: string | null;
  reference?: string;
  razorpay?: Record<string, unknown>;
}

interface InitiateEnvelope {
  payment?: { id?: string; reference?: string; provider?: string };
  checkoutUrl?: string | null;
  sandbox?: boolean;
  razorpay?: Record<string, unknown>;
}

/** POST /payments/bookings/:bookingId/initiate */
export function initiatePayment(bookingId: string): Promise<InitiateResult> {
  return api
    .post<InitiateEnvelope>(`/payments/bookings/${encodeURIComponent(bookingId)}/initiate`)
    .then((r) => ({
      paymentId: r.payment?.id ?? '',
      provider: r.payment?.provider ?? 'SANDBOX',
      sandbox: r.sandbox ?? true,
      checkoutUrl: r.checkoutUrl ?? null,
      reference: r.payment?.reference,
      razorpay: r.razorpay,
    }));
}

/**
 * Sandbox only — drives the full capture lifecycle without a real gateway.
 * POST /payments/simulate returns `{ eventId, processed }`, not a PaymentDTO.
 */
export function simulatePayment(
  paymentId: string,
  outcome: 'success' | 'failure' | 'SUCCESS' | 'FAILURE' = 'success',
): Promise<{ eventId?: string; processed?: boolean }> {
  return api.post('/payments/simulate', { paymentId, outcome: outcome.toUpperCase() });
}

/** POST /payments/verify — confirm a hosted-checkout payment by signature. */
export function verifyPayment(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<{ paymentId: string; status: string; alreadyProcessed?: boolean }> {
  return api.post('/payments/verify', input);
}

/**
 * GET /payments — the customer's payment history. The endpoint caps at 50 and
 * returns `{ items }` with **no pagination meta**, so this reports one page.
 */
export function listMyPayments(): Promise<Payment[]> {
  return api
    .get<{ items: PaymentDTO[] }>('/payments')
    .then((d) => (d.items ?? []).map(toPayment));
}

export function listInvoices(query?: QueryParams): Promise<Paginated<Invoice>> {
  return api.getPaged<InvoiceDTO>('/payments/invoices', query).then((dto) => ({
    items: dto.items.map(toInvoice),
    meta: dto.meta,
  }));
}

export function getInvoice(id: string): Promise<Invoice> {
  return api.get<InvoiceDTO>(`/payments/invoices/${encodeURIComponent(id)}`).then(toInvoice);
}

/** Printable invoice HTML — rendered with expo-print on the client. */
export function getInvoiceHtml(id: string): Promise<string> {
  return apiText(`/payments/invoices/${encodeURIComponent(id)}/html`);
}
