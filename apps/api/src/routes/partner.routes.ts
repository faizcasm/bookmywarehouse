import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  availabilityExceptionSchema,
  availabilityRuleSchema,
  createListingSchema,
  paginationSchema,
  partnerOnboardingSchema,
  payoutDetailsSchema,
  submitVerificationSchema,
  updateListingSchema,
} from '@bmw/validation';
import {
  partnerProfileHandler,
  partnerOnboardingHandler,
  partnerVerificationHandler,
  partnerPayoutHandler,
  partnerDashboardHandler,
  partnerListingsHandler,
  partnerListingDetailHandler,
  partnerCreateListingHandler,
  partnerUpdateListingHandler,
  partnerPublishListingHandler,
  partnerUnpublishListingHandler,
  partnerArchiveListingHandler,
  partnerDeleteListingHandler,
  partnerAvailabilityHandler,
  partnerAddRuleHandler,
  partnerRemoveRuleHandler,
  partnerAddExceptionHandler,
  partnerRemoveExceptionHandler,
  partnerEarningsHandler,
} from '../controllers/partner.controller.js';

const partnerListingsQuery = paginationSchema.extend({
  status: z.string().trim().max(60).optional(),
  type: z.enum(['WAREHOUSE', 'EQUIPMENT', 'SERVICE']).optional(),
  q: z.string().trim().max(120).optional(),
});

const earningsQuery = paginationSchema;

/**
 * Partner routes (/api/v1/partner) — require a partner (or admin) account.
 * Booking actions live under /bookings; reviews under /me/reviews.
 */
export function partnerRoutes(): Router {
  const router = Router();
  router.use(requireAuth, requireRole('PARTNER', 'ADMIN'));

  // Onboarding, verification, payouts
  router.get('/profile', asyncHandler(partnerProfileHandler));
  router.post('/onboarding', validate({ body: partnerOnboardingSchema }), asyncHandler(partnerOnboardingHandler));
  router.post('/verification', validate({ body: submitVerificationSchema }), asyncHandler(partnerVerificationHandler));
  router.patch('/payout-details', validate({ body: payoutDetailsSchema }), asyncHandler(partnerPayoutHandler));

  router.get('/dashboard', asyncHandler(partnerDashboardHandler));
  router.get('/earnings', validate({ query: earningsQuery }), asyncHandler(partnerEarningsHandler));

  // Listings lifecycle
  router.get('/listings', validate({ query: partnerListingsQuery }), asyncHandler(partnerListingsHandler));
  router.post('/listings', validate({ body: createListingSchema }), asyncHandler(partnerCreateListingHandler));
  router.get('/listings/:id', asyncHandler(partnerListingDetailHandler));
  router.patch('/listings/:id', validate({ body: updateListingSchema }), asyncHandler(partnerUpdateListingHandler));
  router.delete('/listings/:id', asyncHandler(partnerDeleteListingHandler));
  router.post('/listings/:id/publish', asyncHandler(partnerPublishListingHandler));
  router.post('/listings/:id/unpublish', asyncHandler(partnerUnpublishListingHandler));
  router.post('/listings/:id/archive', asyncHandler(partnerArchiveListingHandler));
  router.get('/listings/:id/availability', asyncHandler(partnerAvailabilityHandler));

  // Availability rules & exceptions
  router.post('/availability-rules', validate({ body: availabilityRuleSchema }), asyncHandler(partnerAddRuleHandler));
  router.delete('/availability-rules/:id', asyncHandler(partnerRemoveRuleHandler));
  router.post(
    '/availability-exceptions',
    validate({ body: availabilityExceptionSchema }),
    asyncHandler(partnerAddExceptionHandler),
  );
  router.delete('/availability-exceptions/:id', asyncHandler(partnerRemoveExceptionHandler));

  return router;
}
