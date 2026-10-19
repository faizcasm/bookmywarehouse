import { z } from 'zod';
import { objectIdSchema } from './common.js';

export const createReviewSchema = z.object({
  bookingId: objectIdSchema,
  rating: z.number().int().min(1, 'Rating must be between 1 and 5').max(5),
  comment: z.string().trim().max(2000).nullish(),
});

export const respondReviewSchema = z.object({
  text: z.string().trim().min(5, 'Response must be at least 5 characters').max(2000),
});

export const reviewListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  listingId: objectIdSchema.optional(),
  minRating: z.coerce.number().int().min(1).max(5).optional(),
  sort: z.enum(['newest', 'oldest', 'rating_desc', 'rating_asc']).default('newest'),
});

export const createConversationSchema = z.object({
  listingId: objectIdSchema.optional(),
  toUserId: objectIdSchema.optional(),
  subject: z.string().trim().min(3).max(160),
  body: z.string().trim().min(1, 'Message cannot be empty').max(4000),
});

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(4000),
});

export const conversationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().trim().max(120).optional(),
  includeArchived: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .optional(),
});

export const messageListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.string().trim().max(40).optional(),
});

export const markReadSchema = z.object({
  ids: z.array(objectIdSchema).min(1).max(200).optional(),
});

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .optional(),
});

export const favoriteToggleSchema = z.object({ listingId: objectIdSchema });

export const uploadImageSchema = z.object({
  /** Data-URI or https URL produced by the browser upload adapter. */
  file: z.string().min(10).max(2_000_000, 'Image exceeds the maximum size'),
  folder: z.enum(['listings', 'avatars', 'documents', 'logos']).default('listings'),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type UploadImageInput = z.infer<typeof uploadImageSchema>;
