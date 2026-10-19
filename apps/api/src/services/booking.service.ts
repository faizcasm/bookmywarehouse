import { Types } from 'mongoose';
import type { z } from 'zod';
import type { BookingDTO, BookingStatus, NotificationType, Role } from '@bmw/shared-types';
import { BOOKING_TRANSITIONS, canTransition } from '@bmw/shared-types';
import type { createBookingSchema, quoteBookingSchema, bookingListQuerySchema } from '@bmw/validation';
import { errors } from '../lib/errors.js';
import { bookingReference } from '../lib/ids.js';
import {
  Booking,
  EquipmentDetails,
  Listing,
  PartnerProfile,
  Payment,
  ServiceDetails,
  User,
  WarehouseDetails,
  type BookingDocument,
  type BookingFields,
  type ListingFields,
} from '../models/index.js';
import { serializeBooking } from '../serializers/booking.serializer.js';
import {
  checkCapacity,
  checkDateRange,
  getListingAvailability,
} from './availability.service.js';
import { computeQuote, type QuoteResult } from './pricing.service.js';
import { getSettings } from './settings.service.js';
import { notify } from './notification.service.js';
import { partnerSummariesFor } from './listing.service.js';

type QuoteInput = z.infer<typeof quoteBookingSchema>;
type CreateBookingInputType = z.infer<typeof createBookingSchema>;
export type BookingListQueryType = z.infer<typeof bookingListQuerySchema>;

export type ListingWithDetails = ListingFields & { _id: Types.ObjectId };

export interface ListingContext {
  listing: ListingWithDetails;
  warehouse: { totalCapacity: number; capacityUnit: string } | null;
  equipment: { quantity: number; operatorChargePerDayMinor: number | null } | null;
  service: { dailyCapacity: number | null } | null;
}

export async function loadListingContext(listingId: string): Promise<ListingContext> {
  const listing = (await Listing.findOne({
    _id: new Types.ObjectId(listingId),
    deletedAt: null,
  }).lean()) as unknown as ListingWithDetails | null;
  if (!listing) throw errors.notFound('Listing not found');
  if (listing.status !== 'PUBLISHED') {
    throw errors.precondition('This listing is not available for booking');
  }
  const [warehouse, equipment, service] = await Promise.all([
    listing.warehouse ? WarehouseDetails.findById(listing.warehouse).lean() : null,
    listing.equipment ? EquipmentDetails.findById(listing.equipment).lean() : null,
    listing.service ? ServiceDetails.findById(listing.service).lean() : null,
  ]);
  return {
    listing,
    warehouse: warehouse ? { totalCapacity: warehouse.totalCapacity, capacityUnit: warehouse.capacityUnit } : null,
    equipment: equipment
      ? { quantity: equipment.quantity, operatorChargePerDayMinor: equipment.operatorChargePerDayMinor }
      : null,
    service: service ? { dailyCapacity: service.dailyCapacity } : null,
  };
}

function totalCapacityOf(context: ListingContext): number {
  return (
    context.warehouse?.totalCapacity ?? context.equipment?.quantity ?? context.service?.dailyCapacity ?? 0
  );
}

export interface ComputedQuote extends QuoteResult {
  currency: string;
}

export async function quoteBooking(input: QuoteInput): Promise<{
  quote: ComputedQuote;
  context: ListingContext;
  availability: { available: boolean; reason?: string; remaining?: number };
}> {
  const context = await loadListingContext(input.listingId);
  const settings = await getSettings();
  const availability = await getListingAvailability(String(context.listing._id));

  const rangeCheck = checkDateRange(
    availability.rules,
    availability.blockedDates,
    input.startDate,
    input.endDate ?? null,
  );
  if (!rangeCheck.available) {
    return {
      quote: null as never,
      context,
      availability: { available: false, reason: rangeCheck.reason },
    };
  }

  const capacityCheck = await checkCapacity({
    listing: context.listing,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    requestedCapacity: input.capacity ?? null,
    quantity: input.quantity,
    totalCapacity: totalCapacityOf(context),
    dailyCapacity: context.service?.dailyCapacity ?? null,
  });
  if (!capacityCheck.available) {
    return {
      quote: null as never,
      context,
      availability: {
        available: false,
        reason: capacityCheck.reason,
        remaining: capacityCheck.remaining,
      },
    };
  }

  const quote = computeQuote({
    price: {
      model: context.listing.price.model,
      amountMinor: context.listing.price.amountMinor,
      currency: context.listing.price.currency,
      period: context.listing.price.period,
      unitLabel: context.listing.price.unitLabel,
      additionalCharges: context.listing.price.additionalCharges.map((charge) => ({
        label: charge.label,
        amountMinor: charge.amount,
        taxable: charge.taxable,
      })),
      operatorChargePerDayMinor: context.equipment?.operatorChargePerDayMinor ?? null,
    },
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    capacity: input.capacity ?? null,
    quantity: input.quantity,
    operatorRequired: input.operatorRequired ?? false,
    settings,
  });

  return { quote, context, availability: { available: true, remaining: capacityCheck.remaining } };
}

/** Enriches a booking document with the display names needed by the UI. */
export async function renderBooking(booking: BookingFields & { _id: unknown }): Promise<BookingDTO> {
  const [customer, partnerProfile, payment] = await Promise.all([
    User.findById(booking.customer).select('name avatarUrl').lean(),
    PartnerProfile.findOne({ user: booking.partner }).select('businessName verificationStatus').lean(),
    booking.payment ? Payment.findById(booking.payment).lean() : null,
  ]);
  return serializeBooking(booking, {
    customer: customer
      ? { id: String(customer._id), name: customer.name, avatarUrl: customer.avatarUrl }
      : undefined,
    partner: partnerProfile
      ? { businessName: partnerProfile.businessName, verified: partnerProfile.verificationStatus === 'VERIFIED' }
      : undefined,
    payment: payment as never,
  });
}

export async function createBookingRequest(
  customerId: string,
  input: CreateBookingInputType,
): Promise<BookingFields & { _id: unknown }> {
  const { quote, context, availability } = await quoteBooking(input);
  if (!availability.available) {
    throw errors.capacityUnavailable(availability.reason ?? 'Not available for the requested dates');
  }
  const customer = await User.findById(customerId).lean();
  if (!customer) throw errors.unauthenticated();

  const booking = await Booking.create({
    reference: bookingReference(),
    type: context.listing.type,
    listing: context.listing._id,
    listingSnapshot: {
      title: context.listing.title,
      slug: context.listing.slug,
      type: context.listing.type,
      coverImage: context.listing.images[0] ?? null,
      city: context.listing.location.city,
      partner: context.listing.partner,
    },
    customer: customer._id,
    partner: context.listing.partner,
    status: 'PENDING_APPROVAL',
    statusHistory: [
      { status: 'PENDING_APPROVAL', at: new Date(), byRole: 'CUSTOMER', note: 'Request submitted' },
    ],
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    requestedCapacity: input.capacity ?? null,
    capacityUnit: context.warehouse ? (context.warehouse.capacityUnit as never) : null,
    quantity: input.quantity,
    minBookingDuration: context.listing.minBookingDuration ?? null,
    notes: input.notes ?? null,
    specialRequirements: input.specialRequirements ?? null,
    pricing: {
      currency: quote.currency,
      subtotalMinor: quote.subtotalMinor,
      platformFeeMinor: quote.platformFeeMinor,
      taxesMinor: quote.taxesMinor,
      discountMinor: quote.discountMinor,
      totalMinor: quote.totalMinor,
      breakdown: quote.breakdown.map((line) => ({ label: line.label, amountMinor: line.amountMinor })),
      rateDescription: quote.rateDescription,
    },
    items: [
      {
        listing: context.listing._id,
        title: context.listing.title,
        type: context.listing.type,
        quantity: quote.billableUnits,
        unitLabel: quote.billableUnitLabel,
        unitPriceMinor: context.listing.price.amountMinor,
        amountMinor: quote.subtotalMinor,
        currency: quote.currency,
      },
    ],
    blocksCapacity: true,
  });

  await notify({
    userId: String(context.listing.partner),
    type: 'BOOKING_REQUESTED',
    title: 'New booking request',
    body: `${customer.name} requested ${context.listing.title} from ${input.startDate.toDateString()}.`,
    link: `/partner/bookings/${String(booking._id)}`,
  });

  return booking as unknown as BookingFields & { _id: unknown };
}

export interface TransitionActor {
  userId: string;
  role: Role;
}

export async function transitionBooking(
  bookingId: string,
  target: BookingStatus,
  actor: TransitionActor,
  options: { note?: string | null; reason?: string | null } = {},
): Promise<BookingFields & { _id: unknown }> {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw errors.notFound('Booking not found');

  const isCustomer = String(booking.customer) === actor.userId;
  const isPartner = String(booking.partner) === actor.userId;
  if (!isCustomer && !isPartner && actor.role !== 'ADMIN') {
    throw errors.forbidden('You are not part of this booking');
  }

  if (!canTransition(booking.status, target)) {
    throw errors.invalidTransition(
      `Cannot move a ${booking.status.toLowerCase()} booking to ${target.toLowerCase()}`,
    );
  }

  // Actor permissions per transition.
  if (target === 'REJECTED' && !isPartner && actor.role !== 'ADMIN') {
    throw errors.forbidden('Only the partner can reject a booking request');
  }
  if (target === 'AWAITING_PAYMENT' && !isPartner && actor.role !== 'ADMIN') {
    throw errors.forbidden('Only the partner can approve a booking request');
  }
  if (target === 'CONFIRMED' && !isPartner && actor.role !== 'ADMIN') {
    throw errors.forbidden('Only the partner can confirm this booking');
  }
  if (target === 'CANCELLED' && !isCustomer && !isPartner && actor.role !== 'ADMIN') {
    throw errors.forbidden('Only the customer or partner can cancel this booking');
  }
  if (target === 'COMPLETED' && !isPartner && actor.role !== 'ADMIN') {
    throw errors.forbidden('Only the partner can mark a booking as completed');
  }
  if (target === 'IN_PROGRESS' && !isCustomer && !isPartner && actor.role !== 'ADMIN') {
    throw errors.forbidden('Only the customer or partner can start this booking');
  }
  if ((target === 'REFUND_PENDING' || target === 'DISPUTED') && !isCustomer && !isPartner && actor.role !== 'ADMIN') {
    throw errors.forbidden('Only booking participants can raise this status');
  }
  if (target === 'REFUNDED' && actor.role !== 'ADMIN') {
    throw errors.forbidden('Only administrators can mark a refund as processed');
  }

  if (
    (booking.status === 'CONFIRMED' || booking.status === 'PENDING_APPROVAL') &&
    target === 'CANCELLED' &&
    isPartner &&
    actor.role !== 'ADMIN' &&
    !options.reason
  ) {
    throw errors.badRequest('Provide a reason when cancelling a booking');
  }

  booking.status = target;
  booking.statusHistory.push({
    status: target,
    at: new Date(),
    byRole: actor.role,
    note: options.note ?? options.reason ?? null,
  });

  if (target === 'CANCELLED') {
    booking.cancellationReason = options.reason ?? options.note ?? null;
    booking.cancelledBy = new Types.ObjectId(actor.userId);
  }
  if (target === 'REJECTED') {
    booking.rejectionReason = options.reason ?? options.note ?? null;
  }

  await booking.save();

  const counterparty = isCustomer ? String(booking.partner) : String(booking.customer);
  const notifications: Partial<Record<BookingStatus, { type: NotificationType; title: string; body: string }>> = {
    REJECTED: {
      type: 'BOOKING_REJECTED',
      title: 'Booking request declined',
      body: `The partner declined booking ${booking.reference}. ${options.reason ?? ''}`.trim(),
    },
    CONFIRMED: {
      type: 'BOOKING_ACCEPTED',
      title: 'Booking confirmed',
      body: `Booking ${booking.reference} for ${booking.listingSnapshot.title} is confirmed.`,
    },
    CANCELLED: {
      type: 'BOOKING_CANCELLED',
      title: 'Booking cancelled',
      body: `Booking ${booking.reference} has been cancelled.`,
    },
    COMPLETED: {
      type: 'BOOKING_COMPLETED',
      title: 'Booking completed',
      body: `Booking ${booking.reference} is marked complete. You can now leave a review.`,
    },
    IN_PROGRESS: {
      type: 'BOOKING_ACCEPTED',
      title: 'Booking in progress',
      body: `Booking ${booking.reference} has started.`,
    },
    DISPUTED: {
      type: 'DISPUTE_OPENED',
      title: 'Dispute opened',
      body: `A dispute has been opened for booking ${booking.reference}. Our team will review it.`,
    },
    REFUNDED: {
      type: 'REFUND_PROCESSED',
      title: 'Refund processed',
      body: `Your refund for booking ${booking.reference} has been processed.`,
    },
    REFUND_PENDING: {
      type: 'REFUND_PROCESSED',
      title: 'Refund requested',
      body: `A refund request for booking ${booking.reference} is being processed.`,
    },
  };
  const message = notifications[target];
  if (message) {
    await notify({
      userId: counterparty,
      type: message.type,
      title: message.title,
      body: message.body,
      link: `/dashboard/bookings/${String(booking._id)}`,
    });
  }

  return booking as unknown as BookingFields & { _id: unknown };
}

/**
 * System-driven transition used by the payment webhook. Skips per-actor checks
 * (the gateway is the authority for payment outcomes) but still enforces the
 * booking state machine.
 */
export async function markBookingPaid(bookingId: string): Promise<void> {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw errors.notFound('Booking not found');
  if (booking.status === 'CONFIRMED') return;
  if (!canTransition(booking.status, 'CONFIRMED')) {
    throw errors.invalidTransition(
      `Payment arrived for a booking in status ${booking.status.toLowerCase()}`,
    );
  }
  booking.status = 'CONFIRMED';
  booking.statusHistory.push({
    status: 'CONFIRMED',
    at: new Date(),
    byRole: 'ADMIN',
    note: 'Payment received',
  });
  await booking.save();
  await notify({
    userId: String(booking.customer),
    type: 'BOOKING_ACCEPTED',
    title: 'Booking confirmed',
    body: `Payment received — booking ${booking.reference} is confirmed.`,
    link: `/dashboard/bookings/${String(booking._id)}`,
  });
  await notify({
    userId: String(booking.partner),
    type: 'PAYMENT_SUCCEEDED',
    title: 'Payment received',
    body: `Payment for booking ${booking.reference} has been received.`,
    link: `/partner/bookings/${String(booking._id)}`,
  });
}

/** Moves a booking to REFUND_PENDING and records who asked for it. */
export async function requestRefundState(bookingId: string, reason: string): Promise<void> {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw errors.notFound('Booking not found');
  if (!canTransition(booking.status, 'REFUND_PENDING')) return;
  booking.status = 'REFUND_PENDING';
  booking.statusHistory.push({ status: 'REFUND_PENDING', at: new Date(), byRole: 'CUSTOMER', note: reason });
  await booking.save();
}

/** Partner accepts a request: moves to AWAITING_PAYMENT when money is due. */
export async function acceptBooking(bookingId: string, actor: TransitionActor): Promise<BookingFields & { _id: unknown }> {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw errors.notFound('Booking not found');
  const next: BookingStatus = booking.pricing.totalMinor > 0 ? 'AWAITING_PAYMENT' : 'CONFIRMED';
  const updated = await transitionBooking(bookingId, next, actor, {
    note: next === 'AWAITING_PAYMENT' ? 'Request approved, awaiting payment' : 'Request approved',
  });
  await updatePartnerResponseStats(String(booking.partner), true);
  return updated;
}

export async function rejectBooking(
  bookingId: string,
  actor: TransitionActor,
  reason: string,
): Promise<BookingFields & { _id: unknown }> {
  const updated = await transitionBooking(bookingId, 'REJECTED', actor, { reason });
  const booking = await Booking.findById(bookingId).lean();
  if (booking) await updatePartnerResponseStats(String(booking.partner), true);
  return updated;
}

async function updatePartnerResponseStats(partnerUserId: string, responded: boolean): Promise<void> {
  if (!responded) return;
  const profile = await PartnerProfile.findOne({ user: partnerUserId });
  if (!profile) return;
  const total = await Booking.countDocuments({ partner: partnerUserId });
  const respondedCount = await Booking.countDocuments({
    partner: partnerUserId,
    status: { $nin: ['PENDING_APPROVAL', 'DRAFT'] },
  });
  profile.totalBookings = total;
  profile.responseRate = total > 0 ? Math.round((respondedCount / total) * 100) : null;
  await profile.save();
}

export interface BookingQueryScope {
  role: 'customer' | 'partner' | 'admin';
  userId: string;
}

export async function listBookings(
  scope: BookingQueryScope,
  query: BookingListQueryType,
): Promise<{ items: (BookingFields & { _id: unknown })[]; total: number }> {
  const filter: Record<string, unknown> = {};
  if (scope.role === 'customer') filter.customer = new Types.ObjectId(scope.userId);
  else if (scope.role === 'partner') filter.partner = new Types.ObjectId(scope.userId);

  if (query.status) {
    const statuses = query.status
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => (BOOKING_TRANSITIONS as Record<string, unknown>)[s] !== undefined);
    if (statuses.length > 0) filter.status = { $in: statuses };
  }
  if (query.type) filter.type = query.type;
  if (query.q) {
    const regex = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { reference: regex },
      { 'listingSnapshot.title': regex },
      { 'listingSnapshot.city': regex },
    ];
  }
  if (query.from || query.to) {
    filter.startDate = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }

  const [docs, total] = await Promise.all([
    Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Booking.countDocuments(filter),
  ]);
  return { items: docs as unknown as (BookingFields & { _id: unknown })[], total };
}

export async function getBookingForViewer(
  bookingId: string,
  actor: { userId: string; role: Role },
): Promise<BookingFields & { _id: unknown }> {
  if (!Types.ObjectId.isValid(bookingId)) throw errors.notFound('Booking not found');
  const booking = (await Booking.findById(bookingId).lean()) as unknown as
    | (BookingFields & { _id: unknown })
    | null;
  if (!booking) throw errors.notFound('Booking not found');
  const isCustomer = String(booking.customer) === actor.userId;
  const isPartner = String(booking.partner) === actor.userId;
  if (!isCustomer && !isPartner && actor.role !== 'ADMIN') {
    throw errors.forbidden('You do not have access to this booking');
  }
  return booking;
}

export { errors };
