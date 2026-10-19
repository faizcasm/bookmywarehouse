/**
 * Local mirrors of the API DTOs used by the admin console.
 * Kept in-app (instead of importing @bmw/shared-types) so the package has zero
 * workspace dependencies beyond react/react-router.
 */

export type Role = 'CUSTOMER' | 'PARTNER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type ListingType = 'WAREHOUSE' | 'EQUIPMENT' | 'SERVICE';
export type ListingStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'UNPUBLISHED'
  | 'SUSPENDED'
  | 'ARCHIVED';
export type VerificationStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
export type BookingStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'AWAITING_PAYMENT'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'DISPUTED';
export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'CANCELLED';
export type RefundStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REJECTED';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'VOID' | 'REFUNDED';
export type ReviewStatus = 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'REMOVED';
export type DisputeStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'RESOLVED_CUSTOMER'
  | 'RESOLVED_PARTNER'
  | 'CLOSED'
  | 'WITHDRAWN';
export type DisputeReason =
  | 'SERVICE_NOT_DELIVERED'
  | 'QUALITY_ISSUE'
  | 'OVERCHARGE'
  | 'CANCELLATION_REFUND'
  | 'DAMAGE'
  | 'OTHER';

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string | null;
  avatarUrl?: string | null;
  emailVerified: boolean;
  status: AccountStatus;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string | null;
  avatarUrl?: string | null;
  emailVerified: boolean;
  status: AccountStatus;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
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
    currency: string;
    grossCollected: number;
    platformFees: number;
    refunds: number;
    netCollected: number;
    periodDays: number;
  };
  trends: { date: string; bookings: number; grossAmount: number }[];
  /** NOTE: the API returns raw booking docs here (not serialized BookingDTO). */
  recentBookings: RawBookingDoc[];
  recentDisputes: DisputeDTO[];
}

/** Raw mongoose booking doc as returned by /admin/dashboard (ids, not objects). */
export interface RawBookingDoc {
  _id: string;
  id?: string;
  reference: string;
  type: ListingType;
  status: BookingStatus;
  listing?: string;
  listingSnapshot?: { title?: string; slug?: string; type?: ListingType; coverImage?: string | null; city?: string };
  customer?: string;
  partner?: string;
  startDate: string;
  endDate?: string | null;
  quantity: number;
  pricing?: { totalMinor?: number; currency?: string };
  createdAt: string;
}

export interface AdminPartnerListItem {
  partnerId: string;
  userId: string;
  businessName: string;
  businessType?: string | null;
  verificationStatus: VerificationStatus;
  city?: string | null;
  listingCount: number;
  totalBookings: number;
  responseRate?: number | null;
  user: { id: string; name: string; email: string; status: AccountStatus; avatarUrl?: string | null } | null;
  createdAt: string;
}

export interface PartnerDetailDTO {
  partnerId: string;
  userId: string;
  businessName: string;
  businessType?: string | null;
  description?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  verificationStatus: VerificationStatus;
  verification: {
    id: string;
    status: VerificationStatus;
    legalBusinessName?: string | null;
    gstNumber?: string | null;
    panNumber?: string | null;
    registrationNumber?: string | null;
    documents: {
      id: string;
      label: string;
      url: string;
      status: 'UPLOADED' | 'VERIFIED' | 'REJECTED';
      uploadedAt: string;
      rejectionReason?: string | null;
    }[];
    submittedAt?: string | null;
    reviewedAt?: string | null;
    rejectionReason?: string | null;
    reviewerNotes?: string | null;
  } | null;
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    status: AccountStatus;
    emailVerified: boolean;
  } | null;
  payout: {
    accountHolderName?: string | null;
    accountNumberMasked?: string | null;
    ifsc?: string | null;
    bankName?: string | null;
    upiId?: string | null;
  } | null;
  listings: AdminListingItem[];
  recentBookings: BookingDTO[];
  createdAt: string;
}

export interface ListingPriceDTO {
  model: string;
  amount: number;
  currency: string;
  period?: string | null;
  unitLabel?: string | null;
  minQuantity?: number | null;
}

export interface AdminListingItem {
  id: string;
  type: ListingType;
  title: string;
  slug: string;
  status: ListingStatus;
  categoryId: string | null;
  categoryName?: string | null;
  location: { city: string; state: string; addressLine1?: string; [k: string]: unknown };
  city: string;
  state: string;
  price: ListingPriceDTO;
  totalCapacity?: number | null;
  capacityUnit?: string | null;
  rating: { average: number; count: number };
  coverImage?: string | null;
  images: string[];
  partner: { id: string; businessName: string; verified: boolean; logoUrl?: string | null };
  createdAt: string;
  publishedAt?: string | null;
  partnerUserId: string;
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

export interface BookingDTO {
  id: string;
  reference: string;
  type: ListingType;
  status: BookingStatus;
  listing: { id: string; title: string; slug: string; type: ListingType; coverImage?: string | null; city: string };
  customer: { id: string; name: string; role?: Role; avatarUrl?: string | null };
  partner: { id: string; businessName: string; verified: boolean };
  startDate: string;
  endDate?: string | null;
  requestedCapacity?: number | null;
  capacityUnit?: string | null;
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
  statusHistory: { status: BookingStatus; at: string; byRole?: Role | null; note?: string | null }[];
  allowedTransitions?: BookingStatus[];
  cancellationReason?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDTO {
  id: string;
  bookingId: string;
  reference: string;
  provider: string;
  providerPaymentId?: string | null;
  amount: number;
  currency: string;
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
  currency: string;
  status: RefundStatus;
  reason?: string | null;
  createdAt: string;
  processedAt?: string | null;
}

export interface InvoiceDTO {
  id: string;
  invoiceNumber: string;
  bookingId: string;
  bookingReference: string;
  status: InvoiceStatus;
  issuedTo: { name: string; email: string; address?: string | null };
  issuedBy: { businessName: string; address?: string | null; gstNumber?: string | null };
  lineItems: { description: string; quantity: number; unitAmount: number; amount: number }[];
  subtotal: number;
  platformFee: number;
  taxAmount: number;
  total: number;
  currency: string;
  paidAt?: string | null;
  dueAt?: string | null;
  createdAt: string;
  pdfUrl?: string | null;
}

export interface DisputeDTO {
  id: string;
  reference: string;
  bookingId: string;
  bookingReference: string;
  openedBy: { id: string; name: string; role: Role };
  againstParty: 'CUSTOMER' | 'PARTNER';
  reason: DisputeReason;
  description: string;
  status: DisputeStatus;
  resolutionNote?: string | null;
  createdAt: string;
  updatedAt: string;
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

/** Raw mongoose review doc as returned by GET /admin/reviews. */
export interface RawReviewDoc {
  _id: string;
  id?: string;
  booking: string;
  listing: string;
  author: string;
  partner: string;
  rating: number;
  comment?: string | null;
  status: ReviewStatus;
  response?: { text: string; at: string } | null;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditLogDTO {
  id: string;
  actor: { id: string; name: string; role: Role };
  action: string;
  entityType: string;
  entityId: string;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  createdAt: string;
}

export interface PlatformSettingsDTO {
  currency: string;
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
