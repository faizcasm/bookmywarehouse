import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { paginationSchema } from '@bmw/validation';
import {
  adminCustomerCreateSchema,
  categorySchema,
  disputeResolutionSchema,
  listingModerationSchema,
  partnerDecisionSchema,
  platformSettingsSchema,
  reviewModerationSchema,
  userModerationSchema,
} from '@bmw/validation';
import { pageQuerySchema } from '../lib/query.js';
import {
  dashboardHandler,
  usersHandler,
  moderateUserHandler,
  createUserHandler,
  partnersHandler,
  partnerDetailHandler,
  partnerDecisionHandler,
  verificationQueueHandler,
  adminListingsHandler,
  moderateListingHandler,
  paymentsHandler,
  refundsHandler,
  processRefundHandler,
  adminInvoicesHandler,
  disputesHandler,
  resolveDisputeHandler,
  categoriesHandler,
  createCategoryHandler,
  updateCategoryHandler,
  settingsHandler,
  updateSettingsHandler,
  auditLogsHandler,
  reviewsHandler,
  moderateReviewHandler,
  exportBookingsCsvHandler,
  exportPayoutsCsvHandler,
} from '../controllers/admin.controller.js';

const idParams = z.object({ id: z.string().min(1) });

const auditQuery = pageQuerySchema.extend({
  action: z.string().trim().max(120).optional(),
  entityType: z.string().trim().max(80).optional(),
  entityId: z.string().trim().max(80).optional(),
});

/**
 * Admin routes (/api/v1/admin) — every route requires role=ADMIN.
 */
export function adminRoutes(): Router {
  const router = Router();
  router.use(requireAuth, requireRole('ADMIN'));

  // Overview
  router.get('/dashboard', asyncHandler(dashboardHandler));

  // Users & KYC
  router.get('/users', validate({ query: pageQuerySchema }), asyncHandler(usersHandler));
  router.post('/users', validate({ body: adminCustomerCreateSchema }), asyncHandler(createUserHandler));
  router.patch('/users/:id', validate({ params: idParams, body: userModerationSchema }), asyncHandler(moderateUserHandler));
  router.get('/partners', validate({ query: pageQuerySchema }), asyncHandler(partnersHandler));
  router.get('/partners/:id', validate({ params: idParams }), asyncHandler(partnerDetailHandler));
  router.post(
    '/partners/:id/decision',
    validate({ params: idParams, body: partnerDecisionSchema }),
    asyncHandler(partnerDecisionHandler),
  );
  router.get('/verification-queue', validate({ query: pageQuerySchema }), asyncHandler(verificationQueueHandler));

  // Listings moderation
  router.get('/listings', validate({ query: pageQuerySchema }), asyncHandler(adminListingsHandler));
  router.patch(
    '/listings/:id',
    validate({ params: idParams, body: listingModerationSchema }),
    asyncHandler(moderateListingHandler),
  );

  // Payments & refunds
  router.get('/payments', validate({ query: pageQuerySchema }), asyncHandler(paymentsHandler));
  router.get('/refunds', validate({ query: pageQuerySchema }), asyncHandler(refundsHandler));
  router.post('/refunds/:id/process', validate({ params: idParams }), asyncHandler(processRefundHandler));
  router.get('/invoices', validate({ query: paginationSchema }), asyncHandler(adminInvoicesHandler));

  // Disputes
  router.get('/disputes', validate({ query: pageQuerySchema }), asyncHandler(disputesHandler));
  router.post(
    '/disputes/:id/resolve',
    validate({ params: idParams, body: disputeResolutionSchema }),
    asyncHandler(resolveDisputeHandler),
  );

  // Categories
  router.get('/categories', asyncHandler(categoriesHandler));
  router.post('/categories', validate({ body: categorySchema }), asyncHandler(createCategoryHandler));
  router.patch(
    '/categories/:id',
    validate({ params: idParams, body: categorySchema.partial() }),
    asyncHandler(updateCategoryHandler),
  );

  // Reviews moderation
  router.get('/reviews', validate({ query: paginationSchema }), asyncHandler(reviewsHandler));
  router.post(
    '/reviews/:id/moderate',
    validate({ params: idParams, body: reviewModerationSchema }),
    asyncHandler(moderateReviewHandler),
  );

  // Platform settings & audit trail
  router.get('/settings', asyncHandler(settingsHandler));
  router.patch('/settings', validate({ body: platformSettingsSchema }), asyncHandler(updateSettingsHandler));
  router.get('/audit-logs', validate({ query: auditQuery }), asyncHandler(auditLogsHandler));

  // Accounting exports (CSV attachments)
  router.get('/exports/bookings.csv', asyncHandler(exportBookingsCsvHandler));
  router.get('/exports/payouts.csv', asyncHandler(exportPayoutsCsvHandler));

  return router;
}
