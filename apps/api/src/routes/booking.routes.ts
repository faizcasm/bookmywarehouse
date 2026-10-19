import { Router } from 'express';
import { z } from 'zod';

import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  bookingListQuerySchema,
  cancelBookingSchema,
  completeBookingSchema,
  createBookingSchema,
  openDisputeSchema,
  quoteBookingSchema,
  rejectBookingSchema,
} from '@bmw/validation';
import {
  quoteHandler,
  createBookingHandler,
  listBookingsHandler,
  bookingDetailHandler,
  cancelBookingHandler,
  acceptBookingHandler,
  rejectBookingHandler,
  completeBookingHandler,
  startBookingHandler,
  openDisputeHandler,
} from '../controllers/booking.controller.js';

const bookingListQuery = bookingListQuerySchema.extend({
  scope: z.enum(['admin']).optional(),
});

/**
 * Booking lifecycle routes (/api/v1/bookings).
 */
export function bookingRoutes(): Router {
  const router = Router();

  // Price/availability quote — usable before login from the listing page.
  router.post('/quote', validate({ body: quoteBookingSchema }), optionalAuth, asyncHandler(quoteHandler));

  router.use(requireAuth);

  router.post('/', validate({ body: createBookingSchema }), asyncHandler(createBookingHandler));
  router.get('/', validate({ query: bookingListQuery }), asyncHandler(listBookingsHandler));
  router.get('/:id', asyncHandler(bookingDetailHandler));

  // Transitions — the state machine (BOOKING_TRANSITIONS) enforces legality.
  router.post('/:id/accept', asyncHandler(acceptBookingHandler));
  router.post('/:id/reject', validate({ body: rejectBookingSchema }), asyncHandler(rejectBookingHandler));
  router.post('/:id/start', asyncHandler(startBookingHandler));
  router.post('/:id/complete', validate({ body: completeBookingSchema }), asyncHandler(completeBookingHandler));
  router.post('/:id/cancel', validate({ body: cancelBookingSchema }), asyncHandler(cancelBookingHandler));
  router.post('/:id/dispute', validate({ body: openDisputeSchema }), asyncHandler(openDisputeHandler));

  return router;
}
