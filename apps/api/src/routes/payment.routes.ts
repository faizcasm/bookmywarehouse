import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { objectIdSchema, paginationSchema } from '@bmw/validation';
import {
  webhookHandler,
  initiatePaymentHandler,
  simulatePaymentHandler,
  myPaymentsHandler,
  listInvoicesHandler,
  invoiceDetailHandler,
  invoicePdfHandler,
} from '../controllers/payment.controller.js';

const simulateSchema = z.object({
  paymentId: objectIdSchema,
  outcome: z.enum(['SUCCESS', 'FAILURE']),
});

/**
 * Payment routes (/api/v1/payments) — sandbox gateway by default.
 */
export function paymentRoutes(): Router {
  const router = Router();

  // Webhook is authenticated by HMAC signature (raw body preserved), not by session.
  router.post('/webhook', asyncHandler(webhookHandler));

  router.use(requireAuth);

  // Sandbox checkout simulator (no real money moves).
  router.post('/simulate', validate({ body: simulateSchema }), asyncHandler(simulatePaymentHandler));
  router.post('/bookings/:bookingId/initiate', asyncHandler(initiatePaymentHandler));

  router.get('/', asyncHandler(myPaymentsHandler));
  router.get('/invoices', validate({ query: paginationSchema }), asyncHandler(listInvoicesHandler));
  router.get('/invoices/:id', asyncHandler(invoiceDetailHandler));
  router.get('/invoices/:id/html', asyncHandler(invoicePdfHandler));

  return router;
}
