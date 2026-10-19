import { Types, type HydratedDocument } from 'mongoose';
import type { z } from 'zod';
import type {
  AvailabilityRuleDTO,
  BusinessVerificationDTO,
  Currency,
  ListingSummaryDTO,
  PartnerDashboardDTO,
  PartnerProfileDTO,
} from '@bmw/shared-types';
import type { partnerOnboardingSchema, submitVerificationSchema, availabilityRuleSchema, availabilityExceptionSchema, payoutDetailsSchema } from '@bmw/validation';
import { errors } from '../lib/errors.js';
import {
  AvailabilityException,
  AvailabilityRule,
  Booking,
  Listing,
  PartnerProfile,
  Payment,
  Review,
  User,
  BusinessVerification,
  type PartnerProfileFields,
} from '../models/index.js';

type PartnerProfileDocument = HydratedDocument<PartnerProfileFields>;
import { serializePartnerSummary, serializeAvailabilityRule, serializeLocation } from '../serializers/listing.serializer.js';
import { serializeListingPage, requireOwnListing, type ListingLean } from './listing.service.js';
import { getSettings } from './settings.service.js';
import { notify } from './notification.service.js';
import { renderBooking } from './booking.service.js';

type OnboardingInput = z.infer<typeof partnerOnboardingSchema>;
type VerificationInput = z.infer<typeof submitVerificationSchema>;
type RuleInput = z.infer<typeof availabilityRuleSchema>;
type ExceptionInput = z.infer<typeof availabilityExceptionSchema>;
type PayoutInput = z.infer<typeof payoutDetailsSchema>;

export async function getOrCreatePartnerProfile(userId: string): Promise<PartnerProfileDocument> {
  const existing = await PartnerProfile.findOne({ user: userId });
  if (existing) return existing;
  const user = await User.findById(userId).lean();
  if (!user) throw errors.notFound('Account not found');
  return PartnerProfile.create({
    user: userId,
    businessName: `${user.name}'s business`,
    verificationStatus: 'DRAFT',
  });
}

export async function serializePartnerProfile(
  userId: string,
  includeSensitive = false,
): Promise<PartnerProfileDTO> {
  const profile = await getOrCreatePartnerProfile(userId);
  const verificationQuery = BusinessVerification.findOne({ partner: profile._id });
  if (!includeSensitive) verificationQuery.select('-gstNumber -panNumber');
  const verification = await verificationQuery.lean();

  const [activeListings, totalBookings] = await Promise.all([
    Listing.countDocuments({ partner: userId, status: 'PUBLISHED', deletedAt: null }),
    Booking.countDocuments({ partner: userId }),
  ]);

  const verificationDto: BusinessVerificationDTO | null = verification
    ? {
        id: String(verification._id),
        partnerId: String(verification.partner),
        status: verification.status,
        legalBusinessName: verification.legalBusinessName ?? null,
        businessType: verification.businessType ?? null,
        gstNumber: verification.gstNumber ?? null,
        panNumber: verification.panNumber ?? null,
        registrationNumber: verification.registrationNumber ?? null,
        address: verification.address ? serializeLocation(verification.address) : null,
        documents: (verification.documents ?? []).map((doc) => ({
          id: String(doc._id),
          label: doc.label,
          url: doc.url,
          status: doc.status,
          uploadedAt: new Date(doc.uploadedAt).toISOString(),
          rejectionReason: doc.rejectionReason ?? null,
        })),
        submittedAt: verification.submittedAt ? new Date(verification.submittedAt).toISOString() : null,
        reviewedAt: verification.reviewedAt ? new Date(verification.reviewedAt).toISOString() : null,
        reviewedBy: verification.reviewedBy ? String(verification.reviewedBy) : null,
        rejectionReason: verification.rejectionReason ?? null,
        reviewerNotes: verification.reviewerNotes ?? null,
      }
    : null;

  return {
    userId,
    businessName: profile.businessName,
    businessType: profile.businessType ?? null,
    description: profile.description ?? null,
    address: profile.address ? serializeLocation(profile.address) : null,
    website: profile.website ?? null,
    logoUrl: profile.logoUrl ?? null,
    verificationStatus: profile.verificationStatus,
    verification: verificationDto,
    responseRate: profile.responseRate,
    averageResponseMinutes: profile.averageResponseMinutes,
    totalBookings,
    activeListings,
    joinedAt: new Date(profile.createdAt).toISOString(),
  };
}

export async function onboardPartner(userId: string, input: OnboardingInput): Promise<PartnerProfileDTO> {
  const profile = await getOrCreatePartnerProfile(userId);
  profile.businessName = input.businessName;
  profile.businessType = input.businessType;
  profile.description = input.description ?? profile.description;
  profile.address = {
    addressLine1: input.address.addressLine1,
    addressLine2: input.address.addressLine2 ?? null,
    landmark: input.address.landmark ?? null,
    city: input.address.city,
    state: input.address.state,
    postalCode: input.address.postalCode,
    country: input.address.country ?? 'India',
    region: input.address.region ?? null,
    coordinates: { lat: input.address.coordinates?.lat ?? null, lng: input.address.coordinates?.lng ?? null },
    serviceRadiusKm: input.address.serviceRadiusKm ?? null,
  };
  profile.website = input.website ?? null;
  profile.logoUrl = input.logoUrl ?? null;
  profile.supportedTypes = input.supportedTypes;
  if (!profile.onboardingCompletedAt) profile.onboardingCompletedAt = new Date();
  if (profile.verificationStatus === 'DRAFT' && input.supportedTypes.length > 0) {
    profile.verificationStatus = 'DRAFT';
  }
  await profile.save();
  return serializePartnerProfile(userId);
}

export async function submitVerification(
  userId: string,
  input: VerificationInput,
): Promise<PartnerProfileDTO> {
  const profile = await getOrCreatePartnerProfile(userId);
  if (profile.verificationStatus === 'VERIFIED') {
    throw errors.precondition('Your business is already verified');
  }
  if (profile.verificationStatus === 'UNDER_REVIEW') {
    throw errors.precondition('Your documents are already under review');
  }

  const verification = await BusinessVerification.findOne({ partner: profile._id });
  if (verification && verification.status === 'REJECTED') {
    // Rejection reason must be cleared by re-submitting new documents.
    verification.rejectionReason = null;
  }
  const target = verification ?? (await BusinessVerification.create({ partner: profile._id }));

  target.legalBusinessName = input.legalBusinessName;
  target.businessType = input.businessType;
  target.gstNumber = input.gstNumber ?? null;
  target.panNumber = input.panNumber ?? null;
  target.registrationNumber = input.registrationNumber ?? null;
  target.address = {
    addressLine1: input.address.addressLine1,
    addressLine2: input.address.addressLine2 ?? null,
    landmark: input.address.landmark ?? null,
    city: input.address.city,
    state: input.address.state,
    postalCode: input.address.postalCode,
    country: input.address.country ?? 'India',
    region: input.address.region ?? null,
    coordinates: { lat: input.address.coordinates?.lat ?? null, lng: input.address.coordinates?.lng ?? null },
    serviceRadiusKm: input.address.serviceRadiusKm ?? null,
  };
  target.documents = input.documents.map((doc) => ({
    label: doc.label,
    url: doc.url,
    status: 'UPLOADED' as const,
    uploadedAt: new Date(),
    rejectionReason: null,
  }));
  target.status = 'SUBMITTED';
  target.submittedAt = new Date();
  await target.save();

  profile.verificationStatus = 'SUBMITTED';
  await profile.save();

  const admins = await User.find({ role: 'ADMIN', status: 'ACTIVE' }).select('_id').lean();
  await Promise.all(
    admins.map((admin) =>
      notify({
        userId: String(admin._id),
        type: 'PARTNER_VERIFICATION_SUBMITTED',
        title: 'Partner verification submitted',
        body: `${profile.businessName} submitted verification documents.`,
        link: `/admin/verification`,
      }),
    ),
  );

  return serializePartnerProfile(userId);
}

export async function updatePayoutDetails(userId: string, input: PayoutInput): Promise<void> {
  const profile = await getOrCreatePartnerProfile(userId);
  // Only a masked account number is stored — never the full number.
  const masked = `XXXX${input.accountNumber.slice(-4)}`;
  profile.payoutDetails = {
    accountHolderName: input.accountHolderName,
    accountNumberMasked: masked,
    ifsc: input.ifsc.toUpperCase(),
    bankName: input.bankName,
    upiId: input.upiId ?? null,
    updatedAt: new Date(),
  };
  await profile.save();
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function partnerDashboard(userId: string): Promise<PartnerDashboardDTO> {
  const profile = await getOrCreatePartnerProfile(userId);
  const settings = await getSettings();
  const since30 = new Date(Date.now() - 30 * DAY_MS);

  const [
    activeListings,
    draftListings,
    pendingRequests,
    confirmedBookings,
    completedBookings,
    cancelledBookings,
    upcoming,
    recentRequests,
    ratingAgg,
    revenueAgg,
    last30Agg,
  ] = await Promise.all([
    Listing.countDocuments({ partner: userId, status: 'PUBLISHED', deletedAt: null }),
    Listing.countDocuments({ partner: userId, status: { $in: ['DRAFT', 'PENDING_REVIEW'] }, deletedAt: null }),
    Booking.countDocuments({ partner: userId, status: 'PENDING_APPROVAL' }),
    Booking.countDocuments({ partner: userId, status: { $in: ['CONFIRMED', 'IN_PROGRESS'] } }),
    Booking.countDocuments({ partner: userId, status: 'COMPLETED' }),
    Booking.countDocuments({ partner: userId, status: { $in: ['CANCELLED', 'REJECTED'] } }),
    Booking.find({ partner: userId, status: { $in: ['CONFIRMED', 'IN_PROGRESS'] }, startDate: { $gte: new Date() } })
      .sort({ startDate: 1 })
      .limit(5)
      .lean(),
    Booking.find({ partner: userId, status: 'PENDING_APPROVAL' })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Review.aggregate<{ _id: null; average: number; count: number }>([
      { $match: { partner: new Types.ObjectId(userId), status: 'PUBLISHED' } },
      { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate<{ _id: null; total: number }>([
      {
        $lookup: {
          from: 'bookings',
          localField: 'booking',
          foreignField: '_id',
          as: 'bookingDoc',
        },
      },
      { $unwind: '$bookingDoc' },
      { $match: { 'bookingDoc.partner': new Types.ObjectId(userId), status: 'SUCCEEDED' } },
      { $group: { _id: null, total: { $sum: '$amountMinor' } } },
    ]),
    Payment.aggregate<{ _id: null; total: number }>([
      {
        $lookup: {
          from: 'bookings',
          localField: 'booking',
          foreignField: '_id',
          as: 'bookingDoc',
        },
      },
      { $unwind: '$bookingDoc' },
      {
        $match: {
          'bookingDoc.partner': new Types.ObjectId(userId),
          status: 'SUCCEEDED',
          paidAt: { $gte: since30 },
        },
      },
      { $group: { _id: null, total: { $sum: '$amountMinor' } } },
    ]),
  ]);

  const trends = await Booking.aggregate<{ _id: string; bookings: number; revenue: number }>([
    { $match: { partner: new Types.ObjectId(userId), createdAt: { $gte: new Date(Date.now() - 14 * DAY_MS) } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        bookings: { $sum: 1 },
        revenue: { $sum: '$pricing.subtotalMinor' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const rating = ratingAgg[0];
  const totalGross = revenueAgg[0]?.total ?? 0;
  const platformFeeMinor = Math.round((totalGross * settings.platformFeePercent) / 100);

  return {
    verificationStatus: profile.verificationStatus,
    totals: {
      activeListings,
      draftListings,
      pendingRequests,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      unreadMessages: 0,
      averageRating: rating ? Math.round(rating.average * 10) / 10 : 0,
      reviewCount: rating?.count ?? 0,
    },
    revenue: {
      currency: settings.currency as Currency,
      totalEarned: Math.max(0, totalGross - platformFeeMinor),
      pendingPayout: 0,
      last30Days: last30Agg[0]?.total ?? 0,
    },
    responseRate: profile.responseRate ?? 0,
    trends: trends.map((t) => ({ date: t._id, bookings: t.bookings, revenue: t.revenue })),
    upcomingBookings: await Promise.all(upcoming.map((doc) => renderBooking(doc as never))),
    recentRequests: await Promise.all(recentRequests.map((doc) => renderBooking(doc as never))),
  };
}

export async function listPartnerListings(
  userId: string,
  query: { page: number; limit: number; status?: string; type?: string; q?: string },
): Promise<{ items: ListingSummaryDTO[]; total: number }> {
  const filter: Record<string, unknown> = { partner: userId, deletedAt: null };
  if (query.status) {
    const statuses = query.status.split(',').map((s) => s.trim().toUpperCase());
    filter.status = { $in: statuses };
  }
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
  return { items, total };
}

export async function partnerEarnings(
  userId: string,
  query: { page: number; limit: number },
): Promise<{
  items: {
    id: string;
    bookingReference: string;
    listingTitle: string;
    grossAmount: number;
    platformFee: number;
    netAmount: number;
    currency: string;
    paidAt: string | null;
  }[];
  total: number;
  summary: { gross: number; fees: number; net: number; currency: string };
}> {
  const payments = await Payment.aggregate([
    {
      $lookup: {
        from: 'bookings',
        localField: 'booking',
        foreignField: '_id',
        as: 'bookingDoc',
      },
    },
    { $unwind: '$bookingDoc' },
    { $match: { 'bookingDoc.partner': new Types.ObjectId(userId), status: 'SUCCEEDED' } },
    { $sort: { paidAt: -1 } },
    { $skip: (query.page - 1) * query.limit },
    { $limit: query.limit },
    {
      $project: {
        amountMinor: 1,
        currency: 1,
        paidAt: 1,
        reference: '$bookingDoc.reference',
        listingTitle: '$bookingDoc.listingSnapshot.title',
      },
    },
  ]);

  const settings = await getSettings();
  const partnerBookingIds = (
    await Booking.find({ partner: userId }).select('_id').lean()
  ).map((b) => b._id);
  const [total, summaryAgg] = await Promise.all([
    Payment.countDocuments({
      status: 'SUCCEEDED',
      booking: { $in: partnerBookingIds },
    }),
    Payment.aggregate<{ _id: null; gross: number }>([
      {
        $match: {
          status: 'SUCCEEDED',
          booking: { $in: partnerBookingIds },
        },
      },
      { $group: { _id: null, gross: { $sum: '$amountMinor' } } },
    ]),
  ]);

  const gross = summaryAgg[0]?.gross ?? 0;
  const fees = Math.round((gross * settings.platformFeePercent) / 100);

  return {
    items: payments.map((p) => {
      const fee = Math.round((p.amountMinor * settings.platformFeePercent) / 100);
      return {
        id: String(p._id),
        bookingReference: p.reference,
        listingTitle: p.listingTitle,
        grossAmount: p.amountMinor,
        platformFee: fee,
        netAmount: p.amountMinor - fee,
        currency: p.currency,
        paidAt: p.paidAt ? new Date(p.paidAt).toISOString() : null,
      };
    }),
    total,
    summary: {
      gross,
      fees,
      net: Math.max(0, gross - fees),
      currency: settings.currency,
    },
  };
}

export async function addAvailabilityRule(userId: string, input: RuleInput): Promise<AvailabilityRuleDTO> {
  const listing = await requireOwnListing(userId, input.listingId);
  const rule = await AvailabilityRule.create({
    listing: listing._id,
    daysOfWeek: input.daysOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
  });
  return serializeAvailabilityRule(rule.toObject() as never);
}

export async function removeAvailabilityRule(userId: string, ruleId: string): Promise<void> {
  const rule = await AvailabilityRule.findById(ruleId).lean();
  if (!rule) throw errors.notFound('Rule not found');
  await requireOwnListing(userId, String(rule.listing));
  await AvailabilityRule.deleteOne({ _id: ruleId });
}

export async function addAvailabilityException(
  userId: string,
  input: ExceptionInput,
): Promise<{ id: string }> {
  const listing = await requireOwnListing(userId, input.listingId);
  const day = new Date(
    Date.UTC(input.date.getUTCFullYear(), input.date.getUTCMonth(), input.date.getUTCDate()),
  );
  const exception = await AvailabilityException.findOneAndUpdate(
    { listing: listing._id, date: day },
    { $set: { reason: input.reason ?? null, isAvailable: input.isAvailable } },
    { upsert: true, new: true },
  );
  return { id: String(exception._id) };
}

export async function removeAvailabilityException(userId: string, exceptionId: string): Promise<void> {
  const exception = await AvailabilityException.findById(exceptionId).lean();
  if (!exception) throw errors.notFound('Blocked date not found');
  await requireOwnListing(userId, String(exception.listing));
  await AvailabilityException.deleteOne({ _id: exceptionId });
}

export { serializePartnerSummary };
