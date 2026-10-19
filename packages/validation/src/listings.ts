import { z } from 'zod';
import {
  cancellationTermsSchema,
  equipmentDetailsSchema,
  listingPriceSchema,
  locationSchema,
  objectIdSchema,
  serviceDetailsSchema,
  slugSchema,
  warehouseDetailsSchema,
} from './common.js';

const imageSchema = z
  .string()
  .trim()
  .max(1_000_000, 'Image data is too large')
  .refine(
    (v) => v.startsWith('https://') || v.startsWith('http://localhost') || v.startsWith('data:image/'),
    'Images must be https URLs or uploaded data',
  );

const stringArray = (max: number, itemMax: number) =>
  z.array(z.string().trim().min(1).max(itemMax)).max(max).default([]);

export const listingBaseFields = {
  title: z.string().trim().min(8, 'Title must be at least 8 characters').max(160),
  description: z.string().trim().min(40, 'Description must be at least 40 characters').max(5000),
  categoryId: objectIdSchema,
  location: locationSchema,
  price: listingPriceSchema,
  images: z.array(imageSchema).min(1, 'Add at least one image').max(15),
  amenities: stringArray(40, 60),
  safetyFeatures: stringArray(30, 60),
  rules: stringArray(30, 300),
  minBookingDuration: z
    .object({
      value: z.number().int().positive().max(10_000),
      unit: z.enum(['DAY', 'WEEK', 'MONTH', 'YEAR']),
    })
    .nullish(),
  cancellationTerms: cancellationTermsSchema,
  availableFrom: z.coerce.date().nullish(),
};

export const createListingSchema = z
  .object({
    type: z.enum(['WAREHOUSE', 'EQUIPMENT', 'SERVICE']),
    slug: slugSchema.optional(),
    warehouse: warehouseDetailsSchema.optional(),
    equipment: equipmentDetailsSchema.optional(),
    service: serviceDetailsSchema.optional(),
  })
  .and(z.object(listingBaseFields))
  .superRefine((value, ctx) => {
    if (value.type === 'WAREHOUSE' && !value.warehouse) {
      ctx.addIssue({ code: 'custom', path: ['warehouse'], message: 'Warehouse details are required' });
    }
    if (value.type === 'EQUIPMENT' && !value.equipment) {
      ctx.addIssue({ code: 'custom', path: ['equipment'], message: 'Equipment details are required' });
    }
    if (value.type === 'SERVICE' && !value.service) {
      ctx.addIssue({ code: 'custom', path: ['service'], message: 'Service details are required' });
    }
  });

export const updateListingSchema = z.object({
  title: listingBaseFields.title.optional(),
  description: listingBaseFields.description.optional(),
  categoryId: objectIdSchema.optional(),
  location: locationSchema.optional(),
  price: listingPriceSchema.optional(),
  images: listingBaseFields.images.optional(),
  amenities: stringArray(40, 60).optional(),
  safetyFeatures: stringArray(30, 60).optional(),
  rules: stringArray(30, 300).optional(),
  minBookingDuration: listingBaseFields.minBookingDuration.optional(),
  cancellationTerms: cancellationTermsSchema.optional(),
  availableFrom: z.coerce.date().nullish(),
  warehouse: warehouseDetailsSchema.optional(),
  equipment: equipmentDetailsSchema.optional(),
  service: serviceDetailsSchema.optional(),
  /** Explicit null clears a type-specific block that no longer applies. */
  clearWarehouse: z.boolean().optional(),
  clearEquipment: z.boolean().optional(),
  clearService: z.boolean().optional(),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
