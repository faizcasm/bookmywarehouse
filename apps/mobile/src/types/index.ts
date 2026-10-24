/**
 * Shared API DTOs and enums.
 *
 * Enums and status/transition constants are imported from the workspace
 * `@bmw/shared-types` package (pure TS, no DOM) so the mobile client cannot
 * drift from the backend vocabulary. Response/DTO shapes are re-declared here
 * as the fields the app actually consumes (a subset of the server's full
 * serializer output) — see MOBILE_API_INTEGRATION.md.
 */

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

import type {
  Role,
  ListingType,
  ListingStatus,
  BookingStatus,
  PaymentStatus,
  VerificationStatus,
  Currency,
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
  fullName: string;
  email: string;
  phone?: string | null;
  role: Role;
  emailVerified?: boolean;
  accountStatus?: string;
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
}

export interface ListingDetail extends ListingSummary {
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
  categoryId?: string | null;
  partnerId?: string;
  partnerName?: string;
  specifications?: Record<string, string | number | boolean>;
  operatingHours?: unknown;
  rules?: string[];
  createdAt?: string;
}

export interface AvailabilitySlot {
  date: string;
  available: boolean;
  priceMinor?: number | null;
  blockedReason?: string | null;
}

/* -------------------------------- booking -------------------------------- */

export interface BookingQuote {
  listingId: string;
  startDate: string;
  endDate: string;
  spaceUnits: number;
  baseMinor: number;
  taxesMinor: number;
  feesMinor: number;
  totalMinor: number;
  currency: Currency;
  nights?: number;
}

export interface Booking {
  id: string;
  reference?: string;
  listingId: string;
  listingTitle?: string;
  listingSlug?: string;
  coverUrl?: string | null;
  status: BookingStatus;
  startDate: string;
  endDate: string;
  spaceUnits: number;
  totalMinor: number;
  currency: Currency;
  createdAt: string;
  partnerName?: string;
  customerName?: string;
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
}

export interface Review {
  id: string;
  listingId?: string;
  bookingId?: string;
  rating: number;
  comment?: string | null;
  authorName?: string;
  response?: string | null;
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

export interface PartnerDashboard {
  activeListings?: number;
  pendingBookings?: number;
  totalEarningsMinor?: number;
  currency?: Currency;
  ratingAvg?: number | null;
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
  documents?: { url: string; type: string }[];
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
