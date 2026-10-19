import { Router } from 'express';
import { z } from 'zod';

import { optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { listingSearchQuerySchema, paginationSchema } from '@bmw/validation';
import {
  searchHandler,
  listingDetailHandler,
  listingReviewsHandler,
  listingAvailabilityHandler,
  similarListingsHandler,
  categoriesHandler,
  categoryDetailHandler,
  platformSettingsHandler,
} from '../controllers/catalog.controller.js';

const listingReviewsQuerySchema = paginationSchema.extend({
  minRating: z.coerce.number().min(1).max(5).optional(),
  sort: z.enum(['newest', 'oldest', 'rating_desc', 'rating_asc']).default('newest'),
});

/**
 * Public catalog routes (/api/v1/catalog) — browsable without auth;
 * optionalAuth adds per-user personalization (e.g. isFavorite).
 */
export function catalogRoutes(): Router {
  const router = Router();

  router.get('/settings', asyncHandler(platformSettingsHandler));
  router.get('/categories', asyncHandler(categoriesHandler));
  router.get('/categories/:slug', asyncHandler(categoryDetailHandler));

  // Search is the primary listing feed (also mounted as /listings for clarity).
  router.get('/search', validate({ query: listingSearchQuerySchema }), optionalAuth, asyncHandler(searchHandler));
  router.get('/listings', validate({ query: listingSearchQuerySchema }), optionalAuth, asyncHandler(searchHandler));

  router.get('/listings/:slug', optionalAuth, asyncHandler(listingDetailHandler));
  router.get(
    '/listings/:id/reviews',
    validate({ query: listingReviewsQuerySchema }),
    asyncHandler(listingReviewsHandler),
  );
  router.get('/listings/:id/availability', asyncHandler(listingAvailabilityHandler));
  router.get('/listings/:slug/similar', asyncHandler(similarListingsHandler));

  return router;
}
