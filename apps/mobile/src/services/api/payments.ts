/** Payment endpoints (config, initiate, sandbox simulate, status, invoices). */

import { api, apiText } from './client';
import type { Payment, PaymentConfig, Invoice, Paginated } from '@/types';
import type { QueryParams } from './client';

export function getPaymentConfig(): Promise<PaymentConfig> {
  return api.get<PaymentConfig>('/payments/config');
}

export interface InitiateInput {
  bookingId: string;
}

export interface InitiateResult {
  paymentId: string;
  provider: string;
  sandbox: boolean;
  clientSecret?: string;
  order?: Record<string, unknown>;
}

export function initiatePayment(input: InitiateInput): Promise<InitiateResult> {
  return api.post<InitiateResult>('/payments/initiate', input);
}

/** Sandbox only — drives the full capture lifecycle without a real gateway. */
export function simulatePayment(paymentId: string, outcome: 'success' | 'failure' = 'success'): Promise<Payment> {
  return api.post<Payment>('/payments/simulate', { paymentId, outcome });
}

export function getPaymentStatus(paymentId: string): Promise<Payment> {
  return api.get<Payment>(`/payments/${encodeURIComponent(paymentId)}/status`);
}

export function listInvoices(query?: QueryParams): Promise<Paginated<Invoice>> {
  return api.getPaged<Invoice>('/payments/invoices', query);
}

export function getInvoice(id: string): Promise<Invoice> {
  return api.get<Invoice>(`/payments/invoices/${encodeURIComponent(id)}`);
}

/** Printable invoice HTML — rendered with expo-print on the client. */
export function getInvoiceHtml(id: string): Promise<string> {
  return apiText(`/payments/invoices/${encodeURIComponent(id)}/html`);
}
