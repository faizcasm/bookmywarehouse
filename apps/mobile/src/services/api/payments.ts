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

/** Sandbox only — drives the full capture lifecycle without a real gateway. */
export function simulatePayment(
  paymentId: string,
  outcome: 'success' | 'failure' | 'SUCCESS' | 'FAILURE' = 'success',
): Promise<Payment> {
  return api
    .post<PaymentDTO>('/payments/simulate', { paymentId, outcome: outcome.toUpperCase() })
    .then(toPayment);
}

export function listMyPayments(query?: QueryParams): Promise<Paginated<Payment>> {
  return api.getPaged<PaymentDTO>('/payments', query).then((dto) => ({
    items: dto.items.map(toPayment),
    meta: dto.meta,
  }));
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
