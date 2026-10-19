import { z } from 'zod';
import {
  CANCELLATION_POLICIES,
  CAPACITY_UNITS,
  DISPUTE_REASONS,
  EQUIPMENT_CATEGORIES,
  FACILITY_TYPES,
  LISTING_SORTS,
  LISTING_TYPES,
  PRICING_MODELS,
  PRICING_PERIODS,
  SERVICE_TYPES,
  STORAGE_TYPES,
} from '@bmw/shared-types';

export const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid identifier');

/** Query-string booleans: `z.coerce.boolean()` would treat "false" as true. */
export const booleanQuerySchema = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => value === true || value === 'true' || value === '1');

export const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must contain lowercase letters, numbers and hyphens');

export const isoDateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Must be a valid ISO date')
  .transform((value) => new Date(value));

export const isoDateTimeSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Must be a valid ISO datetime')
  .transform((value) => new Date(value));

/** Monetary input in major units (e.g. 1250.50 INR); converted to minor units server-side. */
export const majorMoneySchema = z
  .number()
  .finite()
  .nonnegative('Must not be negative')
  .max(1_000_000_000, 'Amount is too large');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
});

export const idParamSchema = z.object({ id: objectIdSchema });

export const locationSchema = z.object({
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).nullish(),
  landmark: z.string().trim().max(200).nullish(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z -]{4,12}$/, 'Must be a valid postal / PIN code'),
  country: z.string().trim().min(2).max(80).default('India'),
  region: z.string().trim().max(120).nullish(),
  coordinates: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .nullish(),
  serviceRadiusKm: z.number().positive().max(1000).nullish(),
});

export const listingPriceSchema = z.object({
  model: z.enum(PRICING_MODELS),
  amount: majorMoneySchema.refine((v) => v > 0, 'Price must be greater than zero'),
  currency: z.string().trim().length(3).default('INR'),
  period: z.enum(PRICING_PERIODS).nullish(),
  unitLabel: z.string().trim().max(80).nullish(),
  minQuantity: z.number().int().positive().max(1_000_000).nullish(),
  additionalCharges: z
    .array(
      z.object({
        label: z.string().trim().min(2).max(80),
        amount: majorMoneySchema,
        taxable: z.boolean().default(true),
      }),
    )
    .max(20)
    .default([]),
});

export const cancellationTermsSchema = z.object({
  policy: z.enum(CANCELLATION_POLICIES).default('MODERATE'),
  description: z.string().trim().min(5).max(600),
  customerRefundPercent: z.number().int().min(0).max(100),
  note: z.string().trim().max(400).nullish(),
});

export const warehouseDetailsSchema = z.object({
  facilityType: z.enum(FACILITY_TYPES),
  storageTypes: z.array(z.enum(STORAGE_TYPES)).min(1).max(10),
  totalCapacity: z.number().positive('Capacity must be greater than zero').max(10_000_000),
  capacityUnit: z.enum(CAPACITY_UNITS),
  numberOfUnits: z.number().int().positive().max(100_000).nullish(),
  unitDimensions: z.string().trim().max(200).nullish(),
  ceilingHeightM: z.number().positive().max(100).nullish(),
  floorLoadCapacityKg: z.number().positive().max(1_000_000).nullish(),
  loadingDocks: z.number().int().min(0).max(500).default(0),
  driveways: z.number().int().min(0).max(500).default(0),
  temperatureControlled: z.boolean().default(false),
  humidityControlled: z.boolean().default(false),
  powerBackup: z.boolean().default(false),
  fireSafety: z.boolean().default(false),
  cctv: z.boolean().default(false),
  certifications: z.array(z.string().trim().min(2).max(120)).max(20).default([]),
  operatingHours: z.string().trim().max(120).nullish(),
});

export const equipmentDetailsSchema = z.object({
  equipmentCategory: z.enum(EQUIPMENT_CATEGORIES),
  brand: z.string().trim().max(80).nullish(),
  model: z.string().trim().max(80).nullish(),
  manufactureYear: z.number().int().min(1950).max(2100).nullish(),
  quantity: z.number().int().positive('Quantity must be greater than zero').max(100_000),
  rentalPeriod: z.enum(PRICING_PERIODS).default('DAY'),
  deliveryAvailable: z.boolean().default(false),
  operatorAvailable: z.boolean().default(false),
  operatorChargePerDay: majorMoneySchema.nullish(),
  minRentalDuration: z.number().int().positive().max(10_000).nullish(),
  specifications: z.record(
    z.string().trim().min(1).max(60),
    z.string().trim().max(200),
  ).default({}),
});

export const serviceDetailsSchema = z.object({
  serviceType: z.enum(SERVICE_TYPES),
  serviceAreas: z.array(z.string().trim().min(2).max(120)).min(1).max(30),
  estimatedDurationHours: z.number().positive().max(10_000).nullish(),
  teamSize: z.number().int().positive().max(500).nullish(),
  dailyCapacity: z.number().int().positive().max(100_000).nullish(),
  requirements: z.string().trim().max(600).nullish(),
});

export const listingSearchQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  type: z.enum(LISTING_TYPES).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  region: z.string().trim().max(120).optional(),
  categoryId: objectIdSchema.optional(),
  facilityType: z.enum(FACILITY_TYPES).optional(),
  storageType: z.enum(STORAGE_TYPES).optional(),
  equipmentCategory: z.enum(EQUIPMENT_CATEGORIES).optional(),
  serviceType: z.enum(SERVICE_TYPES).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  capacityMin: z.coerce.number().min(0).optional(),
  capacityMax: z.coerce.number().min(0).optional(),
  amenities: z.string().trim().max(300).optional(),
  verifiedOnly: booleanQuerySchema.optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  availableFrom: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Must be a valid date')
    .optional(),
  availableTo: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Must be a valid date')
    .optional(),
  minCapacity: z.coerce.number().min(0).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(1000).optional(),
  sort: z.enum(LISTING_SORTS).default('relevance'),
});

export const disputeReasonSchema = z.enum(DISPUTE_REASONS);

export function emptyToUndefined(value: unknown): unknown {
  return value === '' || value === 'undefined' ? undefined : value;
}
