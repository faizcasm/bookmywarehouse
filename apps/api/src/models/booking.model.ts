import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  BOOKING_STATUSES,
  BOOKING_KINDS,
  CURRENCIES,
  type BookingStatus,
  type CapacityUnit,
  type ListingType,
  type PricingPeriod,
} from '@bmw/shared-types';

export interface BookingPricingFields {
  currency: string;
  subtotalMinor: number;
  platformFeeMinor: number;
  taxesMinor: number;
  discountMinor: number;
  totalMinor: number;
  breakdown: { label: string; amountMinor: number }[];
  rateDescription: string;
}

const bookingPricingSchema = new Schema<BookingPricingFields>(
  {
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    subtotalMinor: { type: Number, required: true, min: 0 },
    platformFeeMinor: { type: Number, required: true, min: 0 },
    taxesMinor: { type: Number, required: true, min: 0 },
    discountMinor: { type: Number, default: 0, min: 0 },
    totalMinor: { type: Number, required: true, min: 0 },
    breakdown: {
      type: [
        new Schema<{ label: string; amountMinor: number }>(
          { label: { type: String, required: true }, amountMinor: { type: Number, required: true } },
          { _id: false },
        ),
      ],
      default: [],
    },
    rateDescription: { type: String, default: '' },
  },
  { _id: false },
);

export interface BookingItemFields {
  _id?: Types.ObjectId;
  listing: Types.ObjectId;
  title: string;
  type: ListingType;
  quantity: number;
  unitLabel: string | null;
  unitPriceMinor: number;
  amountMinor: number;
  currency: string;
}

const bookingItemSchema = new Schema<BookingItemFields>(
  {
    listing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    title: { type: String, required: true },
    type: { type: String, enum: BOOKING_KINDS, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitLabel: { type: String, default: null },
    unitPriceMinor: { type: Number, required: true, min: 0 },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
  },
  { _id: true },
);

export interface BookingStatusEventFields {
  status: BookingStatus;
  at: Date;
  byRole: string | null;
  note: string | null;
}

const bookingStatusEventSchema = new Schema<BookingStatusEventFields>(
  {
    status: { type: String, enum: BOOKING_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    byRole: { type: String, default: null },
    note: { type: String, default: null, maxlength: 600 },
  },
  { _id: false },
);

export interface BookingFields {
  reference: string;
  type: ListingType;
  listing: Types.ObjectId;
  listingSnapshot: {
    title: string;
    slug: string;
    type: ListingType;
    coverImage: string | null;
    city: string;
    partner: Types.ObjectId;
  };
  customer: Types.ObjectId;
  partner: Types.ObjectId;
  status: BookingStatus;
  statusHistory: BookingStatusEventFields[];
  startDate: Date;
  endDate: Date | null;
  requestedCapacity: number | null;
  capacityUnit: CapacityUnit | null;
  quantity: number;
  minBookingDuration: { value: number; unit: PricingPeriod } | null;
  notes: string | null;
  specialRequirements: string | null;
  pricing: BookingPricingFields;
  items: BookingItemFields[];
  payment: Types.ObjectId | null;
  invoice: Types.ObjectId | null;
  review: Types.ObjectId | null;
  cancellationReason: string | null;
  rejectionReason: string | null;
  cancelledBy: Types.ObjectId | null;
  /** Whether this reservation consumes listing capacity (false for drafts). */
  blocksCapacity: boolean;
  paymentDeadline: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<BookingFields>(
  {
    reference: { type: String, required: true, unique: true },
    type: { type: String, enum: BOOKING_KINDS, required: true },
    listing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    listingSnapshot: {
      title: { type: String, required: true },
      slug: { type: String, required: true },
      type: { type: String, enum: BOOKING_KINDS, required: true },
      coverImage: { type: String, default: null },
      city: { type: String, required: true },
      partner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    partner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: BOOKING_STATUSES, default: 'PENDING_APPROVAL' },
    statusHistory: { type: [bookingStatusEventSchema], default: [] },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    requestedCapacity: { type: Number, default: null },
    capacityUnit: { type: String, enum: ['SQFT', 'SQM', 'PALLET', 'TON', 'CBM', 'UNIT', 'LITRE'], default: null },
    quantity: { type: Number, default: 1, min: 1 },
    minBookingDuration: {
      type: new Schema<{ value: number; unit: PricingPeriod }>(
        { value: { type: Number, required: true }, unit: { type: String, required: true } },
        { _id: false },
      ),
      default: null,
    },
    notes: { type: String, default: null, maxlength: 1000 },
    specialRequirements: { type: String, default: null, maxlength: 2000 },
    pricing: { type: bookingPricingSchema, required: true },
    items: { type: [bookingItemSchema], default: [] },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null },
    review: { type: Schema.Types.ObjectId, ref: 'Review', default: null },
    cancellationReason: { type: String, default: null },
    rejectionReason: { type: String, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    blocksCapacity: { type: Boolean, default: true },
    paymentDeadline: { type: Date, default: null },
  },
  { timestamps: true },
);

bookingSchema.index({ customer: 1, createdAt: -1 });
bookingSchema.index({ partner: 1, status: 1, startDate: 1 });
/** Partner booking lists filter on partner (+optional status) and sort by createdAt. */
bookingSchema.index({ partner: 1, status: 1, createdAt: -1 });
bookingSchema.index({ listing: 1, startDate: 1, endDate: 1, status: 1 });
bookingSchema.index({ status: 1, paymentDeadline: 1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ type: 1, status: 1 });

export type BookingDocument = HydratedDocument<BookingFields>;
export const Booking = model('Booking', bookingSchema);
