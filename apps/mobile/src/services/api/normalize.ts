/**
 * API response → view-model normalizers.
 *
 * The API serializes nested DTOs (see packages/shared-types/src/dto.ts and the
 * web apps, which read `price.amount`, `rating.average`, `listing.title`, …).
 * The mobile view-models deliberately use a flatter shape (see types/index.ts),
 * so every response is passed through one of these pure functions at the service
 * boundary. Keeping the mapping in one tested module means a serializer change
 * can never silently blank out prices/ratings across the app.
 *
 * Every function is pure + total (never throws on missing sub-objects) so it is
 * safe to run against partial/error payloads.
 */

import type {
  AvailabilityExceptionDTO,
  AvailabilityRuleDTO,
  BookingDTO,
  ConversationDTO,
  DisputeDTO,
  FavoriteDTO,
  InvoiceDTO,
  ListingDetailDTO,
  ListingSummaryDTO,
  MessageDTO,
  NotificationDTO,
  PartnerDashboardDTO,
  PaymentDTO,
  QuoteResponseDTO,
  ReviewDTO,
} from '@bmw/shared-types';

import type {
  AvailabilitySlot,
  Booking,
  BookingQuote,
  BookingTimelineEvent,
  Conversation,
  Dispute,
  Favorite,
  Invoice,
  ListingDetail,
  ListingSummary,
  Message,
  Notification,
  PartnerDashboard,
  Payment,
  Review,
} from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` (UTC) — the format `formatDayLabel` parses. */
function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Listings                                                            */
/* ------------------------------------------------------------------ */

export function toListingSummary(dto: ListingSummaryDTO): ListingSummary {
  return {
    id: dto.id,
    slug: dto.slug,
    title: dto.title,
    type: dto.type,
    status: dto.status,
    city: dto.city,
    state: dto.state,
    addressLine: dto.location?.addressLine1 ?? undefined,
    coverUrl: dto.coverImage ?? null,
    gallery: dto.images ?? [],
    priceMinor: dto.price?.amount ?? 0,
    currency: dto.price?.currency ?? 'INR',
    pricingPeriod: dto.price?.period ?? '',
    priceModel: dto.price?.model,
    ratingAvg: dto.rating?.average ?? null,
    ratingCount: dto.rating?.count ?? 0,
    verified: dto.partner?.verified ?? false,
    capacityValue: dto.totalCapacity ?? null,
    capacityUnit: dto.capacityUnit ?? null,
    amenities: undefined,
    partner: dto.partner
      ? {
          id: dto.partner.id,
          businessName: dto.partner.businessName,
          verified: dto.partner.verified,
          logoUrl: dto.partner.logoUrl ?? null,
          rating: dto.partner.rating?.average,
          responseRate: dto.partner.responseRate,
          joinedAt: dto.partner.joinedAt ?? null,
        }
      : undefined,
    isFavorite: dto.isFavorite ?? false,
    availableFrom: dto.availableFrom ?? null,
  };
}

/** Flatten the type-specific detail block into a `key → display value` map. */
function buildSpecifications(dto: ListingDetailDTO): Record<string, string | number | boolean> {
  const specs: Record<string, string | number | boolean> = {};
  const block = dto.warehouse ?? dto.equipment ?? dto.service;
  if (!block) return specs;
  for (const [key, value] of Object.entries(block)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length) specs[key] = value.join(', ');
      continue;
    }
    if (typeof value === 'object') continue; // skip nested records
    specs[key] = value as string | number | boolean;
  }
  return specs;
}

export function toListingDetail(dto: ListingDetailDTO): ListingDetail {
  return {
    ...toListingSummary(dto),
    description: dto.description,
    latitude: dto.location?.coordinates?.lat ?? null,
    longitude: dto.location?.coordinates?.lng ?? null,
    categoryId: dto.categoryId ?? null,
    categoryName: dto.categoryName ?? null,
    partnerId: dto.partner?.id,
    partnerName: dto.partner?.businessName,
    specifications: buildSpecifications(dto),
    rules: dto.rules ?? [],
    safetyFeatures: dto.safetyFeatures ?? [],
    cancellationTerms: dto.cancellationTerms
      ? {
          policy: dto.cancellationTerms.policy,
          description: dto.cancellationTerms.description,
          customerRefundPercent: dto.cancellationTerms.customerRefundPercent,
          note: dto.cancellationTerms.note ?? null,
        }
      : undefined,
    minBookingDuration: dto.minBookingDuration ?? null,
    availabilityRules: dto.availabilityRules ?? [],
    blockedDates: (dto.blockedDates ?? []).map((b) => ({
      id: b.id,
      date: b.date,
      reason: b.reason ?? null,
      isAvailable: b.isAvailable,
    })),
    canRequestBooking: dto.canRequestBooking,
    related: (dto.related ?? []).map(toListingSummary),
    amenities: dto.amenities ?? [],
    postalCode: dto.location?.postalCode ?? null,
    warehouse: dto.warehouse
      ? {
          facilityType: dto.warehouse.facilityType,
          storageTypes: dto.warehouse.storageTypes ?? [],
          availableCapacity: dto.warehouse.availableCapacity ?? null,
          numberOfUnits: dto.warehouse.numberOfUnits ?? null,
          unitDimensions: dto.warehouse.unitDimensions ?? null,
          ceilingHeightM: dto.warehouse.ceilingHeightM ?? null,
          floorLoadCapacityKg: dto.warehouse.floorLoadCapacityKg ?? null,
          temperatureControlled: dto.warehouse.temperatureControlled,
          humidityControlled: dto.warehouse.humidityControlled,
          powerBackup: dto.warehouse.powerBackup,
          fireSafety: dto.warehouse.fireSafety,
          cctv: dto.warehouse.cctv,
          certifications: dto.warehouse.certifications ?? [],
          operatingHours: dto.warehouse.operatingHours ?? null,
        }
      : null,
    equipment: dto.equipment
      ? {
          equipmentCategory: dto.equipment.equipmentCategory,
          brand: dto.equipment.brand ?? null,
          model: dto.equipment.model ?? null,
          manufactureYear: dto.equipment.manufactureYear ?? null,
          quantity: dto.equipment.quantity,
          availableQuantity: dto.equipment.availableQuantity ?? null,
          rentalPeriod: dto.equipment.rentalPeriod,
          deliveryAvailable: dto.equipment.deliveryAvailable,
          operatorAvailable: dto.equipment.operatorAvailable,
          operatorChargePerDay: dto.equipment.operatorChargePerDay ?? null,
          minRentalDuration: dto.equipment.minRentalDuration ?? null,
          specifications: dto.equipment.specifications ?? {},
        }
      : null,
    service: dto.service
      ? {
          serviceType: dto.service.serviceType,
          serviceAreas: dto.service.serviceAreas ?? [],
          estimatedDurationHours: dto.service.estimatedDurationHours ?? null,
          teamSize: dto.service.teamSize ?? null,
          dailyCapacity: dto.service.dailyCapacity ?? null,
          requirements: dto.service.requirements ?? null,
        }
      : null,
    createdAt: dto.createdAt,
  };
}

/* ------------------------------------------------------------------ */
/* Availability                                                        */
/* ------------------------------------------------------------------ */

/**
 * The public availability endpoint returns the raw `rules` + `blockedDates`
 * (it does not pre-compute per-day slots). This ports the API's own decision
 * logic (apps/api/src/services/availability.service.ts) so the strip matches
 * exactly what the booking validator would decide:
 *  - a blocked exception marks the day unavailable;
 *  - if any rules exist, the day must match one to be open;
 *  - no rules at all ⇒ treated as always open.
 */
export function buildAvailabilitySlots(
  rules: AvailabilityRuleDTO[],
  blockedDates: AvailabilityExceptionDTO[],
  days: number,
  priceMinor: number | null = null,
): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  for (let i = 0; i < days; i += 1) {
    const date = new Date(start + i * DAY_MS);
    const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

    const blocked = blockedDates.find(
      (exception) => new Date(exception.date).getTime() === dayStart && !exception.isAvailable,
    );

    let available = true;
    let blockedReason: string | null = null;

    if (blocked) {
      available = false;
      blockedReason = blocked.reason ?? 'This date is blocked by the partner';
    } else if (rules.length > 0 && !rules.some((rule) => overlapsRule(rule, date))) {
      available = false;
      blockedReason = 'The listing is not available on this date';
    }

    slots.push({ date: isoDateOnly(date), available, priceMinor, blockedReason });
  }
  return slots;
}

function overlapsRule(rule: AvailabilityRuleDTO, date: Date): boolean {
  if (rule.startDate && date < new Date(rule.startDate)) return false;
  if (rule.endDate && date > new Date(new Date(rule.endDate).getTime() + DAY_MS - 1)) return false;
  return rule.daysOfWeek.includes(date.getUTCDay());
}

/* ------------------------------------------------------------------ */
/* Booking quote                                                       */
/* ------------------------------------------------------------------ */

/**
 * `POST /bookings/quote` accepts `capacity` (space-based pricing) and/or
 * `quantity` (unit-based pricing) — it has no `spaceUnits` field. Forward the
 * entered units under both keys so warehouse (capacity) and equipment/service
 * (quantity) listings are both quoted correctly.
 */
export function toQuoteInput(spaceUnits: number): { capacity: number; quantity: number } {
  const units = Number.isFinite(spaceUnits) && spaceUnits > 0 ? spaceUnits : 1;
  return { capacity: units, quantity: units };
}

export function toBookingQuote(
  dto: QuoteResponseDTO,
  input: { spaceUnits: number; deliveryRequired?: boolean; operatorRequired?: boolean },
): BookingQuote {
  const pricing = dto.pricing;
  return {
    listingId: dto.listingId,
    startDate: dto.startDate,
    endDate: dto.endDate ?? dto.startDate,
    spaceUnits: input.spaceUnits,
    baseMinor: pricing?.subtotal ?? 0,
    taxesMinor: pricing?.taxes ?? 0,
    feesMinor: pricing?.platformFee ?? 0,
    discountMinor: pricing?.discount ?? 0,
    totalMinor: pricing?.total ?? 0,
    currency: (pricing?.currency ?? dto.currency ?? 'INR') as BookingQuote['currency'],
    nights: undefined,
    available: dto.available !== false,
    unavailableReason: dto.unavailableReason ?? null,
    remainingCapacity: dto.remainingCapacity ?? null,
    breakdown: (pricing?.breakdown ?? []).map((line) => ({
      label: line.label,
      amountMinor: line.amount,
    })),
    rateDescription: pricing?.rateDescription ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Bookings                                                            */
/* ------------------------------------------------------------------ */

function toTimeline(history: BookingDTO['statusHistory']): BookingTimelineEvent[] {
  return (history ?? []).map((event) => ({
    status: event.status,
    at: event.at,
    note: event.note ?? null,
  }));
}

export function toBooking(dto: BookingDTO): Booking {
  return {
    id: dto.id,
    reference: dto.reference,
    type: dto.type,
    listingId: dto.listing?.id ?? '',
    listingTitle: dto.listing?.title,
    listingSlug: dto.listing?.slug,
    coverUrl: dto.listing?.coverImage ?? null,
    status: dto.status,
    startDate: dto.startDate,
    endDate: dto.endDate ?? '',
    spaceUnits: dto.quantity ?? 1,
    capacityUnit: dto.capacityUnit ?? null,
    totalMinor: dto.pricing?.total ?? 0,
    currency: (dto.pricing?.currency ?? 'INR') as Booking['currency'],
    createdAt: dto.createdAt,
    partnerName: dto.partner?.businessName,
    partnerId: dto.partner?.id,
    customerName: dto.customer?.name,
    customerId: dto.customer?.id,
    invoiceId: dto.invoiceId ?? null,
    reviewId: dto.reviewId ?? null,
    cancellationReason: dto.cancellationReason ?? null,
    rejectionReason: dto.rejectionReason ?? null,
    notes: dto.notes ?? null,
    specialRequirements: dto.specialRequirements ?? null,
    pricing: dto.pricing
      ? {
          subtotalMinor: dto.pricing.subtotal ?? 0,
          platformFeeMinor: dto.pricing.platformFee ?? 0,
          taxesMinor: dto.pricing.taxes ?? 0,
          discountMinor: dto.pricing.discount ?? 0,
          breakdown: (dto.pricing.breakdown ?? []).map((line) => ({
            label: line.label,
            amountMinor: line.amount,
          })),
          rateDescription: dto.pricing.rateDescription ?? null,
        }
      : undefined,
    timeline: toTimeline(dto.statusHistory),
    availableActions: dto.allowedTransitions ?? [],
  };
}

/* ------------------------------------------------------------------ */
/* Payments + invoices                                                 */
/* ------------------------------------------------------------------ */

export function toPayment(dto: PaymentDTO): Payment {
  return {
    id: dto.id,
    bookingId: dto.bookingId,
    status: dto.status as Payment['status'],
    amountMinor: dto.amount ?? 0,
    currency: dto.currency,
    provider: dto.provider,
    createdAt: dto.createdAt,
  };
}

export function toInvoice(dto: InvoiceDTO): Invoice {
  return {
    id: dto.id,
    invoiceNumber: dto.invoiceNumber,
    bookingId: dto.bookingId,
    status: dto.status,
    totalMinor: dto.total ?? 0,
    currency: dto.currency,
    issuedAt: dto.createdAt,
    createdAt: dto.createdAt,
  };
}

/* ------------------------------------------------------------------ */
/* Partner dashboard                                                   */
/* ------------------------------------------------------------------ */

export function toPartnerDashboard(dto: PartnerDashboardDTO): PartnerDashboard {
  return {
    verificationStatus: dto.verificationStatus,
    activeListings: dto.totals?.activeListings ?? 0,
    draftListings: dto.totals?.draftListings ?? 0,
    pendingBookings: dto.totals?.pendingRequests ?? 0,
    confirmedBookings: dto.totals?.confirmedBookings ?? 0,
    completedBookings: dto.totals?.completedBookings ?? 0,
    cancelledBookings: dto.totals?.cancelledBookings ?? 0,
    unreadMessages: dto.totals?.unreadMessages ?? 0,
    reviewCount: dto.totals?.reviewCount ?? 0,
    responseRate: dto.responseRate,
    ratingAvg: dto.totals?.averageRating ?? null,
    totalEarningsMinor: dto.revenue?.totalEarned ?? 0,
    pendingPayoutMinor: dto.revenue?.pendingPayout ?? 0,
    last30DaysMinor: dto.revenue?.last30Days ?? 0,
    currency: dto.revenue?.currency ?? 'INR',
    trends: dto.trends ?? [],
    upcomingBookings: (dto.upcomingBookings ?? []).map(toBooking),
    recentBookings: (dto.recentRequests ?? []).map(toBooking),
  };
}

/* ------------------------------------------------------------------ */
/* Social: favorites, reviews, messaging, notifications, disputes      */
/* ------------------------------------------------------------------ */

export function toFavorite(dto: FavoriteDTO): Favorite {
  return {
    id: dto.id,
    listing: toListingSummary(dto.listing),
    createdAt: dto.createdAt,
  };
}

/** Listing ids only — the favorites screen resolves each into a full listing. */
export function toFavoriteIds(items: FavoriteDTO[]): string[] {
  return (items ?? []).map((item) => item.listing?.id).filter((id): id is string => Boolean(id));
}

export function toReview(dto: ReviewDTO): Review {
  return {
    id: dto.id,
    listingId: dto.listingId,
    listingTitle: dto.listingTitle,
    bookingId: dto.bookingId,
    rating: dto.rating ?? 0,
    comment: dto.comment ?? null,
    authorName: dto.author?.name,
    authorAvatar: dto.author?.avatarUrl ?? null,
    authorRole: dto.author?.role,
    status: dto.status,
    response: dto.response?.text ?? null,
    responseAt: dto.response?.at ?? null,
    createdAt: dto.createdAt,
  };
}

export function toConversation(dto: ConversationDTO): Conversation {
  const participants = dto.participants ?? [];
  // Prefer the most recently active non-self participant name we can find.
  const name =
    participants.find((p) => p.user?.name)?.user?.name ?? dto.subject ?? 'Conversation';

  return {
    id: dto.id,
    counterpartyName: name,
    counterpartyAvatar: participants.find((p) => p.user?.avatarUrl)?.user?.avatarUrl ?? null,
    listingTitle: dto.listing?.title ?? null,
    lastMessage: dto.lastMessage?.preview ?? null,
    lastMessageAt: dto.lastMessage?.at ?? null,
    unreadCount: dto.unreadCount ?? 0,
  };
}

export function toMessage(dto: MessageDTO): Message {
  return {
    id: dto.id,
    conversationId: dto.conversationId,
    senderId: dto.sender?.id ?? '',
    body: dto.body,
    createdAt: dto.createdAt,
    readAt: Array.isArray(dto.readBy) && dto.readBy.length ? dto.createdAt : null,
  };
}

export function toNotification(dto: NotificationDTO): Notification {
  const link = typeof dto.link === 'string' ? dto.link : null;
  // Keep only the first two path segments for `linkType`/`linkId` (the routing
  // key), but retain the WHOLE path so deeper routes (`/partner/bookings/<id>`)
  // still navigate to the right screen instead of collapsing onto a list.
  const match = link ? link.match(/\/([a-z]+)\/([A-Za-z0-9_-]+)/) : null;
  const pathMatch = link ? link.match(/^\/[A-Za-z0-9/_-]+/) : null;
  return {
    id: dto.id,
    type: dto.type,
    title: dto.title,
    body: dto.body ?? null,
    read: dto.read ?? false,
    createdAt: dto.createdAt,
    linkType: match?.[1] ?? null,
    linkId: match?.[2] ?? null,
    linkPath: pathMatch?.[0] ?? null,
  };
}

export function toDispute(dto: DisputeDTO): Dispute {
  return {
    id: dto.id,
    bookingId: dto.bookingId,
    reason: dto.reason,
    status: dto.status,
    createdAt: dto.createdAt,
    resolution: dto.resolutionNote ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Write: partner listing creation                                      */
/* ------------------------------------------------------------------ */

/**
 * The create-listing form collects a flat shape (address line, a single
 * capacity + period, a base price in minor units, an uploaded cover id), but
 * the API's `createListingSchema` expects nested `location` + `price` objects
 * and type-specific detail blocks. This maps the form onto that contract:
 *
 *  - `addressLine/city/state/pincode` → nested `location`
 *  - `basePriceMinor` → `price.amount` (converted to MAJOR rupees; the API
 *    re-converts to minor units server-side)
 *  - `pricingPeriod` → both `price.period` and a derived `price.model`
 *  - `capacityValue/capacityUnit` → the `warehouse`/`equipment`/`service`
 *    detail block required by the listing's `type`
 *  - uploaded image ids → `images` (the API accepts `https://` URLs)
 *
 * Required fields the compact form does not collect are filled with sane
 * defaults so a valid payload is always produced (description length,
 * a MODERATE cancellation policy with a full refund).
 */
export interface CreateListingFormInput {
  title: string;
  type: 'WAREHOUSE' | 'EQUIPMENT' | 'SERVICE';
  categoryId: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  capacityValue: number;
  capacityUnit: string;
  pricingPeriod: string;
  basePriceMinor: number;
  amenities?: string[];
  rules?: string[];
  coverImageUrl?: string;
  galleryImageUrls?: string[];
}

const PRICING_MODEL_BY_PERIOD: Record<string, string> = {
  HOUR: 'PER_HOUR',
  DAY: 'PER_DAY',
  WEEK: 'FIXED',
  MONTH: 'FIXED',
  YEAR: 'FIXED',
};

export function toCreateListingPayload(input: CreateListingFormInput) {
  const period = (input.pricingPeriod || 'MONTH').toUpperCase();
  const model = PRICING_MODEL_BY_PERIOD[period] ?? 'FIXED';
  const description =
    input.description && input.description.trim().length >= 40
      ? input.description.trim()
      : `${input.title.trim()} — listed on BookMyWarehouse. Contact the partner for full details, availability, and terms.`;

  const images = [input.coverImageUrl, ...(input.galleryImageUrls ?? [])].filter(
    (url): url is string => Boolean(url),
  );

  const location = {
    addressLine1: input.addressLine,
    city: input.city,
    state: input.state,
    postalCode: input.pincode,
    country: 'India',
    coordinates:
      typeof input.latitude === 'number' && typeof input.longitude === 'number'
        ? { lat: input.latitude, lng: input.longitude }
        : undefined,
  };

  const price = {
    model,
    // minor → major units (rupees) for the API's money schema.
    amount: Math.round(input.basePriceMinor) / 100,
    currency: 'INR',
    period,
    unitLabel: `per ${period.toLowerCase()}`,
  };

  const capacityUnit = (input.capacityUnit || 'SQFT').toUpperCase();
  const cancellationTerms = {
    policy: 'MODERATE',
    description: 'Flexible cancellation — contact the partner for specifics.',
    customerRefundPercent: 100,
  };

  const base = {
    title: input.title,
    description,
    categoryId: input.categoryId,
    type: input.type,
    location,
    price,
    images,
    amenities: input.amenities ?? [],
    safetyFeatures: [],
    rules: input.rules ?? [],
    cancellationTerms,
  };

  if (input.type === 'WAREHOUSE') {
    return {
      ...base,
      warehouse: {
        facilityType: 'GENERAL',
        storageTypes: ['GENERAL'],
        totalCapacity: input.capacityValue,
        capacityUnit,
        temperatureControlled: false,
        humidityControlled: false,
        powerBackup: false,
        fireSafety: false,
        cctv: false,
        certifications: [],
        operatingHours: 'Mon–Sat, 9am–6pm',
      },
    };
  }
  if (input.type === 'EQUIPMENT') {
    return {
      ...base,
      equipment: {
        equipmentCategory: 'MATERIAL_HANDLING',
        quantity: Math.max(1, Math.round(input.capacityValue) || 1),
        rentalPeriod: period === 'HOUR' ? 'HOUR' : 'DAY',
        deliveryAvailable: true,
        operatorAvailable: false,
        specifications: {},
      },
    };
  }
  return {
    ...base,
    service: {
      serviceType: 'LOADING_UNLOADING',
      serviceAreas: [input.city],
      requirements: 'Share site access details on booking.',
    },
  };
}
