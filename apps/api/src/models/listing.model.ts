import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  CANCELLATION_POLICIES,
  CAPACITY_UNITS,
  EQUIPMENT_CATEGORIES,
  FACILITY_TYPES,
  LISTING_STATUSES,
  LISTING_TYPES,
  PRICING_MODELS,
  PRICING_PERIODS,
  SERVICE_TYPES,
  STORAGE_TYPES,
  type CapacityUnit,
  type CancellationPolicy,
  type EquipmentCategory,
  type FacilityType,
  type ListingStatus,
  type ListingType,
  type PricingModel,
  type PricingPeriod,
  type ServiceType,
  type StorageType,
} from '@bmw/shared-types';
import { locationSchema, type LocationFields } from './profile.model.js';

export interface AdditionalChargeFields {
  label: string;
  /** Minor units. */
  amount: number;
  taxable: boolean;
}

export interface PriceFields {
  model: PricingModel;
  /** All money is stored as integer minor units (paise for INR). */
  amountMinor: number;
  currency: string;
  period: PricingPeriod | null;
  unitLabel: string | null;
  minQuantity: number | null;
  additionalCharges: AdditionalChargeFields[];
}

const priceSchema = new Schema<PriceFields>(
  {
    model: { type: String, enum: PRICING_MODELS, required: true },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, default: 'INR' },
    period: { type: String, enum: PRICING_PERIODS, default: null },
    unitLabel: { type: String, default: null, maxlength: 80 },
    minQuantity: { type: Number, default: null },
    additionalCharges: {
      type: [
        new Schema<AdditionalChargeFields>(
          {
            label: { type: String, required: true },
            amount: { type: Number, required: true, min: 0 },
            taxable: { type: Boolean, default: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { _id: false },
);

export interface CancellationTermsFields {
  policy: CancellationPolicy;
  description: string;
  customerRefundPercent: number;
  note: string | null;
}

const cancellationTermsSchema = new Schema<CancellationTermsFields>(
  {
    policy: { type: String, enum: CANCELLATION_POLICIES, default: 'MODERATE' },
    description: { type: String, required: true, maxlength: 600 },
    customerRefundPercent: { type: Number, required: true, min: 0, max: 100 },
    note: { type: String, default: null, maxlength: 400 },
  },
  { _id: false },
);

export interface WarehouseDetailsFields {
  listing: Types.ObjectId;
  facilityType: FacilityType;
  storageTypes: StorageType[];
  totalCapacity: number;
  capacityUnit: CapacityUnit;
  numberOfUnits: number | null;
  unitDimensions: string | null;
  ceilingHeightM: number | null;
  floorLoadCapacityKg: number | null;
  loadingDocks: number;
  driveways: number;
  temperatureControlled: boolean;
  humidityControlled: boolean;
  powerBackup: boolean;
  fireSafety: boolean;
  cctv: boolean;
  certifications: string[];
  operatingHours: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const warehouseDetailsSchema = new Schema<WarehouseDetailsFields>(
  {
    listing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, unique: true },
    facilityType: { type: String, enum: FACILITY_TYPES, required: true },
    storageTypes: { type: [{ type: String, enum: STORAGE_TYPES }], required: true },
    totalCapacity: { type: Number, required: true, min: 0 },
    capacityUnit: { type: String, enum: CAPACITY_UNITS, required: true },
    numberOfUnits: { type: Number, default: null },
    unitDimensions: { type: String, default: null, maxlength: 200 },
    ceilingHeightM: { type: Number, default: null },
    floorLoadCapacityKg: { type: Number, default: null },
    loadingDocks: { type: Number, default: 0 },
    driveways: { type: Number, default: 0 },
    temperatureControlled: { type: Boolean, default: false },
    humidityControlled: { type: Boolean, default: false },
    powerBackup: { type: Boolean, default: false },
    fireSafety: { type: Boolean, default: false },
    cctv: { type: Boolean, default: false },
    certifications: { type: [String], default: [] },
    operatingHours: { type: String, default: null, maxlength: 120 },
  },
  { timestamps: true },
);

export interface EquipmentDetailsFields {
  listing: Types.ObjectId;
  equipmentCategory: EquipmentCategory;
  brand: string | null;
  model: string | null;
  manufactureYear: number | null;
  quantity: number;
  rentalPeriod: PricingPeriod;
  deliveryAvailable: boolean;
  operatorAvailable: boolean;
  operatorChargePerDayMinor: number | null;
  minRentalDuration: number | null;
  specifications: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const equipmentDetailsSchema = new Schema<EquipmentDetailsFields>(
  {
    listing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, unique: true },
    equipmentCategory: { type: String, enum: EQUIPMENT_CATEGORIES, required: true },
    brand: { type: String, default: null, maxlength: 80 },
    model: { type: String, default: null, maxlength: 80 },
    manufactureYear: { type: Number, default: null },
    quantity: { type: Number, required: true, min: 1 },
    rentalPeriod: { type: String, enum: PRICING_PERIODS, default: 'DAY' },
    deliveryAvailable: { type: Boolean, default: false },
    operatorAvailable: { type: Boolean, default: false },
    operatorChargePerDayMinor: { type: Number, default: null, min: 0 },
    minRentalDuration: { type: Number, default: null },
    specifications: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export interface ServiceDetailsFields {
  listing: Types.ObjectId;
  serviceType: ServiceType;
  serviceAreas: string[];
  estimatedDurationHours: number | null;
  teamSize: number | null;
  dailyCapacity: number | null;
  requirements: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const serviceDetailsSchema = new Schema<ServiceDetailsFields>(
  {
    listing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, unique: true },
    serviceType: { type: String, enum: SERVICE_TYPES, required: true },
    serviceAreas: { type: [String], required: true },
    estimatedDurationHours: { type: Number, default: null },
    teamSize: { type: Number, default: null },
    dailyCapacity: { type: Number, default: null },
    requirements: { type: String, default: null, maxlength: 600 },
  },
  { timestamps: true },
);

export interface ListingFields {
  type: ListingType;
  title: string;
  slug: string;
  description: string;
  partner: Types.ObjectId;
  category: Types.ObjectId | null;
  status: ListingStatus;
  location: LocationFields;
  /** GeoJSON point stored as [lng, lat] for optional radius search. */
  geo: { type: 'Point'; coordinates: number[] } | null;
  price: PriceFields;
  /** Denormalized copy of warehouse/equipment capacity so search can sort and filter on it. */
  capacitySort: number;
  images: string[];
  amenities: string[];
  safetyFeatures: string[];
  rules: string[];
  minBookingDuration: { value: number; unit: PricingPeriod } | null;
  cancellationTerms: CancellationTermsFields;
  availableFrom: Date | null;
  rating: { average: number; count: number };
  warehouse: Types.ObjectId | null;
  equipment: Types.ObjectId | null;
  service: Types.ObjectId | null;
  submittedAt: Date | null;
  publishedAt: Date | null;
  moderationReason: string | null;
  moderatedBy: Types.ObjectId | null;
  moderatedAt: Date | null;
  viewCount: number;
  archivedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const BLOCKING_BOOKING_STATUSES = [
  'PENDING_APPROVAL',
  'AWAITING_PAYMENT',
  'CONFIRMED',
  'IN_PROGRESS',
  'DISPUTED',
] as const;

const listingSchema = new Schema<ListingFields>(
  {
    type: { type: String, enum: LISTING_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true, maxlength: 5000 },
    partner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    status: { type: String, enum: LISTING_STATUSES, default: 'DRAFT' },
    location: { type: locationSchema, required: true },
    geo: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: { type: [Number], default: null },
    },
    price: { type: priceSchema, required: true },
    capacitySort: { type: Number, default: 0 },
    images: { type: [String], default: [] },
    amenities: { type: [String], default: [] },
    safetyFeatures: { type: [String], default: [] },
    rules: { type: [String], default: [] },
    minBookingDuration: {
      type: new Schema<{ value: number; unit: PricingPeriod }>(
        { value: { type: Number, required: true }, unit: { type: String, enum: PRICING_PERIODS } },
        { _id: false },
      ),
      default: null,
    },
    cancellationTerms: { type: cancellationTermsSchema, required: true },
    availableFrom: { type: Date, default: null },
    rating: {
      type: new Schema<{ average: number; count: number }>(
        { average: { type: Number, default: 0, min: 0, max: 5 }, count: { type: Number, default: 0, min: 0 } },
        { _id: false },
      ),
      default: () => ({ average: 0, count: 0 }),
    },
    warehouse: { type: Schema.Types.ObjectId, ref: 'WarehouseDetails', default: null },
    equipment: { type: Schema.Types.ObjectId, ref: 'EquipmentDetails', default: null },
    service: { type: Schema.Types.ObjectId, ref: 'ServiceDetails', default: null },
    submittedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    moderationReason: { type: String, default: null },
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    moderatedAt: { type: Date, default: null },
    viewCount: { type: Number, default: 0 },
    archivedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

listingSchema.index({ status: 1, type: 1, 'location.city': 1 });
listingSchema.index({ partner: 1, status: 1, updatedAt: -1 });
listingSchema.index({ status: 1, publishedAt: -1 });
listingSchema.index({ status: 1, 'price.amountMinor': 1 });
listingSchema.index({ status: 1, capacitySort: -1 });
listingSchema.index({ status: 1, 'rating.average': -1 });
listingSchema.index({ status: 1, category: 1 });
listingSchema.index(
  { title: 'text', description: 'text', 'location.city': 'text', 'location.region': 'text' },
  { weights: { title: 10, 'location.city': 6, 'location.region': 4, description: 1 }, name: 'ListingTextSearch' },
);
listingSchema.index({ geo: '2dsphere' }, { sparse: true, name: 'ListingGeo' });
listingSchema.index({ createdAt: -1 });

export type ListingDocument = HydratedDocument<ListingFields>;
export const Listing = model('Listing', listingSchema);
export const WarehouseDetails = model('WarehouseDetails',
  warehouseDetailsSchema,
);
export const EquipmentDetails = model('EquipmentDetails',
  equipmentDetailsSchema,
);
export const ServiceDetails = model('ServiceDetails',
  serviceDetailsSchema,
);

export interface AvailabilityRuleFields {
  _id?: Types.ObjectId;
  listing: Types.ObjectId;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const availabilityRuleSchema = new Schema<AvailabilityRuleFields>(
  {
    listing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    daysOfWeek: { type: [Number], required: true, min: 0, max: 6 },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
  },
  { timestamps: true },
);

export interface AvailabilityExceptionFields {
  _id?: Types.ObjectId;
  listing: Types.ObjectId;
  date: Date;
  reason: string | null;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const availabilityExceptionSchema = new Schema<AvailabilityExceptionFields>(
  {
    listing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    date: { type: Date, required: true },
    reason: { type: String, default: null, maxlength: 300 },
    isAvailable: { type: Boolean, default: false },
  },
  { timestamps: true },
);

availabilityExceptionSchema.index({ listing: 1, date: 1 }, { unique: true });

export type AvailabilityRuleDocument = HydratedDocument<AvailabilityRuleFields>;
export type AvailabilityExceptionDocument = HydratedDocument<AvailabilityExceptionFields>;
export const AvailabilityRule = model(
  'AvailabilityRule',
  availabilityRuleSchema,
);
export const AvailabilityException = model('AvailabilityException', availabilityExceptionSchema);
