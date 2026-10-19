/**
 * Shared enum-like constants and derived union types.
 * These are the single source of truth for domain vocabulary across the API and
 * the customer, partner and admin applications.
 */

export const ROLES = ['CUSTOMER', 'PARTNER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const ACCOUNT_STATUSES = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const LISTING_TYPES = ['WAREHOUSE', 'EQUIPMENT', 'SERVICE'] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const LISTING_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'REJECTED',
  'UNPUBLISHED',
  'SUSPENDED',
  'ARCHIVED',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const VERIFICATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED',
  'SUSPENDED',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const BOOKING_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'AWAITING_PAYMENT',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
  'REFUND_PENDING',
  'REFUNDED',
  'DISPUTED',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/**
 * Allowed booking state transitions. Enforced by the backend state machine and
 * reused by the frontends so the UI can only offer legal actions.
 */
export const BOOKING_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['AWAITING_PAYMENT', 'CONFIRMED', 'REJECTED', 'CANCELLED'],
  AWAITING_PAYMENT: ['CONFIRMED', 'CANCELLED', 'REJECTED'],
  CONFIRMED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REFUND_PENDING', 'DISPUTED'],
  IN_PROGRESS: ['COMPLETED', 'DISPUTED', 'REFUND_PENDING'],
  COMPLETED: ['DISPUTED'],
  CANCELLED: [],
  REJECTED: [],
  REFUND_PENDING: ['REFUNDED', 'DISPUTED'],
  REFUNDED: [],
  DISPUTED: ['REFUNDED', 'COMPLETED', 'CANCELLED'],
};

export const TERMINAL_BOOKING_STATUSES: readonly BookingStatus[] = [
  'CANCELLED',
  'REJECTED',
  'REFUNDED',
];

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

export const PAYMENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'CANCELLED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const REFUND_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const INVOICE_STATUSES = ['DRAFT', 'ISSUED', 'PAID', 'VOID', 'REFUNDED'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_PROVIDERS = ['SANDBOX', 'RAZORPAY', 'STRIPE'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const REVIEW_STATUSES = ['PENDING', 'PUBLISHED', 'HIDDEN', 'REMOVED'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const DISPUTE_STATUSES = [
  'OPEN',
  'UNDER_REVIEW',
  'RESOLVED_CUSTOMER',
  'RESOLVED_PARTNER',
  'CLOSED',
  'WITHDRAWN',
] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const PAYMENT_STATUSES_ALLOWED_FOR_CAPTURE: readonly PaymentStatus[] = ['PENDING', 'PROCESSING'];

export const PRICING_PERIODS = ['HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR'] as const;
export type PricingPeriod = (typeof PRICING_PERIODS)[number];

export const PRICING_MODELS = [
  'FIXED',
  'PER_SQFT',
  'PER_SQMT',
  'PER_PALLET',
  'PER_UNIT',
  'PER_HOUR',
  'PER_DAY',
] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export const CAPACITY_UNITS = ['SQFT', 'SQM', 'PALLET', 'TON', 'CBM', 'UNIT', 'LITRE'] as const;
export type CapacityUnit = (typeof CAPACITY_UNITS)[number];

export const FACILITY_TYPES = [
  'GENERAL',
  'INDUSTRIAL',
  'COMMERCIAL',
  'DISTRIBUTION',
  'COLD_STORAGE',
  'FULFILLMENT',
  'SHORT_TERM',
  'LONG_TERM',
  'OTHER',
] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

export const STORAGE_TYPES = [
  'GENERAL',
  'COLD',
  'FROZEN',
  'HAZARDOUS',
  'BONDED',
  'AGRICULTURE',
  'PHARMACEUTICAL',
  'OTHER',
] as const;
export type StorageType = (typeof STORAGE_TYPES)[number];

export const EQUIPMENT_CATEGORIES = [
  'FORKLIFT',
  'CRANE',
  'PALLET_TRUCK',
  'MATERIAL_HANDLING',
  'LOADING',
  'GENERATOR',
  'OTHER',
] as const;
export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];

export const SERVICE_TYPES = [
  'LOADING_UNLOADING',
  'PACKAGING',
  'TRANSPORTATION',
  'MATERIAL_HANDLING',
  'INVENTORY_MANAGEMENT',
  'CONSULTING',
  'OTHER',
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const CANCELLATION_POLICIES = ['FLEXIBLE', 'MODERATE', 'STRICT', 'CUSTOM'] as const;
export type CancellationPolicy = (typeof CANCELLATION_POLICIES)[number];

export const LISTING_SORTS = [
  'relevance',
  'price_asc',
  'price_desc',
  'capacity_desc',
  'rating_desc',
  'newest',
  'oldest',
] as const;
export type ListingSort = (typeof LISTING_SORTS)[number];

export const NOTIFICATION_TYPES = [
  'ACCOUNT_REGISTERED',
  'EMAIL_VERIFIED',
  'PASSWORD_RESET',
  'PARTNER_VERIFICATION_SUBMITTED',
  'PARTNER_VERIFICATION_UPDATED',
  'LISTING_SUBMITTED',
  'LISTING_PUBLISHED',
  'LISTING_REJECTED',
  'BOOKING_REQUESTED',
  'BOOKING_ACCEPTED',
  'BOOKING_REJECTED',
  'BOOKING_CANCELLED',
  'BOOKING_COMPLETED',
  'PAYMENT_SUCCEEDED',
  'PAYMENT_FAILED',
  'REFUND_PROCESSED',
  'INVOICE_GENERATED',
  'NEW_MESSAGE',
  'REVIEW_RECEIVED',
  'REVIEW_RESPONSE',
  'DISPUTE_OPENED',
  'DISPUTE_RESOLVED',
  'SYSTEM_ANNOUNCEMENT',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const CONVERSATION_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const DISPUTE_REASONS = [
  'SERVICE_NOT_DELIVERED',
  'QUALITY_ISSUE',
  'OVERCHARGE',
  'CANCELLATION_REFUND',
  'DAMAGE',
  'OTHER',
] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];

export const BOOKING_KINDS = LISTING_TYPES;
export type BookingKind = ListingType;
