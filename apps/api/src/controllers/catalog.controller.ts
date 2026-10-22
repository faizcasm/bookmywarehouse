import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import type { listingSearchQuerySchema, uploadImageSchema } from '@bmw/validation';
import { buildPageMeta, sendSuccess } from '../lib/http.js';
import { errors } from '../lib/errors.js';
import { searchListings } from '../services/search.service.js';
import { getPublicListing, incrementViewCount } from '../services/listing.service.js';
import { getListingAvailability } from '../services/availability.service.js';
import { getCategoryBySlug, listPublicCategories } from '../services/category.service.js';
import { getSettings, toSettingsDTO } from '../services/settings.service.js';
import { uploadImage } from '../services/upload.service.js';
import { databaseHealth } from '../config/db.js';
import { listListingReviews } from '../services/review.service.js';
import { Listing } from '../models/index.js';

const startedAt = Date.now();
const VERSION = '0.1.0';

export async function searchHandler(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as Parameters<typeof searchListings>[0];
  const result = await searchListings(query, req.auth?.userId ?? null);
  sendSuccess(res, { items: result.items, sort: result.sort, facets: result.facets }, {
    meta: { pagination: buildPageMeta(result.page, result.limit, result.total) },
  });
}

export async function listingDetailHandler(req: Request, res: Response): Promise<void> {
  const slugOrId = req.params.slug as string;
  const { listing, detail } = await getPublicListing(slugOrId, req.auth?.userId ?? null);
  void incrementViewCount(listing._id);
  sendSuccess(res, detail);
}

export async function listingReviewsHandler(req: Request, res: Response): Promise<void> {
  const slugOrId = req.params.id as string;
  let listingId = slugOrId;
  if (!Types.ObjectId.isValid(listingId)) {
    const listing = await Listing.findOne({ slug: slugOrId }).select('_id').lean();
    if (!listing) throw errors.notFound('Listing not found');
    listingId = String(listing._id);
  }
  const query = req.query as unknown as {
    page: number;
    limit: number;
    minRating?: number;
    sort: 'newest' | 'oldest' | 'rating_desc' | 'rating_asc';
  };
  const result = await listListingReviews(listingId, query);
  sendSuccess(res, { items: result.items, average: result.average }, {
    meta: { pagination: buildPageMeta(query.page, query.limit, result.total) },
  });
}

export async function categoriesHandler(req: Request, res: Response): Promise<void> {
  const type = (req.query.type as 'WAREHOUSE' | 'EQUIPMENT' | 'SERVICE' | undefined) ?? undefined;
  const categories = await listPublicCategories(type);
  sendSuccess(res, { items: categories });
}

export async function categoryDetailHandler(req: Request, res: Response): Promise<void> {
  const category = await getCategoryBySlug(req.params.slug as string);
  if (!category) throw errors.notFound('Category not found');
  sendSuccess(res, category);
}

export async function platformSettingsHandler(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, toSettingsDTO(await getSettings()));
}

export async function healthHandler(_req: Request, res: Response): Promise<void> {
  const db = await databaseHealth();
  // Only the database matters to an uptime probe; integration details (which
  // email provider is configured) are not disclosed on an unauthenticated route.
  res.status(db.connected ? 200 : 503).json({
    success: true,
    data: {
      status: db.connected ? 'ok' : 'degraded',
      version: VERSION,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      database: db,
      timestamp: new Date().toISOString(),
    },
    requestId: 'health',
  });
}

export async function uploadHandler(req: Request, res: Response): Promise<void> {
  const input = req.body as { file: string; folder?: 'listings' | 'avatars' | 'documents' | 'logos' };
  const result = await uploadImage(input.file, input.folder ?? 'listings');
  sendSuccess(res, result, { status: 201 });
}

/** Public availability calendar for a listing (rules + blocked dates). */
export async function listingAvailabilityHandler(req: Request, res: Response): Promise<void> {
  const availability = await getListingAvailability(req.params.id as string);
  sendSuccess(res, availability);
}

/** Nearby/related listings used on the detail page ("you may also like"). */
export async function similarListingsHandler(req: Request, res: Response): Promise<void> {
  const { listing } = await getPublicListing(req.params.slug as string, null);
  const params: Parameters<typeof searchListings>[0] = { page: 1, limit: 8, sort: 'relevance' };
  if (listing.category) params.categoryId = String(listing.category);
  if (listing.location?.city) params.city = listing.location.city;
  const result = await searchListings(params, null);
  const items = result.items
    .filter((item) => item.id !== String(listing._id))
    .slice(0, 4);
  sendSuccess(res, { items });
}

export { uploadImageSchema };
