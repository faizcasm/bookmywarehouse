/**
 * Local mirrors of `@bmw/shared-types` DTOs/enums used by the partner console.
 * The workspace package is not linked into this app's node_modules (install is
 * managed outside this app), so the handful of types we need are duplicated
 * here. Keep in sync with packages/shared-types/src/{enums,dto}.ts.
 */

export type Role = 'CUSTOMER' | 'PARTNER' | 'ADMIN';

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

export const BUSINESS_TYPES = [
  'SOLE_PROPRIETORSHIP',
  'PARTNERSHIP',
  'PRIVATE_LIMITED',
  'PUBLIC_LIMITED',
  'LLP',
  'HUF',
  'OTHER',
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string | null;
  avatarUrl?: string | null;
  emailVerified: boolean;
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  createdAt: string;
}

export interface UserSummaryDTO {
  id: string;
  name: string;
  role: Role;
  avatarUrl?: string | null;
}

export interface LocationDTO {
  addressLine1: string;
  addressLine2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  region?: string | null;
  coordinates?: { lat: number; lng: number } | null;
  serviceRadiusKm?: number | null;
}

export interface BusinessDocumentDTO {
  id: string;
  label: string;
  url: string;
  status: 'UPLOADED' | 'VERIFIED' | 'REJECTED';
  uploadedAt: string;
  rejectionReason?: string | null;
}

export interface BusinessVerificationDTO {
  id: string;
  partnerId: string;
  status: VerificationStatus;
  legalBusinessName?: string | null;
  businessType?: string | null;
  gstNumber?: string | null;
  panNumber?: string | null;
  registrationNumber?: string | null;
  address?: LocationDTO | null;
  documents: BusinessDocumentDTO[];
  submittedAt?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  reviewerNotes?: string | null;
}

export interface PartnerProfileDTO {
  userId: string;
  businessName: string;
  businessType?: string | null;
  description?: string | null;
  address?: LocationDTO | null;
  website?: string | null;
  logoUrl?: string | null;
  verificationStatus: VerificationStatus;
  verification?: BusinessVerificationDTO | null;
  responseRate?: number | null;
  averageResponseMinutes?: number | null;
  totalBookings: number;
  activeListings: number;
  joinedAt: string;
}

export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
  type: ListingType;
  description?: string | null;
  icon?: string | null;
  imageUrl?: string | null;
  parentId?: string | null;
  listingCount?: number;
  isActive: boolean;
  sortOrder: number;
}

export interface ListingPriceDTO {
  model: PricingModel;
  /** Minor units (paise). */
  amount: number;
  currency: string;
  period?: PricingPeriod | null;
  unitLabel?: string | null;
  minQuantity?: number | null;
  additionalCharges?: { label: string; amount: number; taxable: boolean }[];
}

export interface WarehouseDetailsDTO {
  facilityType: FacilityType;
  storageTypes: StorageType[];
  totalCapacity: number;
  capacityUnit: CapacityUnit;
  numberOfUnits?: number | null;
  unitDimensions?: string | null;
  ceilingHeightM?: number | null;
  floorLoadCapacityKg?: number | null;
  loadingDocks?: number;
  driveways?: number;
  temperatureControlled: boolean;
  humidityControlled: boolean;
  powerBackup: boolean;
  fireSafety: boolean;
  cctv: boolean;
  certifications: string[];
  operatingHours?: string | null;
}

export interface EquipmentDetailsDTO {
  equipmentCategory: EquipmentCategory;
  brand?: string | null;
  model?: string | null;
  manufactureYear?: number | null;
  quantity: number;
  rentalPeriod: PricingPeriod;
  deliveryAvailable: boolean;
  operatorAvailable: boolean;
  operatorChargePerDay?: number | null;
  minRentalDuration?: number | null;
  specifications: Record<string, string>;
}

export interface ServiceDetailsDTO {
  serviceType: ServiceType;
  serviceAreas: string[];
  estimatedDurationHours?: number | null;
  teamSize?: number | null;
  dailyCapacity?: number | null;
  requirements?: string | null;
}

export interface CancellationTermDTO {
  policy: CancellationPolicy;
  description: string;
  customerRefundPercent: number;
  note?: string | null;
}

export interface AvailabilityRuleDTO {
  id: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface AvailabilityExceptionDTO {
  id: string;
  date: string;
  reason?: string | null;
  isAvailable: boolean;
}

export interface RatingSummaryDTO {
  average: number;
  count: number;
}

export interface ListingSummaryDTO {
  id: string;
  type: ListingType;
  title: string;
  slug: string;
  status: ListingStatus;
  categoryId: string | null;
  categoryName?: string | null;
  location: LocationDTO;
  city: string;
  state: string;
  price: ListingPriceDTO;
  totalCapacity?: number | null;
  capacityUnit?: CapacityUnit | null;
  rating: RatingSummaryDTO;
  coverImage?: string | null;
  images: string[];
  availableFrom?: string | null;
  createdAt: string;
  publishedAt?: string | null;
}

export interface ListingDetailDTO extends ListingSummaryDTO {
  description: string;
  amenities: string[];
  safetyFeatures: string[];
  rules: string[];
  minBookingDuration?: { value: number; unit: PricingPeriod } | null;
  cancellationTerms: CancellationTermDTO;
  warehouse?: WarehouseDetailsDTO | null;
  equipment?: EquipmentDetailsDTO | null;
  service?: ServiceDetailsDTO | null;
  availabilityRules: AvailabilityRuleDTO[];
  blockedDates: AvailabilityExceptionDTO[];
  canRequestBooking: boolean;
}

export interface BookingPricingDTO {
  currency: string;
  subtotal: number;
  platformFee: number;
  taxes: number;
  discount: number;
  total: number;
  breakdown: { label: string; amount: number }[];
  rateDescription: string;
}

export interface BookingStatusEventDTO {
  status: BookingStatus;
  at: string;
  byRole?: Role | null;
  note?: string | null;
}

export interface BookingDTO {
  id: string;
  reference: string;
  type: ListingType;
  status: BookingStatus;
  listing: {
    id: string;
    title: string;
    slug: string;
    type: ListingType;
    coverImage?: string | null;
    city: string;
  };
  customer: UserSummaryDTO;
  partner: { id: string; businessName: string; verified: boolean };
  startDate: string;
  endDate?: string | null;
  requestedCapacity?: number | null;
  capacityUnit?: CapacityUnit | null;
  quantity: number;
  notes?: string | null;
  specialRequirements?: string | null;
  pricing: BookingPricingDTO;
  items: {
    id: string;
    listingId: string;
    listingTitle: string;
    listingType: ListingType;
    quantity: number;
    unitLabel?: string | null;
    unitPrice: number;
    amount: number;
    currency: string;
  }[];
  statusHistory: BookingStatusEventDTO[];
  allowedTransitions?: BookingStatus[];
  cancellationReason?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewDTO {
  id: string;
  bookingId: string;
  listingId: string;
  listingTitle: string;
  author: UserSummaryDTO;
  rating: number;
  comment?: string | null;
  status: string;
  response?: { text: string; at: string } | null;
  createdAt: string;
}

export interface ConversationDTO {
  id: string;
  subject: string;
  listing?: { id: string; title: string; slug: string; coverImage?: string | null } | null;
  participants: { user: UserSummaryDTO; listingId?: string | null }[];
  lastMessage?: { preview: string; at: string; senderId: string } | null;
  unreadCount: number;
  status: string;
  updatedAt: string;
  createdAt: string;
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  sender: UserSummaryDTO;
  body: string;
  readBy: string[];
  createdAt: string;
}

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

export interface PartnerDashboardDTO {
  verificationStatus: VerificationStatus;
  totals: {
    activeListings: number;
    draftListings: number;
    pendingRequests: number;
    confirmedBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    unreadMessages: number;
    averageRating: number;
    reviewCount: number;
  };
  revenue: {
    currency: string;
    totalEarned: number;
    pendingPayout: number;
    last30Days: number;
  };
  responseRate: number;
  trends: { date: string; bookings: number; revenue: number }[];
  /** NOTE: the API currently returns raw booking docs here (not serialized DTOs). */
  upcomingBookings: BookingDTO[];
  recentRequests: BookingDTO[];
}

export interface EarningRowDTO {
  id: string;
  bookingReference: string;
  listingTitle: string;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  currency: string;
  paidAt: string | null;
}
