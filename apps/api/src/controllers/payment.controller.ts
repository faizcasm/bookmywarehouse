import type { Request, Response } from 'express';
import { buildPageMeta, clientIp, sendSuccess } from '../lib/http.js';
import { errors } from '../lib/errors.js';
import {
  initiatePayment,
  isSandbox,
  processWebhookEvent,
  simulateGatewayResult,
} from '../services/payment.service.js';
import {
  getInvoiceForViewer,
  listInvoices,
  renderInvoiceHtml,
} from '../services/invoice.service.js';
import { Payment } from '../models/index.js';
import { recordAudit } from '../services/audit.service.js';

export async function rawBodyHandler(req: Request, res: Response, next: () => void): Promise<void> {
  // Preserve the exact bytes for webhook signature verification.
  let data = '';
  req.setEncoding('utf8');
  req.on('data', (chunk: string) => {
    data += chunk;
  });
  req.on('end', () => {
    (req as Request & { rawBody?: string }).rawBody = data;
    try {
      req.body = data ? JSON.parse(data) : {};
    } catch {
      req.body = {};
    }
    next();
  });
}

export async function initiatePaymentHandler(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw errors.unauthenticated();
  const bookingId = req.params.bookingId as string;
  const result = await initiatePayment(req.auth.userId, bookingId);
  await recordAudit({
    actorId: req.auth.userId,
    action: 'payment.initiated',
    entityType: 'Payment',
    entityId: String(result.payment._id),
    summary: `Payment initiated for booking ${bookingId}`,
    ip: clientIp(req),
  });
  sendSuccess(res, {
    payment: {
      id: String(result.payment._id),
      reference: result.payment.reference,
      amount: result.payment.amountMinor,
      currency: result.payment.currency,
      status: result.payment.status,
      provider: result.provider,
    },
    checkoutUrl: result.checkoutUrl,
    sandbox: isSandbox(),
    message: isSandbox()
      ? 'Sandbox mode: no real money moves. Complete the simulated checkout to exercise the payment flow.'
      : null,
  });
}

export async function simulatePaymentHandler(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw errors.unauthenticated();
  const { paymentId, outcome } = req.body as { paymentId: string; outcome: 'SUCCESS' | 'FAILURE' };
  if (!paymentId || !outcome) throw errors.badRequest('paymentId and outcome are required');
  const result = await simulateGatewayResult(paymentId, outcome);
  sendSuccess(res, result);
}

export async function webhookHandler(req: Request, res: Response): Promise<void> {
  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body ?? {});
  const signature = (req.headers['x-payments-signature'] as string | undefined) ?? '';
  const result = await processWebhookEvent(rawBody, signature);
  res.status(200).json({ received: true, ...result });
}

export async function myPaymentsHandler(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw errors.unauthenticated();
  const { Booking } = await import('../models/index.js');
  const bookings = await Booking.find({ customer: req.auth.userId }).select('_id').lean();
  const payments = await Payment.find({ booking: { $in: bookings.map((b) => b._id) } })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  sendSuccess(res, {
    items: payments.map((payment) => ({
      id: String(payment._id),
      bookingId: String(payment.booking),
      reference: payment.reference,
      amount: payment.amountMinor,
      currency: payment.currency,
      status: payment.status,
      provider: payment.provider,
      paidAt: payment.paidAt ? new Date(payment.paidAt).toISOString() : null,
      createdAt: new Date(payment.createdAt).toISOString(),
    })),
  });
}

export async function listInvoicesHandler(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw errors.unauthenticated();
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 12);
  const role = req.auth.role === 'PARTNER' ? 'partner' : 'customer';
  const result = await listInvoices({ role, userId: req.auth.userId }, page, limit);
  sendSuccess(res, { items: result.items }, {
    meta: { pagination: buildPageMeta(page, limit, result.total) },
  });
}

export async function invoiceDetailHandler(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw errors.unauthenticated();
  const { dto } = await getInvoiceForViewer(req.params.id as string, {
    userId: req.auth.userId,
    role: req.auth.role,
  });
  sendSuccess(res, dto);
}

export async function invoicePdfHandler(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw errors.unauthenticated();
  const { invoice, dto } = await getInvoiceForViewer(req.params.id as string, {
    userId: req.auth.userId,
    role: req.auth.role,
  });
  const html = renderInvoiceHtml(invoice, dto.bookingReference);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="${dto.invoiceNumber}.html"`);
  res.send(html);
}
