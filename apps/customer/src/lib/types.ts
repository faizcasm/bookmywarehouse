/**
 * Local mirror of the DTO shapes returned by the API
 * (see packages/shared-types/src/dto.ts and docs/API_REFERENCE.md).
 * Kept local so the app has no build-time dependency on workspace packages.
 */

export type Role = 'CUSTOMER' | 'PARTNER' | 'ADMIN';
export type ListingType = 'WAREHOUSE' | 'EQUIPMENT' | 'SERVICE';
export type PricingModel =
  | 'FIXED'
  | 'PER_SQFT'
  | 'PER_SQMT'
  | 'PER_PALLET'
  | 'PER_UNIT'
  | 'PER_HOUR'
  | 'PER_DAY';
export type PricingPeriod = 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
export type ListingSort =
  | 'relevance'
  | 'price_asc'
  | 'price_desc'
  | 'capacity_desc'
  | 'rating_desc'
  | 'newest'
  | 'oldest';
export type Currency = string;

export interface ApiErrorIssue {
  path?: string;
  message: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface EnvelopeMeta {
  pagination?: PaginationMeta;
}

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string | null;
  avatarUrl?: string | null;
  emailVerified: boolean;
  status: string;
  createdAt: string;
}

export interface AuthPayload {
  user: UserDTO;
  accessToken: string;
  csrfToken?: string;
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
  amount: number;
  taxable: boolean;
}

export interface ListingPriceDTO {
  model: PricingModel;
  amount: number;
  currency: Currency;
  period?: PricingPeriod | null;
  unitLabel?: string | null;
  minQuantity?: number | null;
  additionalCharges?: AdditionalChargeDTO[];
}

export interface RatingSummaryDTO {
  average: number;
  count: number;
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

export interface ListingSummaryDTO {
  id: string;
  type: ListingType;
  title: string;
  slug: string;
  status: string;
  categoryId: string | null;
  categoryName?: string | null;
  location: LocationDTO;
  city: string;
  state: string;
  price: ListingPriceDTO;
  totalCapacity?: number | null;
  capacityUnit?: string | null;
  rating: RatingSummaryDTO;
  coverImage?: string | null;
  images: string[];
  partner: {
    id: string;
    businessName: string;
    verified: boolean;
    logoUrl?: string | null;
    rating?: RatingSummaryDTO;
    responseRate?: number | null;
    joinedAt?: string;
  };
  availableFrom?: string | null;
  isFavorite?: boolean;
  createdAt: string;
  publishedAt?: string | null;
}

export interface CancellationTermDTO {
  policy: string;
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

export interface WarehouseDetailsDTO {
  facilityType: string;
  storageTypes: string[];
  totalCapacity: number;
  capacityUnit: string;
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
  equipmentCategory: string;
  brand?: string | null;
  model?: string | null;
  manufactureYear?: number | null;
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
  serviceType: string;
  serviceAreas: string[];
  estimatedDurationHours?: number | null;
  teamSize?: number | null;
  dailyCapacity?: number | null;
  requirements?: string | null;
  availableQuantity?: number | null;
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
  related: ListingSummaryDTO[];
}

export interface AvailabilityDTO {
  rules: AvailabilityRuleDTO[];
  blockedDates: AvailabilityExceptionDTO[];
}

export interface SearchFacetsDTO {
  cities: { value: string; count: number }[];
  categories: { value: string; label: string; count: number }[];
  priceRange: { min: number; max: number; currency: Currency } | null;
}

export interface SearchResponseDTO {
  items: ListingSummaryDTO[];
  facets?: SearchFacetsDTO;
  sort?: ListingSort;
}

export interface BookingPricingDTO {
  currency: Currency;
  subtotal: number;
  platformFee: number;
  taxes: number;
  discount: number;
  total: number;
  breakdown: { label: string; amount: number }[];
  rateDescription: string;
}

export interface QuoteResponseDTO {
  listingId: string;
  currency: Currency;
  pricing: BookingPricingDTO | null;
  available: boolean;
  unavailableReason?: string | null;
  startDate: string;
  endDate?: string | null;
  remainingCapacity?: number | null;
}

export interface BookingStatusEventDTO {
  status: string;
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
  status: string;
  listing: {
    id: string;
    title: string;
    slug: string;
    type: ListingType;
    coverImage?: string | null;
    city: string;
  };
  customer: { id: string; name: string; role: Role; avatarUrl?: string | null };
  partner: { id: string; businessName: string; verified: boolean };
  startDate: string;
  endDate?: string | null;
  requestedCapacity?: number | null;
  capacityUnit?: string | null;
  quantity: number;
  notes?: string | null;
  specialRequirements?: string | null;
  pricing: BookingPricingDTO;
  items: BookingItemDTO[];
  statusHistory: BookingStatusEventDTO[];
  allowedTransitions: string[];
  cancellationReason?: string | null;
  rejectionReason?: string | null;
  invoiceId?: string | null;
  reviewId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CancelBookingResponse {
  booking: BookingDTO;
  refundAmountMinor?: number;
}

export interface PaymentInitiateDTO {
  payment: {
    id: string;
    reference: string;
    amount: number;
    currency: Currency;
    status: string;
    provider: string;
  };
  checkoutUrl?: string | null;
  sandbox: boolean;
  message?: string | null;
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
  status: string;
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
  author: { id: string; name: string; role: Role; avatarUrl?: string | null };
  rating: number;
  comment?: string | null;
  status: string;
  response?: { text: string; at: string } | null;
  createdAt: string;
}

export interface FavoriteDTO {
  id: string;
  listing: ListingSummaryDTO;
  createdAt: string;
}

export interface ConversationDTO {
  id: string;
  subject: string;
  listing?: { id: string; title: string; slug: string; coverImage?: string | null } | null;
  participants: {
    user: { id: string; name: string; role: Role; avatarUrl?: string | null };
    listingId?: string | null;
  }[];
  lastMessage?: { preview: string; at: string; senderId: string } | null;
  unreadCount: number;
  status: string;
  updatedAt: string;
  createdAt: string;
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  sender: { id: string; name: string; role: Role; avatarUrl?: string | null };
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

export interface NotificationsPayload {
  unread: number;
  items: NotificationDTO[];
}

export interface ConversationPayload {
  items: ConversationDTO[];
  unreadTotal?: number;
}

export interface DisputeDTO {
  id: string;
  reference: string;
  bookingId: string;
  bookingReference: string;
  openedBy: { id: string; name: string; role: Role; avatarUrl?: string | null };
  againstParty: 'CUSTOMER' | 'PARTNER';
  reason: string;
  description: string;
  status: string;
  resolutionNote?: string | null;
  createdAt: string;
  updatedAt: string;
}
