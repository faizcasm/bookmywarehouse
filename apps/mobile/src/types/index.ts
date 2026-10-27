/**
 * Shared API DTOs and enums.
 *
 * Enums and status/transition constants are imported from the workspace
 * `@bmw/shared-types` package (pure TS, no DOM) so the mobile client cannot
 * drift from the backend vocabulary. Response/DTO shapes are re-declared here
 * as the fields the app actually consumes (a subset of the server's full
 * serializer output) — see MOBILE_API_INTEGRATION.md.
 */

import type {
  Role,
  ListingType,
  ListingStatus,
  BookingStatus,
  PaymentStatus,
  VerificationStatus,
  Currency,
} from '@bmw/shared-types';

export {
  ROLES,
  LISTING_TYPES,
  LISTING_STATUSES,
  BOOKING_STATUSES,
  BOOKING_TRANSITIONS,
  PAYMENT_STATUSES,
  VERIFICATION_STATUSES,
  CURRENCIES,
  DEFAULT_CURRENCY,
  toMinorUnits,
  toMajorUnits,
} from '@bmw/shared-types';

export type {
  Role,
  ListingType,
  ListingStatus,
  BookingStatus,
  PaymentStatus,
  VerificationStatus,
  Currency,
};

/* ------------------------------- envelope ------------------------------- */

export interface ApiErrorIssue {
  path?: string;
  message: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface EnvelopeMeta {
  pagination?: PaginationMeta;
  [key: string]: unknown;
}

/* --------------------------------- user --------------------------------- */

export interface User {
  id: string;
  /** The server serializes the display name as `name` (user.serializer.ts). */
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  emailVerified?: boolean;
  /** `ACTIVE` | `SUSPENDED` | `DEACTIVATED` … */
  status?: string;
  avatarUrl?: string | null;
  createdAt?: string;
}

/* -------------------------------- catalog -------------------------------- */

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  listingCount?: number;
  children?: Category[];
}

export interface ListingSummary {
  id: string;
  slug: string;
  title: string;
  type: ListingType;
  status?: ListingStatus;
  city: string;
  state?: string;
  addressLine?: string;
  coverUrl?: string | null;
  gallery?: string[];
  priceMinor: number;
  currency: Currency;
  pricingPeriod: string;
  ratingAvg?: number | null;
  ratingCount?: number;
  verified?: boolean;
  capacityValue?: number | null;
  capacityUnit?: string | null;
  amenities?: string[];
  /** Owner block for the partner card (logo, rating, response rate). */
  partner?: ListingPartner;
  /** Favourite state — drives the heart toggle; only set for signed-in users. */
  isFavorite?: boolean;
  /** Pricing model (FIXED / PER_SQFT / PER_DAY …). */
  priceModel?: string;
  availableFrom?: string | null;
}

/** The listing's owner block (logo, verified badge, rating, response rate). */
export interface ListingPartner {
  id?: string;
  businessName?: string;
  verified?: boolean;
  logoUrl?: string | null;
  rating?: number | null;
  responseRate?: number | null;
  joinedAt?: string | null;
}

export interface CancellationTerms {
  policy?: string;
  description?: string;
  customerRefundPercent?: number;
  note?: string | null;
}

export interface ListingDetail extends ListingSummary {
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
  categoryId?: string | null;
  categoryName?: string | null;
  partnerId?: string;
  partnerName?: string;
  specifications?: Record<string, string | number | boolean>;
  operatingHours?: unknown;
  /** Postal code from `location` — needed by the partner edit form. */
  postalCode?: string | null;
  /* Raw type-specific blocks, kept so edit forms can round-trip every field. */
  warehouse?: {
    facilityType?: string;
    storageTypes?: string[];
    availableCapacity?: number | null;
    numberOfUnits?: number | null;
    unitDimensions?: string | null;
    ceilingHeightM?: number | null;
    floorLoadCapacityKg?: number | null;
    temperatureControlled?: boolean;
    humidityControlled?: boolean;
    powerBackup?: boolean;
    fireSafety?: boolean;
    cctv?: boolean;
    certifications?: string[];
    operatingHours?: string | null;
  } | null;
  equipment?: {
    equipmentCategory?: string;
    brand?: string | null;
    model?: string | null;
    manufactureYear?: number | null;
    quantity?: number;
    availableQuantity?: number | null;
    rentalPeriod?: string;
    deliveryAvailable?: boolean;
    operatorAvailable?: boolean;
    operatorChargePerDay?: number | null;
    minRentalDuration?: number | null;
    specifications?: Record<string, string>;
  } | null;
  service?: {
    serviceType?: string;
    serviceAreas?: string[];
    estimatedDurationHours?: number | null;
    teamSize?: number | null;
    dailyCapacity?: number | null;
    requirements?: string | null;
  } | null;
  rules?: string[];
  safetyFeatures?: string[];
  cancellationTerms?: CancellationTerms;
  minBookingDuration?: { value: number; unit: string } | null;
  /** Raw availability data already embedded in the detail payload. */
  availabilityRules?: { id: string; daysOfWeek: number[]; startTime: string; endTime: string; startDate?: string | null; endDate?: string | null }[];
  blockedDates?: { id: string; date: string; reason?: string | null; isAvailable?: boolean }[];
  /** Server verdict — false when the listing can't take new requests. */
  canRequestBooking?: boolean;
  /** Related listings embedded in the detail response (no extra request). */
  related?: ListingSummary[];
  createdAt?: string;
}

export interface AvailabilitySlot {
  date: string;
  available: boolean;
  priceMinor?: number | null;
  blockedReason?: string | null;
}

/* -------------------------------- booking -------------------------------- */

export interface QuoteLine {
  label: string;
  amountMinor: number;
}

export interface BookingQuote {
  listingId: string;
  startDate: string;
  endDate: string;
  spaceUnits: number;
  baseMinor: number;
  taxesMinor: number;
  feesMinor: number;
  discountMinor: number;
  totalMinor: number;
  currency: Currency;
  nights?: number;
  /** Server-side availability verdict for the requested interval. */
  available: boolean;
  unavailableReason?: string | null;
  /** Capacity left after this request — drives the "only N left" hint. */
  remainingCapacity?: number | null;
  /** Itemised line items as the API priced them. */
  breakdown: QuoteLine[];
  rateDescription?: string | null;
}

/** Priced breakdown as the API computed it (minor units). */
export interface BookingPricing {
  subtotalMinor: number;
  platformFeeMinor: number;
  taxesMinor: number;
  discountMinor: number;
  breakdown: QuoteLine[];
  rateDescription?: string | null;
}

export interface Booking {
  id: string;
  reference?: string;
  type?: ListingType;
  listingId: string;
  listingTitle?: string;
  listingSlug?: string;
  coverUrl?: string | null;
  status: BookingStatus;
  startDate: string;
  endDate: string;
  spaceUnits: number;
  capacityUnit?: string | null;
  totalMinor: number;
  currency: Currency;
  createdAt: string;
  partnerName?: string;
  customerName?: string;
  /** Needed to start a conversation with the counterparty. */
  customerId?: string;
  partnerId?: string;
  invoiceId?: string | null;
  reviewId?: string | null;
  cancellationReason?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  specialRequirements?: string | null;
  pricing?: BookingPricing;
  timeline?: BookingTimelineEvent[];
  availableActions?: string[];
}

export interface BookingTimelineEvent {
  status: BookingStatus | string;
  at: string;
  note?: string | null;
}

/* -------------------------------- payments -------------------------------- */

export interface PaymentConfig {
  sandbox: boolean;
  provider: string;
}

export interface Payment {
  id: string;
  bookingId?: string;
  status: PaymentStatus;
  amountMinor: number;
  currency: Currency;
  provider?: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  bookingId?: string;
  status: string;
  totalMinor: number;
  currency: Currency;
  issuedAt?: string;
  createdAt?: string;
}

/* ------------------------------ communication ----------------------------- */

export interface Favorite {
  id: string;
  listing: ListingSummary;
  createdAt: string;
}

export interface Conversation {
  id: string;
  counterpartyName: string;
  counterpartyAvatar?: string | null;
  listingTitle?: string | null;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  unreadCount?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  read: boolean;
  createdAt: string;
  linkType?: string | null;
  linkId?: string | null;
  /** Full in-app path from the payload, e.g. `/partner/bookings/<id>`. */
  linkPath?: string | null;
}

export interface Review {
  id: string;
  listingId?: string;
  listingTitle?: string;
  bookingId?: string;
  rating: number;
  comment?: string | null;
  authorName?: string;
  authorAvatar?: string | null;
  authorRole?: string;
  /** Moderation state — `HIDDEN`/`REMOVED` reviews are shown differently. */
  status?: string;
  response?: string | null;
  responseAt?: string | null;
  createdAt: string;
}

export interface Dispute {
  id: string;
  bookingId: string;
  reason: string;
  status: string;
  createdAt: string;
  resolution?: string | null;
}

/* --------------------------------- partner -------------------------------- */

/** GET /partner/dashboard — every KPI the web dashboard shows. */
export interface PartnerDashboard {
  verificationStatus?: string;
  activeListings?: number;
  draftListings?: number;
  pendingBookings?: number;
  confirmedBookings?: number;
  completedBookings?: number;
  cancelledBookings?: number;
  unreadMessages?: number;
  reviewCount?: number;
  responseRate?: number;
  ratingAvg?: number | null;
  totalEarningsMinor?: number;
  pendingPayoutMinor?: number;
  last30DaysMinor?: number;
  currency?: Currency;
  /** `{ date, bookings, revenue }` series for the trend chart. */
  trends?: { date: string; bookings: number; revenue: number }[];
  upcomingBookings?: Booking[];
  recentBookings?: Booking[];
}

export interface Payout {
  id: string;
  amountMinor: number;
  currency: Currency;
  status: string;
  createdAt: string;
  processedAt?: string | null;
}

export interface VerificationState {
  status: VerificationStatus;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  documents?: { url: string; label: string; type?: string }[];
  /* KYC business details returned by GET /partner/profile (subset of the model). */
  legalBusinessName?: string | null;
  businessType?: string | null;
  gstNumber?: string | null;
  panNumber?: string | null;
  /** The API returns a structured address object (older payloads: a string). */
  address?:
    | {
        addressLine1?: string;
        addressLine2?: string | null;
        city?: string;
        state?: string;
        postalCode?: string;
      }
    | string
    | null;
}

/** GET /partner/profile — the partner business profile + verification summary. */
export interface PartnerProfile {
  userId: string;
  businessName: string;
  businessType?: string | null;
  description?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  verificationStatus: VerificationStatus;
  verification?: VerificationState | null;
  responseRate?: number;
  totalBookings?: number;
  activeListings?: number;
  address?: {
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  } | null;
  joinedAt?: string;
}

/** One settlement line from GET /partner/earnings. */
export interface Earning {
  id: string;
  bookingReference?: string;
  listingTitle?: string;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  currency: Currency;
  paidAt?: string | null;
}

/* ---------------------------------- admin ---------------------------------- */

export interface AdminDashboard {
  totals?: Record<string, number>;
  recentBookings?: Booking[];
  [key: string]: unknown;
}

export interface Paginated<T> {
  items: T[];
  meta?: EnvelopeMeta;
}
