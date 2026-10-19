import { z } from 'zod';
import { locationSchema, objectIdSchema } from './common.js';

export const reviewModerationSchema = z.object({
  status: z.enum(['PUBLISHED', 'HIDDEN', 'REMOVED']),
  note: z.string().trim().max(400).nullish(),
});

export const partnerDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'SUSPEND']),
  reason: z.string().trim().max(800).nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

export const listingModerationSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'SUSPEND', 'UNSUSPEND']),
  reason: z.string().trim().max(800).nullish(),
});

export const userModerationSchema = z.object({
  action: z.enum(['SUSPEND', 'REACTIVATE', 'DEACTIVATE']),
  reason: z.string().trim().max(600).nullish(),
});

export const disputeResolutionSchema = z.object({
  resolution: z.enum(['RESOLVED_CUSTOMER', 'RESOLVED_PARTNER', 'CLOSED']),
  resolutionNote: z.string().trim().min(5, 'Explain the resolution').max(2000),
  refundAmount: z.number().int().min(0).max(100_000_000).nullish(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must contain lowercase letters, numbers and hyphens'),
  type: z.enum(['WAREHOUSE', 'EQUIPMENT', 'SERVICE']),
  description: z.string().trim().max(600).nullish(),
  icon: z.string().trim().max(60).nullish(),
  imageUrl: z.string().trim().max(1000).nullish(),
  parentId: objectIdSchema.nullish(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

export const platformSettingsSchema = z.object({
  currency: z.string().trim().length(3).optional(),
  platformFeePercent: z.number().min(0).max(50).optional(),
  customerFeePercent: z.number().min(0).max(50).optional(),
  taxPercent: z.number().min(0).max(50).optional(),
  minPayoutAmount: z.number().int().min(0).max(100_000_000).optional(),
  supportEmail: z.string().trim().email().optional(),
  allowSelfServiceListings: z.boolean().optional(),
  requirePartnerVerification: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  announcement: z.string().trim().max(600).nullish(),
});

export const openDisputeSchema = z.object({
  bookingId: objectIdSchema,
  reason: z.enum([
    'SERVICE_NOT_DELIVERED',
    'QUALITY_ISSUE',
    'OVERCHARGE',
    'CANCELLATION_REFUND',
    'DAMAGE',
    'OTHER',
  ]),
  description: z.string().trim().min(20, 'Describe the issue in at least 20 characters').max(3000),
});

export const adminCustomerCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
  role: z.enum(['CUSTOMER', 'PARTNER', 'ADMIN']),
  phone: z.string().trim().max(20).nullish(),
  address: locationSchema.nullish(),
});

export type ReviewModerationInput = z.infer<typeof reviewModerationSchema>;
export type PartnerDecisionInput = z.infer<typeof partnerDecisionSchema>;
export type ListingModerationInput = z.infer<typeof listingModerationSchema>;
export type UserModerationInput = z.infer<typeof userModerationSchema>;
export type DisputeResolutionInput = z.infer<typeof disputeResolutionSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type PlatformSettingsInput = z.infer<typeof platformSettingsSchema>;
export type OpenDisputeInput = z.infer<typeof openDisputeSchema>;
