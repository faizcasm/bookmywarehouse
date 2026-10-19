import type { BookingDTO, BookingStatus, Role } from '@bmw/shared-types';
import { BOOKING_TRANSITIONS } from '@bmw/shared-types';
import type { BookingFields, PaymentFields } from '../models/index.js';

export function serializeBookingPricing(pricing: BookingFields['pricing']) {
  return {
    currency: pricing.currency as BookingDTO['pricing']['currency'],
    subtotal: pricing.subtotalMinor,
    platformFee: pricing.platformFeeMinor,
    taxes: pricing.taxesMinor,
    discount: pricing.discountMinor,
    total: pricing.totalMinor,
    breakdown: pricing.breakdown.map((entry) => ({
      label: entry.label,
      amount: entry.amountMinor,
    })),
    rateDescription: pricing.rateDescription,
  };
}

export interface BookingRenderOptions {
  payment?: PaymentFields | null;
  customer?: { id: string; name: string; avatarUrl?: string | null };
  partner?: { businessName: string; verified?: boolean };
}

export function serializeBooking(
  booking: BookingFields & { _id: unknown },
  options: BookingRenderOptions = {},
): BookingDTO {
  const status = booking.status as BookingStatus;
  return {
    id: String(booking._id),
    reference: booking.reference,
    type: booking.type,
    status,
    listing: {
      id: String(booking.listing),
      title: booking.listingSnapshot.title,
      slug: booking.listingSnapshot.slug,
      type: booking.listingSnapshot.type,
      coverImage: booking.listingSnapshot.coverImage ?? null,
      city: booking.listingSnapshot.city,
    },
    customer: {
      id: String(booking.customer),
      name: options.customer?.name ?? '',
      role: 'CUSTOMER' as Role,
      avatarUrl: options.customer?.avatarUrl ?? null,
    },
    partner: {
      id: String(booking.partner),
      businessName: options.partner?.businessName ?? '',
      verified: options.partner?.verified ?? false,
    },
    startDate: new Date(booking.startDate).toISOString(),
    endDate: booking.endDate ? new Date(booking.endDate).toISOString() : null,
    requestedCapacity: booking.requestedCapacity ?? null,
    capacityUnit: booking.capacityUnit ?? null,
    quantity: booking.quantity,
    notes: booking.notes ?? null,
    specialRequirements: booking.specialRequirements ?? null,
    pricing: serializeBookingPricing(booking.pricing),
    items: booking.items.map((item) => ({
      id: String(item._id),
      listingId: String(item.listing),
      listingTitle: item.title,
      listingType: item.type,
      quantity: item.quantity,
      unitLabel: item.unitLabel ?? null,
      unitPrice: item.unitPriceMinor,
      amount: item.amountMinor,
      currency: (item.currency ?? 'INR') as BookingDTO['items'][number]['currency'],
    })),
    statusHistory: booking.statusHistory.map((event) => ({
      status: event.status,
      at: new Date(event.at).toISOString(),
      byRole: (event.byRole ?? null) as Role | null,
      note: event.note ?? null,
    })),
    allowedTransitions: [...BOOKING_TRANSITIONS[status]],
    cancellationReason: booking.cancellationReason ?? null,
    rejectionReason: booking.rejectionReason ?? null,
    invoiceId: booking.invoice ? String(booking.invoice) : null,
    reviewId: booking.review ? String(booking.review) : null,
    createdAt: new Date(booking.createdAt).toISOString(),
    updatedAt: new Date(booking.updatedAt).toISOString(),
  };
}
