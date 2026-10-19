import { Types } from 'mongoose';
import type { z } from 'zod';
import type {
  AdminDashboardDTO,
  AuditLogDTO,
  BookingDTO,
  CategoryDTO,
  Currency,
  DisputeDTO,
  InvoiceDTO,
  ListingSummaryDTO,
  PaymentDTO,
  PlatformSettingsDTO,
  RefundDTO,
  UserDTO,
} from '@bmw/shared-types';
import type {
  categorySchema,
  disputeResolutionSchema,
  listingModerationSchema,
  partnerDecisionSchema,
  platformSettingsSchema,
  userModerationSchema,
  adminCustomerCreateSchema,
  reviewModerationSchema,
} from '@bmw/validation';
import { errors } from '../lib/errors.js';
import { hashPassword } from '../lib/crypto.js';
import {
  AuditLog,
  Booking,
  BusinessVerification,
  Category,
  CustomerProfile,
  Dispute,
  Invoice,
  Listing,
  PartnerProfile,
  Payment,
  PlatformSettings,
  Refund,
  Review,
  User,
  type DisputeFields,
  type ListingFields,
} from '../models/index.js';
import { serializeListingPage, type ListingLean } from './listing.service.js';
import { serializeBooking } from '../serializers/booking.serializer.js';
import { serializeInvoice } from './invoice.service.js';
import { serializeUser } from '../serializers/user.serializer.js';
import { notify } from './notification.service.js';
import { recordAudit } from './audit.service.js';
import { getSettings, invalidateSettingsCache, toSettingsDTO, ensureSettings } from './settings.service.js';
import { completeRefund, createRefundForBooking } from './payment.service.js';
import { moderateReview } from './review.service.js';
import { renderBooking } from './booking.service.js';
import { revokeAllSessions } from './auth.service.js';
import { partnerSummariesFor } from './listing.service.js';
import { serializePartnerSummary } from '../serializers/listing.serializer.js';

type CategoryInput = z.infer<typeof categorySchema>;
type SettingsInput = z.infer<typeof platformSettingsSchema>;
type DisputeResolutionInput = z.infer<typeof disputeResolutionSchema>;

const DAY_MS = 24 * 60 * 60 * 1000;

export async function adminDashboard(): Promise<AdminDashboardDTO> {
  const settings = await getSettings();

  const [
    customers,
    partners,
    verifiedPartners,
    listings,
    activeListings,
    bookings,
    pendingBookings,
    disputesOpen,
    pendingVerifications,
    pendingListings,
    grossAgg,
    refundsAgg,
    trendAgg,
    recentBookingDocs,
    recentDisputeDocs,
  ] = await Promise.all([
    User.countDocuments({ role: 'CUSTOMER' }),
    User.countDocuments({ role: 'PARTNER' }),
    PartnerProfile.countDocuments({ verificationStatus: 'VERIFIED' }),
    Listing.countDocuments({ deletedAt: null }),
    Listing.countDocuments({ status: 'PUBLISHED', deletedAt: null }),
    Booking.countDocuments({}),
    Booking.countDocuments({ status: 'PENDING_APPROVAL' }),
    Dispute.countDocuments({ status: { $in: ['OPEN', 'UNDER_REVIEW'] } }),
    BusinessVerification.countDocuments({ status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } }),
    Listing.countDocuments({ status: 'PENDING_REVIEW', deletedAt: null }),
    Payment.aggregate<{ _id: null; total: number }>([
      { $match: { status: 'SUCCEEDED' } },
      { $group: { _id: null, total: { $sum: '$amountMinor' } } },
    ]),
    Refund.aggregate<{ _id: null; total: number }>([
      { $match: { status: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$amountMinor' } } },
    ]),
    Booking.aggregate<{ _id: string; bookings: number; grossAmount: number }>([
      { $match: { createdAt: { $gte: new Date(Date.now() - 14 * DAY_MS) } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          bookings: { $sum: 1 },
          grossAmount: { $sum: '$pricing.totalMinor' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Booking.find({}).sort({ createdAt: -1 }).limit(8).lean(),
    Dispute.find({}).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  const gross = grossAgg[0]?.total ?? 0;
  const platformFees = Math.round((gross * settings.platformFeePercent) / 100);
  const refunds = refundsAgg[0]?.total ?? 0;

  return {
    totals: {
      customers,
      partners,
      verifiedPartners,
      listings,
      activeListings,
      bookings,
      pendingBookings,
      disputesOpen,
      pendingVerifications,
      pendingListings,
    },
    revenue: {
      currency: settings.currency as Currency,
      grossCollected: gross,
      platformFees,
      refunds,
      netCollected: Math.max(0, gross - refunds),
      periodDays: 30,
    },
    trends: trendAgg.map((t) => ({ date: t._id, bookings: t.bookings, grossAmount: t.grossAmount })),
    recentBookings: await Promise.all(recentBookingDocs.map((doc) => renderBooking(doc as never))),
    recentDisputes: recentDisputeDocs.map(serializeDispute) as DisputeDTO[],
  };
}

export async function listUsers(query: {
  page: number;
  limit: number;
  q?: string;
  role?: string;
  status?: string;
}): Promise<{ items: UserDTO[]; total: number }> {
  const filter: Record<string, unknown> = {};
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  if (query.q) {
    const regex = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ email: regex }, { name: regex }];
  }
  const [docs, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  return {
    items: docs.map((doc) => serializeUser(doc as never)),
    total,
  };
}

export async function moderateUser(
  actorId: string,
  userId: string,
  action: 'SUSPEND' | 'REACTIVATE' | 'DEACTIVATE',
  reason: string | null,
  ip: string | null,
): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw errors.notFound('User not found');
  if (user.role === 'ADMIN' && action !== 'REACTIVATE') {
    throw errors.forbidden('Administrators cannot be suspended through this flow');
  }
  if (action === 'SUSPEND') {
    user.status = 'SUSPENDED';
    user.statusReason = reason;
    await revokeAllSessions(userId);
  } else if (action === 'REACTIVATE') {
    user.status = 'ACTIVE';
    user.statusReason = null;
  } else {
    user.status = 'DEACTIVATED';
    user.statusReason = reason;
    await revokeAllSessions(userId);
  }
  await user.save();
  await recordAudit({
    actorId,
    action: `admin.user_${action.toLowerCase()}`,
    entityType: 'User',
    entityId: userId,
    summary: reason ?? `Account ${action.toLowerCase()}`,
    ip,
  });
  await notify({
    userId,
    type: 'SYSTEM_ANNOUNCEMENT',
    title: `Account ${action.toLowerCase()}`,
    body: reason ?? 'Contact support for details.',
    link: '/dashboard/profile',
  });
}

export async function createCustomerByAdmin(
  actorId: string,
  input: z.infer<typeof adminCustomerCreateSchema>,
  ip: string | null,
): Promise<UserDTO> {
  const existing = await User.findOne({ email: input.email }).lean();
  if (existing) throw errors.emailTaken();
  const user = await User.create({
    email: input.email,
    name: input.name,
    passwordHash: await hashPassword(input.password),
    role: input.role,
    phone: input.phone ?? null,
    emailVerified: true,
    createdByAdmin: true,
  });
  if (input.role === 'CUSTOMER') await CustomerProfile.create({ user: user._id });
  if (input.role === 'PARTNER') {
    await PartnerProfile.create({ user: user._id, businessName: `${input.name}'s business` });
  }
  await recordAudit({
    actorId,
    action: 'admin.user_created',
    entityType: 'User',
    entityId: String(user._id),
    summary: `Created ${input.role.toLowerCase()} account`,
    ip,
  });
  return serializeUser(user.toObject() as never);
}

export async function listPartners(query: {
  page: number;
  limit: number;
  q?: string;
  verificationStatus?: string;
}): Promise<{ items: unknown[]; total: number }> {
  const filter: Record<string, unknown> = {};
  if (query.verificationStatus) filter.verificationStatus = query.verificationStatus;
  if (query.q) {
    const regex = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.businessName = regex;
  }
  const [profiles, total] = await Promise.all([
    PartnerProfile.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    PartnerProfile.countDocuments(filter),
  ]);
  const userIds = profiles.map((p) => String(p.user));
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('name email status avatarUrl createdAt').lean()
    : [];
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const listingCounts = await Listing.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { partner: { $in: userIds.map((id) => new Types.ObjectId(id)) }, deletedAt: null } },
    { $group: { _id: '$partner', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(listingCounts.map((c) => [String(c._id), c.count]));

  return {
    items: profiles.map((profile) => {
      const user = userMap.get(String(profile.user));
      return {
        partnerId: String(profile._id),
        userId: String(profile.user),
        businessName: profile.businessName,
        businessType: profile.businessType,
        verificationStatus: profile.verificationStatus,
        city: profile.address?.city ?? null,
        listingCount: countMap.get(String(profile.user)) ?? 0,
        totalBookings: profile.totalBookings,
        responseRate: profile.responseRate ?? null,
        user: user
          ? {
              id: String(user._id),
              name: user.name,
              email: user.email,
              status: user.status,
              avatarUrl: user.avatarUrl ?? null,
            }
          : null,
        createdAt: new Date(profile.createdAt).toISOString(),
      };
    }),
    total,
  };
}

export async function getPartnerDetail(partnerId: string): Promise<Record<string, unknown>> {
  if (!Types.ObjectId.isValid(partnerId)) throw errors.notFound('Partner not found');
  const profile = await PartnerProfile.findById(partnerId).lean();
  if (!profile) throw errors.notFound('Partner not found');
  const user = await User.findById(profile.user).lean();
  const verification = await BusinessVerification.findOne({ partner: profile._id })
    .select('+gstNumber +panNumber')
    .lean();
  const listings = (await Listing.find({ partner: profile.user, deletedAt: null })
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean()) as unknown as ListingLean[];
  const listingSummaries = await serializeListingPage(listings, {});
  const bookings = await Booking.find({ partner: profile.user })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  return {
    partnerId: String(profile._id),
    userId: String(profile.user),
    businessName: profile.businessName,
    businessType: profile.businessType,
    description: profile.description ?? null,
    website: profile.website ?? null,
    logoUrl: profile.logoUrl ?? null,
    verificationStatus: profile.verificationStatus,
    verification: verification
      ? {
          id: String(verification._id),
          status: verification.status,
          legalBusinessName: verification.legalBusinessName,
          gstNumber: verification.gstNumber,
          panNumber: verification.panNumber,
          registrationNumber: verification.registrationNumber,
          documents: verification.documents.map((doc) => ({
            id: String(doc._id),
            label: doc.label,
            url: doc.url,
            status: doc.status,
            uploadedAt: new Date(doc.uploadedAt).toISOString(),
            rejectionReason: doc.rejectionReason ?? null,
          })),
          submittedAt: verification.submittedAt ? new Date(verification.submittedAt).toISOString() : null,
          reviewedAt: verification.reviewedAt ? new Date(verification.reviewedAt).toISOString() : null,
          rejectionReason: verification.rejectionReason ?? null,
          reviewerNotes: verification.reviewerNotes ?? null,
        }
      : null,
    user: user
      ? {
          id: String(user._id),
          name: user.name,
          email: user.email,
          phone: user.phone ?? null,
          status: user.status,
          emailVerified: user.emailVerified,
        }
      : null,
    payout: profile.payoutDetails
      ? {
          accountHolderName: profile.payoutDetails.accountHolderName,
          accountNumberMasked: profile.payoutDetails.accountNumberMasked,
          ifsc: profile.payoutDetails.ifsc,
          bankName: profile.payoutDetails.bankName,
          upiId: profile.payoutDetails.upiId,
        }
      : null,
    listings: listingSummaries,
    recentBookings: bookings as unknown as BookingDTO[],
    createdAt: new Date(profile.createdAt).toISOString(),
  };
}

export interface VerificationDecisionInput {
  actorId: string;
  partnerId: string;
  decision: 'APPROVE' | 'REJECT' | 'SUSPEND';
  reason?: string | null;
  notes?: string | null;
  ip: string | null;
}

export async function decidePartnerVerification(input: VerificationDecisionInput): Promise<void> {
  const profile = await PartnerProfile.findById(input.partnerId);
  if (!profile) throw errors.notFound('Partner not found');
  const verification = await BusinessVerification.findOne({ partner: profile._id });
  if (!verification) throw errors.notFound('No verification submission found for this partner');

  const status =
    input.decision === 'APPROVE' ? 'VERIFIED' : input.decision === 'REJECT' ? 'REJECTED' : 'SUSPENDED';

  verification.status = status;
  verification.reviewedAt = new Date();
  verification.reviewedBy = new Types.ObjectId(input.actorId);
  verification.rejectionReason = input.decision === 'APPROVE' ? null : (input.reason ?? null);
  verification.reviewerNotes = input.notes ?? null;
  verification.documents = verification.documents.map((doc) => ({
    ...doc,
    status: input.decision === 'APPROVE' ? ('VERIFIED' as const) : doc.status,
    rejectionReason: input.decision === 'REJECT' ? (input.reason ?? null) : doc.rejectionReason,
  }));
  await verification.save();

  profile.verificationStatus = status;
  await profile.save();

  await recordAudit({
    actorId: input.actorId,
    action: `admin.partner_${status.toLowerCase()}`,
    entityType: 'PartnerProfile',
    entityId: String(profile._id),
    summary: `${profile.businessName} marked ${status}`,
    metadata: { decision: input.decision, reason: input.reason ?? null },
    ip: input.ip,
  });

  await notify({
    userId: String(profile.user),
    type: 'PARTNER_VERIFICATION_UPDATED',
    title:
      status === 'VERIFIED'
        ? 'Business verified'
        : status === 'REJECTED'
          ? 'Verification needs attention'
          : 'Account suspended',
    body:
      status === 'VERIFIED'
        ? 'Your business is verified. You can now publish listings.'
        : (input.reason ?? 'Please review the feedback in your verification tab.'),
    link: '/partner/verification',
  });
}

export async function listAdminListings(query: {
  page: number;
  limit: number;
  q?: string;
  status?: string;
  type?: string;
}): Promise<{ items: (ListingSummaryDTO & { partnerUserId: string })[]; total: number }> {
  const filter: Record<string, unknown> = { deletedAt: null };
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  if (query.q) {
    const regex = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: regex }, { 'location.city': regex }];
  }
  const [docs, total] = await Promise.all([
    Listing.find(filter)
      .sort({ updatedAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Listing.countDocuments(filter),
  ]);
  const items = await serializeListingPage(docs as unknown as ListingLean[], {});
  return {
    items: items.map((item, index) => ({
      ...item,
      partnerUserId: String((docs[index] as ListingFields & { _id: unknown }).partner),
    })),
    total,
  };
}

export async function moderateListing(
  actorId: string,
  listingId: string,
  decision: 'APPROVE' | 'REJECT' | 'SUSPEND' | 'UNSUSPEND',
  reason: string | null,
  ip: string | null,
): Promise<void> {
  const listing = await Listing.findById(listingId);
  if (!listing) throw errors.notFound('Listing not found');

  const statusMap = {
    APPROVE: 'PUBLISHED',
    REJECT: 'REJECTED',
    SUSPEND: 'SUSPENDED',
    UNSUSPEND: 'PUBLISHED',
  } as const;
  listing.status = statusMap[decision];
  listing.moderationReason = reason;
  listing.moderatedBy = new Types.ObjectId(actorId);
  listing.moderatedAt = new Date();
  if (decision === 'APPROVE' && !listing.publishedAt) listing.publishedAt = new Date();
  await listing.save();

  await recordAudit({
    actorId,
    action: `admin.listing_${decision.toLowerCase()}`,
    entityType: 'Listing',
    entityId: String(listing._id),
    summary: `${listing.title} → ${listing.status}`,
    metadata: { reason },
    ip,
  });

  const notifications = {
    APPROVE: {
      type: 'LISTING_PUBLISHED' as const,
      title: 'Listing approved',
      body: `${listing.title} is now live on the marketplace.`,
    },
    REJECT: {
      type: 'LISTING_REJECTED' as const,
      title: 'Listing needs changes',
      body: reason ?? `${listing.title} was not approved.`,
    },
    SUSPEND: {
      type: 'LISTING_REJECTED' as const,
      title: 'Listing suspended',
      body: reason ?? `${listing.title} has been suspended.`,
    },
    UNSUSPEND: {
      type: 'LISTING_PUBLISHED' as const,
      title: 'Listing restored',
      body: `${listing.title} is live again.`,
    },
  }[decision];

  await notify({
    userId: String(listing.partner),
    type: notifications.type,
    title: notifications.title,
    body: notifications.body,
    link: `/partner/listings/${String(listing._id)}/edit`,
  });
}

export async function listPayments(query: {
  page: number;
  limit: number;
  status?: string;
  q?: string;
}): Promise<{ items: PaymentDTO[]; total: number }> {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.q) filter.reference = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [docs, total] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Payment.countDocuments(filter),
  ]);
  const bookingIds = docs.map((d) => d.booking);
  const bookings = await Booking.find({ _id: { $in: bookingIds } }).select('reference').lean();
  const refMap = new Map(bookings.map((b) => [String(b._id), b.reference]));

  return {
    items: docs.map((doc) => ({
      id: String(doc._id),
      bookingId: String(doc.booking),
      reference: refMap.get(String(doc.booking)) ?? '',
      provider: doc.provider,
      providerPaymentId: doc.providerPaymentId ?? null,
      amount: doc.amountMinor,
      currency: (doc.currency ?? 'INR') as PaymentDTO['currency'],
      status: doc.status,
      method: doc.method ?? null,
      paidAt: doc.paidAt ? new Date(doc.paidAt).toISOString() : null,
      createdAt: new Date(doc.createdAt).toISOString(),
    })),
    total,
  };
}

export async function listRefunds(query: {
  page: number;
  limit: number;
  status?: string;
}): Promise<{ items: RefundDTO[]; total: number }> {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  const [docs, total] = await Promise.all([
    Refund.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Refund.countDocuments(filter),
  ]);
  return {
    items: docs.map((doc) => ({
      id: String(doc._id),
      paymentId: String(doc.payment),
      bookingId: String(doc.booking),
      amount: doc.amountMinor,
      currency: (doc.currency ?? 'INR') as RefundDTO['currency'],
      status: doc.status,
      reason: doc.reason ?? null,
      createdAt: new Date(doc.createdAt).toISOString(),
      processedAt: doc.processedAt ? new Date(doc.processedAt).toISOString() : null,
    })),
    total,
  };
}

export async function processRefundAdmin(actorId: string, refundId: string): Promise<void> {
  await completeRefund(refundId, { userId: actorId, role: 'ADMIN' });
}

function serializeDispute(dispute: DisputeFields & { _id: unknown }): DisputeDTO {
  return {
    id: String(dispute._id),
    reference: dispute.reference,
    bookingId: String(dispute.booking),
    bookingReference: '',
    openedBy: { id: String(dispute.openedBy), name: '', role: 'CUSTOMER' },
    againstParty: dispute.againstRole,
    reason: dispute.reason as DisputeDTO['reason'],
    description: dispute.description,
    status: dispute.status,
    resolutionNote: dispute.resolutionNote ?? null,
    createdAt: new Date(dispute.createdAt).toISOString(),
    updatedAt: new Date(dispute.updatedAt).toISOString(),
  };
}

export async function listDisputes(query: {
  page: number;
  limit: number;
  status?: string;
}): Promise<{ items: DisputeDTO[]; total: number }> {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  const [docs, total] = await Promise.all([
    Dispute.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Dispute.countDocuments(filter),
  ]);
  const bookingIds = docs.map((d) => d.booking);
  const bookings = await Booking.find({ _id: { $in: bookingIds } }).select('reference').lean();
  const refMap = new Map(bookings.map((b) => [String(b._id), b.reference]));
  const userIds = docs.map((d) => String(d.openedBy));
  const users = userIds.length ? await User.find({ _id: { $in: userIds } }).select('name').lean() : [];
  const userMap = new Map(users.map((u) => [String(u._id), u.name]));

  return {
    items: docs.map((doc) => {
      const dto = serializeDispute(doc as unknown as DisputeFields & { _id: unknown });
      return {
        ...dto,
        bookingReference: refMap.get(String(doc.booking)) ?? '',
        openedBy: {
          id: String(doc.openedBy),
          name: userMap.get(String(doc.openedBy)) ?? 'User',
          role: 'CUSTOMER',
        },
      };
    }),
    total,
  };
}

export async function resolveDispute(
  actorId: string,
  disputeId: string,
  input: DisputeResolutionInput,
  ip: string | null,
): Promise<void> {
  const dispute = await Dispute.findById(disputeId);
  if (!dispute) throw errors.notFound('Dispute not found');
  dispute.status = input.resolution;
  dispute.resolutionNote = input.resolutionNote;
  dispute.resolvedBy = new Types.ObjectId(actorId);
  dispute.resolvedAt = new Date();
  if (input.refundAmount != null) dispute.refundAmountMinor = input.refundAmount;
  await dispute.save();

  if (input.resolution === 'RESOLVED_CUSTOMER' && input.refundAmount && input.refundAmount > 0) {
    const booking = await Booking.findById(dispute.booking);
    if (booking) {
      const percent = Math.round(
        (input.refundAmount / Math.max(1, booking.pricing.totalMinor)) * 100,
      );
      await createRefundForBooking({
        bookingId: String(booking._id),
        refundPercent: Math.min(100, percent),
        reason: `Dispute resolution: ${input.resolutionNote}`,
        actor: { userId: actorId, role: 'ADMIN' },
      });
      await completeRefundForBooking(String(booking._id), actorId);
    }
  }

  await recordAudit({
    actorId,
    action: 'admin.dispute_resolved',
    entityType: 'Dispute',
    entityId: disputeId,
    summary: `Dispute ${dispute.reference} → ${input.resolution}`,
    metadata: { resolution: input.resolution, refundAmount: input.refundAmount ?? null },
    ip,
  });

  await notify({
    userId: String(dispute.openedBy),
    type: 'DISPUTE_RESOLVED',
    title: 'Dispute resolved',
    body: input.resolutionNote,
    link: '/dashboard/bookings',
  });
}

async function completeRefundForBooking(bookingId: string, actorId: string): Promise<void> {
  const refund = await Refund.findOne({ booking: bookingId, status: 'PENDING' }).sort({ createdAt: -1 });
  if (refund) await completeRefund(String(refund._id), { userId: actorId, role: 'ADMIN' });
}

export async function listCategories(includeInactive: boolean): Promise<CategoryDTO[]> {
  const filter = includeInactive ? {} : { isActive: true };
  const categories = await Category.find(filter).sort({ type: 1, sortOrder: 1 }).lean();
  const counts = await Listing.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { status: 'PUBLISHED', deletedAt: null } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  return categories.map((category) => ({
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    type: category.type,
    description: category.description ?? null,
    icon: category.icon ?? null,
    imageUrl: category.imageUrl ?? null,
    parentId: category.parent ? String(category.parent) : null,
    listingCount: countMap.get(String(category._id)) ?? 0,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
  }));
}

export async function createCategory(input: CategoryInput): Promise<CategoryDTO> {
  const existing = await Category.findOne({ slug: input.slug }).lean();
  if (existing) throw errors.conflict('A category with this slug already exists');
  const category = await Category.create({
    name: input.name,
    slug: input.slug,
    type: input.type,
    description: input.description ?? null,
    icon: input.icon ?? null,
    imageUrl: input.imageUrl ?? null,
    parent: input.parentId ?? null,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
  });
  return {
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    type: category.type,
    description: category.description ?? null,
    icon: category.icon ?? null,
    imageUrl: category.imageUrl ?? null,
    parentId: category.parent ? String(category.parent) : null,
    listingCount: 0,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
  };
}

export async function updateCategory(
  actorId: string,
  categoryId: string,
  input: Partial<CategoryInput>,
): Promise<void> {
  const category = await Category.findById(categoryId);
  if (!category) throw errors.notFound('Category not found');
  if (input.name) category.name = input.name;
  if (input.description !== undefined) category.description = input.description;
  if (input.icon !== undefined) category.icon = input.icon;
  if (input.imageUrl !== undefined) category.imageUrl = input.imageUrl;
  if (input.isActive !== undefined) category.isActive = input.isActive;
  if (input.sortOrder !== undefined) category.sortOrder = input.sortOrder;
  await category.save();
  await recordAudit({
    actorId,
    action: 'admin.category_updated',
    entityType: 'Category',
    entityId: categoryId,
    summary: `Category ${category.name} updated`,
  });
}

export async function getPlatformSettings(): Promise<PlatformSettingsDTO> {
  await ensureSettings();
  return toSettingsDTO(await getSettings());
}

export async function updatePlatformSettings(
  actorId: string,
  input: SettingsInput,
  ip: string | null,
): Promise<PlatformSettingsDTO> {
  const update: Record<string, unknown> = {};
  if (input.currency) update.currency = input.currency;
  if (input.platformFeePercent !== undefined) update.platformFeePercent = input.platformFeePercent;
  if (input.customerFeePercent !== undefined) update.customerFeePercent = input.customerFeePercent;
  if (input.taxPercent !== undefined) update.taxPercent = input.taxPercent;
  if (input.minPayoutAmount !== undefined) update.minPayoutAmountMinor = input.minPayoutAmount;
  if (input.supportEmail) update.supportEmail = input.supportEmail;
  if (input.allowSelfServiceListings !== undefined)
    update.allowSelfServiceListings = input.allowSelfServiceListings;
  if (input.requirePartnerVerification !== undefined)
    update.requirePartnerVerification = input.requirePartnerVerification;
  if (input.maintenanceMode !== undefined) update.maintenanceMode = input.maintenanceMode;
  if (input.announcement !== undefined) update.announcement = input.announcement;

  const settings = await PlatformSettings.findOneAndUpdate(
    { key: 'platform' },
    { $set: { ...update, updatedBy: new Types.ObjectId(actorId) } },
    { upsert: true, new: true },
  ).lean();
  invalidateSettingsCache();
  await recordAudit({
    actorId,
    action: 'admin.settings_updated',
    entityType: 'PlatformSettings',
    entityId: 'platform',
    summary: 'Platform settings updated',
    metadata: update as Record<string, unknown>,
    ip,
  });
  void settings;
  return toSettingsDTO(await getSettings());
}

export async function listAuditLogs(query: {
  page: number;
  limit: number;
  action?: string;
  entityType?: string;
  entityId?: string;
}): Promise<{ items: AuditLogDTO[]; total: number }> {
  const filter: Record<string, unknown> = {};
  if (query.action) filter.action = new RegExp(query.action, 'i');
  if (query.entityType) filter.entityType = query.entityType;
  if (query.entityId) filter.entityId = query.entityId;
  const [docs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  const actorIds = docs.map((d) => d.actor).filter(Boolean);
  const actors = actorIds.length
    ? await User.find({ _id: { $in: actorIds } }).select('name role').lean()
    : [];
  const actorMap = new Map(actors.map((a) => [String(a._id), a]));

  return {
    items: docs.map((doc) => ({
      id: String(doc._id),
      actor: {
        id: doc.actor ? String(doc.actor) : 'system',
        name: actorMap.get(String(doc.actor))?.name ?? 'System',
        role: (actorMap.get(String(doc.actor))?.role ?? 'ADMIN') as AuditLogDTO['actor']['role'],
      },
      action: doc.action,
      entityType: doc.entityType,
      entityId: doc.entityId,
      summary: doc.summary ?? null,
      metadata: doc.metadata ?? null,
      ip: doc.ip ?? null,
      createdAt: new Date(doc.createdAt).toISOString(),
    })),
    total,
  };
}

export async function moderateReviewByAdmin(
  actorId: string,
  reviewId: string,
  input: z.infer<typeof reviewModerationSchema>,
    ip: string | null,
): Promise<void> {
  const review = await Review.findById(reviewId);
  if (!review) throw errors.notFound('Review not found');
  await moderateReview(reviewId, input.status, review.listing);
  await recordAudit({
    actorId,
    action: `admin.review_${input.status.toLowerCase()}`,
    entityType: 'Review',
    entityId: reviewId,
    summary: `Review marked ${input.status}`,
    metadata: { note: input.note ?? null },
    ip,
  });
}

export { partnerSummariesFor, serializePartnerSummary, serializeInvoice, serializeBooking };
