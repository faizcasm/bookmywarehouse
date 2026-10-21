import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { objectIdSchema, paginationSchema } from '@bmw/validation';
import {
  webhookHandler,
  initiatePaymentHandler,
  paymentConfigHandler,
  simulatePaymentHandler,
  verifyPaymentHandler,
  myPaymentsHandler,
  listInvoicesHandler,
  invoiceDetailHandler,
  invoicePdfHandler,
} from '../controllers/payment.controller.js';

const simulateSchema = z.object({
  paymentId: objectIdSchema,
  outcome: z.enum(['SUCCESS', 'FAILURE']),
});

const verifySchema = z.object({
  orderId: z.string().min(4).max(64),
  paymentId: z.string().min(4).max(64),
  signature: z.string().length(64),
});

/**
 * Payment routes (/api/v1/payments) — SANDBOX by default; RAZORPAY when
 * PAYMENT_PUBLIC_KEY/SECRET_KEY/WEBHOOK_SECRET are configured.
 */
export function paymentRoutes(): Router {
  const router = Router();

  // Webhook is authenticated by HMAC signature (raw body preserved), not by session.
  router.post('/webhook', asyncHandler(webhookHandler));

  router.use(requireAuth);

  router.get('/config', asyncHandler(paymentConfigHandler));

  // Sandbox checkout simulator (no real money moves).
  router.post('/simulate', validate({ body: simulateSchema }), asyncHandler(simulatePaymentHandler));
  // Hosted-checkout confirmation (Razorpay Checkout.js handler payload).
  router.post('/verify', validate({ body: verifySchema }), asyncHandler(verifyPaymentHandler));
  router.post('/bookings/:bookingId/initiate', asyncHandler(initiatePaymentHandler));

  router.get('/', asyncHandler(myPaymentsHandler));
  router.get('/invoices', validate({ query: paginationSchema }), asyncHandler(listInvoicesHandler));
  router.get('/invoices/:id', asyncHandler(invoiceDetailHandler));
  router.get('/invoices/:id/html', asyncHandler(invoicePdfHandler));

  return router;
}
