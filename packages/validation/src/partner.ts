import { z } from 'zod';
import { locationSchema, objectIdSchema } from './common.js';

export const partnerOnboardingSchema = z.object({
  businessName: z.string().trim().min(2, 'Business name is required').max(120),
  businessType: z
    .enum(['SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'HUF', 'OTHER'])
    .default('SOLE_PROPRIETORSHIP'),
  description: z.string().trim().max(2000).nullish(),
  address: locationSchema,
  website: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === '' || /^https?:\/\/\S+$/.test(v), 'Website must be a valid URL')
    .nullish(),
  logoUrl: z
    .string()
    .trim()
    .max(1000)
    .refine((v) => v === '' || v.startsWith('https://') || v.startsWith('data:image/'), 'Invalid logo')
    .nullish(),
  supportedTypes: z
    .array(z.enum(['WAREHOUSE', 'EQUIPMENT', 'SERVICE']))
    .min(1, 'Select at least one listing type')
    .max(3),
});

export const businessDocumentSchema = z.object({
  label: z.string().trim().min(2).max(120),
  url: z.string().trim().min(5).max(2000),
});

export const submitVerificationSchema = z.object({
  legalBusinessName: z.string().trim().min(2).max(160),
  businessType: z.enum([
    'SOLE_PROPRIETORSHIP',
    'PARTNERSHIP',
    'PRIVATE_LIMITED',
    'PUBLIC_LIMITED',
    'LLP',
    'HUF',
    'OTHER',
  ]),
  gstNumber: z
    .string()
    .trim()
    .regex(/^[0-9A-Z]{15}$/, 'GST number must be 15 characters')
    .nullish(),
  panNumber: z
    .string()
    .trim()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN must look like ABCDE1234F')
    .nullish(),
  registrationNumber: z.string().trim().max(60).nullish(),
  address: locationSchema,
  documents: z.array(businessDocumentSchema).min(1, 'Upload at least one document').max(10),
});

export const availabilityRuleSchema = z.object({
  listingId: objectIdSchema,
  daysOfWeek: z
    .array(z.number().int().min(0).max(6))
    .min(1, 'Select at least one day')
    .max(7),
  startTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24h HH:mm format'),
  endTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24h HH:mm format'),
  startDate: z.coerce.date().nullish(),
  endDate: z.coerce.date().nullish(),
});

export const availabilityExceptionSchema = z.object({
  listingId: objectIdSchema,
  date: z.coerce.date(),
  reason: z.string().trim().max(300).nullish(),
  /** `false` blocks the date, `true` opens an otherwise closed date. */
  isAvailable: z.boolean().default(false),
});

export const payoutDetailsSchema = z.object({
  accountHolderName: z.string().trim().min(2).max(120),
  accountNumber: z.string().trim().regex(/^[0-9]{6,20}$/, 'Enter a valid account number'),
  ifsc: z.string().trim().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid IFSC code'),
  bankName: z.string().trim().min(2).max(120),
  upiId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/, 'Enter a valid UPI ID')
    .nullish(),
});

export type PartnerOnboardingInput = z.infer<typeof partnerOnboardingSchema>;
export type SubmitVerificationInput = z.infer<typeof submitVerificationSchema>;
export type AvailabilityRuleInput = z.infer<typeof availabilityRuleSchema>;
export type AvailabilityExceptionInput = z.infer<typeof availabilityExceptionSchema>;
export type PayoutDetailsInput = z.infer<typeof payoutDetailsSchema>;
