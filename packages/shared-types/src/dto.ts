import type {
  AccountStatus,
  BookingStatus,
  CapacityUnit,
  CancellationPolicy,
  ConversationStatus,
  DisputeReason,
  DisputeStatus,
  EquipmentCategory,
  FacilityType,
  InvoiceStatus,
  ListingSort,
  ListingStatus,
  ListingType,
  NotificationType,
  PricingModel,
  PricingPeriod,
  RefundStatus,
  ReviewStatus,
  Role,
  ServiceType,
  StorageType,
  VerificationStatus,
} from './enums.js';

import type { Currency } from './money.js';

export interface UserSummaryDTO {
  id: string;
  name: string;
  role: Role;
  avatarUrl?: string | null;
}

export interface UserDTO extends UserSummaryDTO {
  email: string;
  phone?: string | null;
  emailVerified: boolean;
  status: AccountStatus;
  createdAt: string;
}

export interface CustomerProfileDTO {
  userId: string;
  companyName?: string | null;
  gstNumber?: string | null;
  businessType?: string | null;
  address?: LocationDTO | null;
  preferredLanguage?: string | null;
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
  reviewedBy?: string | null;
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

export interface LocationDTO {
  addressLine1: string;
  addressLine2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  /** Free-form area/region used for text search (e.g. "Bhiwandi", "Delhi NCR"). */
  region?: string | null;
  coordinates?: { lat: number; lng: number } | null;
  serviceRadiusKm?: number | null;
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

export interface AdditionalChargeDTO {
  label: string;
  /** Amount in minor units. */
  amount: number;
  taxable: boolean;
}

export interface ListingPriceDTO {
  model: PricingModel;
  /** Price per unit of the pricing period/model, in minor units. */
  amount: number;
  currency: Currency;
  period?: PricingPeriod | null;
  /** Human label for the pricing unit, e.g. "per sq.ft / month". */
  unitLabel?: string | null;
  minQuantity?: number | null;
  additionalCharges?: AdditionalChargeDTO[];
}

export interface RatingSummaryDTO {
  average: number;
  count: number;
}

export interface PartnerListingSummaryDTO {
  id: string;
  businessName: string;
  verified: boolean;
  logoUrl?: string | null;
  rating: RatingSummaryDTO;
  responseRate?: number | null;
  joinedAt: string;
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
  /** Convenience mirrors of location for list rendering / filtering. */
  city: string;
  state: string;
  price: ListingPriceDTO;
  totalCapacity?: number | null;
  capacityUnit?: CapacityUnit | null;
  rating: RatingSummaryDTO;
  coverImage?: string | null;
  images: string[];
  partner: PartnerListingSummaryDTO;
  availableFrom?: string | null;
  isFavorite?: boolean;
  createdAt: string;
  publishedAt?: string | null;
}

export interface WarehouseDetailsDTO {
  facilityType: FacilityType;
  storageTypes: StorageType[];
  totalCapacity: number;
  capacityUnit: CapacityUnit;
  availableCapacity?: number | null;
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
  /** Number of units available for the requested period. */
  quantity: number;
  availableQuantity?: number | null;
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
  /** Maximum concurrent bookings the provider can serve per day. */
  dailyCapacity?: number | null;
  requirements?: string | null;
  availableQuantity?: number | null;
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

export interface CancellationTermDTO {
  policy: CancellationPolicy;
  description: string;
  /** Refund percentage (0-100) applied when the customer cancels before start. */
  customerRefundPercent: number;
  note?: string | null;
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
  /** Next date (ISO) the listing can be booked from, computed server-side. */
  availableFrom?: string | null;
  canRequestBooking: boolean;
  related: ListingSummaryDTO[];
}

export interface BookingPricingDTO {
  currency: Currency;
  /** Base charge before taxes and fees, minor units. */
  subtotal: number;
  /** Platform commission recovered from the customer where configured. */
  platformFee: number;
  taxes: number;
  discount: number;
  total: number;
  breakdown: { label: string; amount: number }[];
  /** Human-readable rate description, e.g. "1200 INR x 3 months". */
  rateDescription: string;
}

export interface BookingStatusEventDTO {
  status: BookingStatus;
  at: string;
  byRole?: Role | null;
  note?: string | null;
}

export interface BookingItemDTO {
  id: string;
  listingId: string;
  listingTitle: string;
  listingType: ListingType;
  quantity: number;
  unitLabel?: string | null;
  unitPrice: number;
  amount: number;
  currency: Currency;
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
  items: BookingItemDTO[];
  statusHistory: BookingStatusEventDTO[];
  allowedTransitions: BookingStatus[];
  cancellationReason?: string | null;
  rejectionReason?: string | null;
  invoiceId?: string | null;
  reviewId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteRequestDTO {
  listingId: string;
  startDate: string;
  endDate?: string | null;
  capacity?: number | null;
  quantity?: number;
  deliveryRequired?: boolean;
  operatorRequired?: boolean;
}

export interface QuoteResponseDTO {
  listingId: string;
  currency: Currency;
  pricing: BookingPricingDTO;
  available: boolean;
  unavailableReason?: string | null;
  startDate: string;
  endDate?: string | null;
  /** Remaining capacity for the requested interval after this booking. */
  remainingCapacity?: number | null;
}

export interface PaymentDTO {
  id: string;
  bookingId: string;
  reference: string;
  provider: string;
  providerPaymentId?: string | null;
  amount: number;
  currency: Currency;
  status: string;
  method?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export interface RefundDTO {
  id: string;
  paymentId: string;
  bookingId: string;
  amount: number;
  currency: Currency;
  status: RefundStatus;
  reason?: string | null;
  createdAt: string;
  processedAt?: string | null;
}

export interface InvoiceLineItemDTO {
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
}

export interface InvoiceDTO {
  id: string;
  invoiceNumber: string;
  bookingId: string;
  bookingReference: string;
  status: InvoiceStatus;
  issuedTo: { name: string; email: string; address?: string | null };
  issuedBy: { businessName: string; address?: string | null; gstNumber?: string | null };
  lineItems: InvoiceLineItemDTO[];
  subtotal: number;
  platformFee: number;
  taxAmount: number;
  total: number;
  currency: Currency;
  paidAt?: string | null;
  dueAt?: string | null;
  createdAt: string;
  pdfUrl?: string | null;
}

export interface ReviewDTO {
  id: string;
  bookingId: string;
  listingId: string;
  listingTitle: string;
  author: UserSummaryDTO;
  rating: number;
  comment?: string | null;
  status: ReviewStatus;
  response?: { text: string; at: string } | null;
  createdAt: string;
}

export interface FavoriteDTO {
  id: string;
  listing: ListingSummaryDTO;
  createdAt: string;
}

export interface ConversationParticipantDTO {
  user: UserSummaryDTO;
  listingId?: string | null;
}

export interface ConversationDTO {
  id: string;
  subject: string;
  listing?: { id: string; title: string; slug: string; coverImage?: string | null } | null;
  participants: ConversationParticipantDTO[];
  lastMessage?: { preview: string; at: string; senderId: string } | null;
  unreadCount: number;
  status: ConversationStatus;
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
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

export interface DisputeDTO {
  id: string;
  reference: string;
  bookingId: string;
  bookingReference: string;
  openedBy: UserSummaryDTO;
  againstParty: 'CUSTOMER' | 'PARTNER';
  reason: DisputeReason;
  description: string;
  status: DisputeStatus;
  resolutionNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogDTO {
  id: string;
  actor: UserSummaryDTO;
  action: string;
  entityType: string;
  entityId: string;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  createdAt: string;
}

export interface AdminDashboardDTO {
  totals: {
    customers: number;
    partners: number;
    verifiedPartners: number;
    listings: number;
    activeListings: number;
    bookings: number;
    pendingBookings: number;
    disputesOpen: number;
    pendingVerifications: number;
    pendingListings: number;
  };
  revenue: {
    currency: Currency;
    grossCollected: number;
    platformFees: number;
    refunds: number;
    netCollected: number;
    periodDays: number;
  };
  trends: { date: string; bookings: number; grossAmount: number }[];
  recentBookings: BookingDTO[];
  recentDisputes: DisputeDTO[];
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
    currency: Currency;
    totalEarned: number;
    pendingPayout: number;
    last30Days: number;
  };
  responseRate: number;
  trends: { date: string; bookings: number; revenue: number }[];
  upcomingBookings: BookingDTO[];
  recentRequests: BookingDTO[];
}

export interface CustomerDashboardDTO {
  totals: {
    activeBookings: number;
    totalBookings: number;
    completedBookings: number;
    favorites: number;
    unreadMessages: number;
    unreadNotifications: number;
  };
  recentBookings: BookingDTO[];
}

export interface PlatformSettingsDTO {
  currency: Currency;
  platformFeePercent: number;
  customerFeePercent: number;
  taxPercent: number;
  minPayoutAmount: number;
  supportEmail: string;
  allowSelfServiceListings: boolean;
  requirePartnerVerification: boolean;
  maintenanceMode: boolean;
  announcement?: string | null;
}

export interface HealthStatusDTO {
  status: 'ok' | 'degraded';
  version: string;
  uptimeSeconds: number;
  database: { connected: boolean; latencyMs?: number | null };
  timestamp: string;
}

export interface SearchFacetsDTO {
  cities: { value: string; count: number }[];
  categories: { value: string; label: string; count: number }[];
  priceRange: { min: number; max: number; currency: Currency } | null;
}

export interface SearchResponseDTO {
  items: ListingSummaryDTO[];
  facets: SearchFacetsDTO;
  sort: ListingSort;
}

export type { Currency };
