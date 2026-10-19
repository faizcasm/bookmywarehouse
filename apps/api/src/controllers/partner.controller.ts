import type { Request, Response } from 'express';
import type { z } from 'zod';
import type {
  availabilityExceptionSchema,
  availabilityRuleSchema,
  createListingSchema,
  partnerOnboardingSchema,
  payoutDetailsSchema,
  submitVerificationSchema,
  updateListingSchema,
} from '@bmw/validation';
import { buildPageMeta, clientIp, sendSuccess } from '../lib/http.js';
import { errors } from '../lib/errors.js';
import {
  addAvailabilityException,
  addAvailabilityRule,
  onboardPartner,
  partnerDashboard,
  partnerEarnings,
  removeAvailabilityException,
  removeAvailabilityRule,
  serializePartnerProfile,
  submitVerification,
  updatePayoutDetails,
  listPartnerListings,
} from '../services/partner.service.js';
import {
  archiveListing,
  createListing,
  getPartnerListingDetail,
  publishListing,
  requireOwnListing,
  softDeleteListing,
  unpublishListing,
  updateListing,
} from '../services/listing.service.js';
import { getListingAvailability } from '../services/availability.service.js';
import { recordAudit } from '../services/audit.service.js';
import { notify } from '../services/notification.service.js';
import { User } from '../models/index.js';

function requireAuth(req: Request): { userId: string; role: 'CUSTOMER' | 'PARTNER' | 'ADMIN' } {
  if (!req.auth) throw errors.unauthenticated();
  return { userId: req.auth.userId, role: req.auth.role };
}

export async function partnerProfileHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  sendSuccess(res, await serializePartnerProfile(userId, true));
}

export async function partnerOnboardingHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const input = req.body as z.infer<typeof partnerOnboardingSchema>;
  sendSuccess(res, await onboardPartner(userId, input));
}

export async function partnerVerificationHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const input = req.body as z.infer<typeof submitVerificationSchema>;
  const profile = await submitVerification(userId, input);
  await recordAudit({
    actorId: userId,
    action: 'partner.verification_submitted',
    entityType: 'PartnerProfile',
    entityId: userId,
    summary: 'Verification documents submitted',
    ip: clientIp(req),
  });
  sendSuccess(res, profile);
}

export async function partnerPayoutHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const input = req.body as z.infer<typeof payoutDetailsSchema>;
  await updatePayoutDetails(userId, input);
  sendSuccess(res, { message: 'Payout details saved (account number stored masked only).' });
}

export async function partnerDashboardHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  sendSuccess(res, await partnerDashboard(userId));
}

export async function partnerListingsHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const query = req.query as unknown as { page: number; limit: number; status?: string; type?: string; q?: string };
  const result = await listPartnerListings(userId, query);
  sendSuccess(res, { items: result.items }, {
    meta: { pagination: buildPageMeta(query.page, query.limit, result.total) },
  });
}

export async function partnerListingDetailHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const result = await getPartnerListingDetail(req.params.id as string, userId);
  sendSuccess(res, result.detail);
}

export async function partnerCreateListingHandler(req: Request, res: Response): Promise<void> {
  const { userId, role } = requireAuth(req);
  if (role !== 'PARTNER') throw errors.forbidden('Only partners can create listings');
  const input = req.body as z.infer<typeof createListingSchema>;
  const listing = await createListing(userId, input);
  await recordAudit({
    actorId: userId,
    action: 'listing.created',
    entityType: 'Listing',
    entityId: String(listing._id),
    summary: listing.title,
    ip: clientIp(req),
  });
  sendSuccess(res, { id: String(listing._id), slug: listing.slug, status: listing.status }, { status: 201 });
}

export async function partnerUpdateListingHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const input = req.body as z.infer<typeof updateListingSchema>;
  const listing = await updateListing(userId, req.params.id as string, input);
  sendSuccess(res, { id: String(listing._id), slug: listing.slug, status: listing.status });
}

export async function partnerPublishListingHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const result = await publishListing(userId, req.params.id as string);
  await recordAudit({
    actorId: userId,
    action: 'listing.submitted',
    entityType: 'Listing',
    entityId: String(result.listing._id),
    ip: clientIp(req),
  });
  const admins = await User.find({ role: 'ADMIN', status: 'ACTIVE' }).select('_id').lean();
  await Promise.all(
    admins.map((admin) =>
      notify({
        userId: String(admin._id),
        type: 'LISTING_SUBMITTED',
        title: 'Listing submitted for review',
        body: `${result.listing.title} is awaiting review.`,
        link: '/admin/listings',
      }),
    ),
  );
  sendSuccess(res, { id: String(result.listing._id), status: result.status });
}

export async function partnerUnpublishListingHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const listing = await unpublishListing(userId, req.params.id as string);
  sendSuccess(res, { id: String(listing._id), status: listing.status });
}

export async function partnerArchiveListingHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const listing = await archiveListing(userId, req.params.id as string);
  sendSuccess(res, { id: String(listing._id), status: listing.status });
}

export async function partnerDeleteListingHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  await softDeleteListing(userId, req.params.id as string);
  await recordAudit({
    actorId: userId,
    action: 'listing.deleted',
    entityType: 'Listing',
    entityId: req.params.id as string,
    ip: clientIp(req),
  });
  sendSuccess(res, { deleted: true });
}

export async function partnerAvailabilityHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const listingId = req.params.id as string;
  await requireOwnListing(userId, listingId);
  const availability = await getListingAvailability(listingId);
  sendSuccess(res, availability);
}

export async function partnerAddRuleHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const input = req.body as z.infer<typeof availabilityRuleSchema>;
  const rule = await addAvailabilityRule(userId, input);
  sendSuccess(res, rule, { status: 201 });
}

export async function partnerRemoveRuleHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  await removeAvailabilityRule(userId, req.params.id as string);
  sendSuccess(res, { deleted: true });
}

export async function partnerAddExceptionHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const input = req.body as z.infer<typeof availabilityExceptionSchema>;
  const result = await addAvailabilityException(userId, input);
  sendSuccess(res, result, { status: 201 });
}

export async function partnerRemoveExceptionHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  await removeAvailabilityException(userId, req.params.id as string);
  sendSuccess(res, { deleted: true });
}

export async function partnerEarningsHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 12);
  const result = await partnerEarnings(userId, { page, limit });
  sendSuccess(res, result, {
    meta: { pagination: buildPageMeta(page, limit, result.total) },
  });
}
